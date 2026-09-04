import { Injectable } from '@nestjs/common';
import { UsersService } from '../../identity/services/users.service';
import { MembershipsService } from '../../organizations/services/memberships.service';
import { EnrollmentsService } from '../../cohorts/services/enrollments.service';
import { AuditLogService } from '../../platform/audit-log.service';
import { SystemSettingsService } from '../../platform/services/system-settings.service';
import { AppException } from '../../../shared/errors/app.exception';
import { CollectionResult, parseLimit } from '../../../shared/pagination/collection-result';
import type { TenantScope } from '../../../shared/tenancy/tenant-scope';
import {
  toCohortApplicationEntity,
  type CohortApplicationEntity,
} from '../entities/cohort-application.entity';
import {
  CohortApplicationConflictError,
  CohortApplicationEnrollmentAlreadyClaimedError,
  CohortApplicationVersionConflictError,
  CohortApplicationsRepository,
} from '../repositories/cohort-applications.repository';

export interface SubmitProspectApplicationInput {
  cohortId: string;
  prospectEmail: string;
  prospectDisplayName: string;
  requestedLearningTrackId?: string;
  note?: string;
}

export interface SubmitStudentApplicationInput {
  cohortId: string;
  requestedLearningTrackId?: string;
  note?: string;
}

export interface BulkCohortApplicationResult {
  id: string;
  success: boolean;
  message?: string;
}

const STUDENT_ROLE_KEY = 'STUDENT';

@Injectable()
export class CohortApplicationsService {
  constructor(
    private readonly cohortApplicationsRepository: CohortApplicationsRepository,
    private readonly usersService: UsersService,
    private readonly membershipsService: MembershipsService,
    private readonly enrollmentsService: EnrollmentsService,
    private readonly systemSettingsService: SystemSettingsService,
    private readonly auditLog: AuditLogService,
  ) {}

  private async assertRegistrationOpen(): Promise<void> {
    const settings = await this.systemSettingsService.get();
    if (!settings.registrationOpen) {
      throw AppException.conflict(
        'REGISTRATION_CLOSED',
        'Registration is currently closed on this platform.',
      );
    }
  }

  /** Wraps `CohortApplicationsRepository.create()` — translates the two
   * hand-written partial-unique-index violations (one pending application
   * per cohort per prospect email / applicant user) into a clean 409
   * instead of a raw 500. */
  private async createApplication(
    data: Parameters<CohortApplicationsRepository['create']>[0],
  ): Promise<Awaited<ReturnType<CohortApplicationsRepository['create']>>> {
    try {
      return await this.cohortApplicationsRepository.create(data);
    } catch (error) {
      if (error instanceof CohortApplicationConflictError) {
        throw AppException.conflict('APPLICATION_ALREADY_PENDING', error.message);
      }
      throw error;
    }
  }

  private async resolveTrackId(
    fellowshipId: string,
    requestedLearningTrackId: string | undefined,
  ): Promise<string | undefined> {
    if (!requestedLearningTrackId) return undefined;
    const track = await this.cohortApplicationsRepository.findApplyableTrack(
      requestedLearningTrackId,
      fellowshipId,
    );
    if (!track) {
      throw AppException.validation([
        {
          field: 'requestedLearningTrackId',
          code: 'UNKNOWN_TRACK',
          message: 'This learning track is not available for this fellowship.',
        },
      ]);
    }
    return track.id;
  }

  /** Anonymous submission — no `TenantScope`, the target organization is
   * resolved entirely server-side from `input.cohortId`, never supplied by
   * the caller. See `CohortApplicationsRepository.findApplyableCohort()`. */
  async submitAsProspect(input: SubmitProspectApplicationInput): Promise<CohortApplicationEntity> {
    await this.assertRegistrationOpen();
    const applyable = await this.cohortApplicationsRepository.findApplyableCohort(input.cohortId);
    if (!applyable) {
      throw AppException.notFound('This cohort is not open for applications.');
    }
    const trackId = await this.resolveTrackId(
      applyable.fellowship.id,
      input.requestedLearningTrackId,
    );

    const application = await this.createApplication({
      organizationId: applyable.cohort.organizationId,
      academyId: applyable.cohort.academyId,
      fellowshipId: applyable.fellowship.id,
      cohortId: applyable.cohort.id,
      prospectEmail: input.prospectEmail.trim().toLowerCase(),
      prospectDisplayName: input.prospectDisplayName.trim(),
      requestedLearningTrackId: trackId,
      note: input.note,
    });

    await this.auditLog.record({
      action: 'cohort_application.submitted',
      entityType: 'cohort_application',
      entityId: application.id,
      outcome: 'success',
      organizationId: application.organizationId,
      metadata: { prospectEmail: application.prospectEmail, cohortId: application.cohortId },
    });
    return toCohortApplicationEntity(application);
  }

  /** Authenticated submission — an existing member of `scope`'s organization
   * applying to one of that same organization's public cohorts. Joining a
   * different organization goes through `submitAsProspect` instead (an
   * explicit, disclosed narrowing — see docs/adr/0010-cohort-applications.md). */
  async submitAsStudent(
    scope: TenantScope,
    callerId: string,
    input: SubmitStudentApplicationInput,
  ): Promise<CohortApplicationEntity> {
    await this.assertRegistrationOpen();
    const applyable = await this.cohortApplicationsRepository.findApplyableCohort(
      input.cohortId,
      scope.organizationId,
    );
    if (!applyable) {
      throw AppException.notFound('This cohort is not open for applications.');
    }
    const trackId = await this.resolveTrackId(
      applyable.fellowship.id,
      input.requestedLearningTrackId,
    );

    const application = await this.createApplication({
      organizationId: applyable.cohort.organizationId,
      academyId: applyable.cohort.academyId,
      fellowshipId: applyable.fellowship.id,
      cohortId: applyable.cohort.id,
      applicantUserId: callerId,
      requestedLearningTrackId: trackId,
      note: input.note,
    });

    await this.auditLog.record({
      action: 'cohort_application.submitted',
      entityType: 'cohort_application',
      entityId: application.id,
      outcome: 'success',
      organizationId: application.organizationId,
      actorUserId: callerId,
      metadata: { cohortId: application.cohortId },
    });
    return toCohortApplicationEntity(application);
  }

  /** The caller's own submitted applications — self-service, matching
   * `EnrollmentsService.listMine`'s shape. */
  async listMine(
    scope: TenantScope,
    callerId: string,
    options: { cursor?: string; limit?: string },
  ): Promise<CollectionResult<CohortApplicationEntity>> {
    const limit = parseLimit(options.limit);
    const { rows, hasMore } = await this.cohortApplicationsRepository.list(scope, {
      applicantUserId: callerId,
      cursor: options.cursor,
      limit,
    });
    return new CollectionResult(rows.map(toCohortApplicationEntity), {
      nextCursor: hasMore ? rows[rows.length - 1].id : null,
      previousCursor: options.cursor ?? null,
      limit,
      hasMore,
    });
  }

  /** The admin approval queue — academy-scoped exactly like every other
   * admin list (`AcademiesService.list`, `AdminUsersRepository.list`). */
  async list(
    scope: TenantScope,
    callerId: string,
    options: {
      status?: string;
      fellowshipId?: string;
      q?: string;
      cursor?: string;
      limit?: string;
    },
  ): Promise<CollectionResult<CohortApplicationEntity>> {
    const limit = parseLimit(options.limit);
    const academyScope = await this.membershipsService.getAcademyScope(scope, callerId);
    if (academyScope.restricted && !academyScope.academyId) {
      return new CollectionResult([], {
        nextCursor: null,
        previousCursor: options.cursor ?? null,
        limit,
        hasMore: false,
      });
    }

    const { rows, hasMore } = await this.cohortApplicationsRepository.list(scope, {
      status: options.status as never,
      restrictToAcademyId: academyScope.restricted ? (academyScope.academyId as string) : undefined,
      fellowshipId: options.fellowshipId,
      q: options.q,
      cursor: options.cursor,
      limit,
    });
    return new CollectionResult(rows.map(toCohortApplicationEntity), {
      nextCursor: hasMore ? rows[rows.length - 1].id : null,
      previousCursor: options.cursor ?? null,
      limit,
      hasMore,
    });
  }

  async get(scope: TenantScope, id: string, callerId: string): Promise<CohortApplicationEntity> {
    const application = await this.cohortApplicationsRepository.findById(scope, id);
    if (!application) {
      throw AppException.notFound('Cohort application not found.');
    }
    const academyScope = await this.membershipsService.getAcademyScope(scope, callerId);
    if (academyScope.restricted && academyScope.academyId !== application.academyId) {
      throw AppException.notFound('Cohort application not found.');
    }
    return toCohortApplicationEntity(application);
  }

  /** The 3-module orchestration: identity (create the account if this was a
   * prospect) + organizations (create the membership) + cohorts (create the
   * enrollment, apply the requested track). Ordered so a retried call after
   * a partial failure is always safely resumable — see
   * docs/adr/0010-cohort-applications.md. */
  async approve(
    scope: TenantScope,
    id: string,
    expectedVersion: number,
    actorUserId: string,
  ): Promise<CohortApplicationEntity> {
    const application = await this.get(scope, id, actorUserId);
    if (application.status !== 'pending') {
      throw AppException.conflict(
        'INVALID_STATE_TRANSITION',
        `Cohort application cannot move from ${application.status} to approved.`,
      );
    }

    let userId = application.applicantUserId;
    if (!userId) {
      const invited = await this.usersService.invite(
        application.prospectEmail as string,
        application.prospectDisplayName as string,
        actorUserId,
      );
      userId = invited.user.id;
    }

    const alreadyMember = await this.membershipsService.hasActiveMembership(scope, userId);
    if (!alreadyMember) {
      await this.membershipsService.inviteIntoOrganization(
        scope,
        userId,
        [STUDENT_ROLE_KEY],
        actorUserId,
      );
    }

    let enrollment = await this.enrollmentsService.findByCohortAndUser(
      scope,
      application.cohortId,
      userId,
    );
    if (!enrollment) {
      enrollment = await this.enrollmentsService.create(
        scope,
        application.cohortId,
        userId,
        actorUserId,
      );
    }

    if (
      application.requestedLearningTrackId &&
      application.requestedLearningTrackId !== enrollment.currentLearningTrackId
    ) {
      enrollment = await this.enrollmentsService.update(
        scope,
        enrollment.id,
        { currentLearningTrackId: application.requestedLearningTrackId },
        enrollment.version,
        actorUserId,
      );
    }

    try {
      const updated = await this.cohortApplicationsRepository.update(
        id,
        {
          status: 'approved',
          reviewedByUserId: actorUserId,
          reviewedAt: new Date(),
          resultingUserId: userId,
          resultingEnrollmentId: enrollment.id,
        },
        expectedVersion,
      );
      await this.auditLog.record({
        action: 'cohort_application.approved',
        entityType: 'cohort_application',
        entityId: id,
        outcome: 'success',
        organizationId: scope.organizationId,
        actorUserId,
        metadata: { resultingUserId: userId, resultingEnrollmentId: enrollment.id },
      });
      return toCohortApplicationEntity(updated);
    } catch (error) {
      if (error instanceof CohortApplicationVersionConflictError) {
        throw AppException.conflict(
          'VERSION_CONFLICT',
          `Cohort application has moved to version ${error.currentVersion}.`,
        );
      }
      if (error instanceof CohortApplicationEnrollmentAlreadyClaimedError) {
        throw AppException.conflict('ENROLLMENT_ALREADY_CLAIMED', error.message);
      }
      throw error;
    }
  }

  async reject(
    scope: TenantScope,
    id: string,
    expectedVersion: number,
    reason: string | undefined,
    actorUserId: string,
  ): Promise<CohortApplicationEntity> {
    const application = await this.get(scope, id, actorUserId);
    if (application.status !== 'pending') {
      throw AppException.conflict(
        'INVALID_STATE_TRANSITION',
        `Cohort application cannot move from ${application.status} to rejected.`,
      );
    }
    try {
      const updated = await this.cohortApplicationsRepository.update(
        id,
        {
          status: 'rejected',
          reviewedByUserId: actorUserId,
          reviewedAt: new Date(),
          rejectionReason: reason,
        },
        expectedVersion,
      );
      await this.auditLog.record({
        action: 'cohort_application.rejected',
        entityType: 'cohort_application',
        entityId: id,
        outcome: 'success',
        organizationId: scope.organizationId,
        actorUserId,
        metadata: { reason },
      });
      return toCohortApplicationEntity(updated);
    } catch (error) {
      if (error instanceof CohortApplicationVersionConflictError) {
        throw AppException.conflict(
          'VERSION_CONFLICT',
          `Cohort application has moved to version ${error.currentVersion}.`,
        );
      }
      throw error;
    }
  }

  /** Bulk approve/reject are a real server-side operation, not N frontend
   * requests — but each item still goes through the exact same `approve()`/
   * `reject()` this page's single-item action already calls, one at a time,
   * so per-item authorization, state-transition, and optimistic-concurrency
   * checks are never bypassed. One bad row (stale version, already
   * decided, capacity reached) fails independently and reports its own
   * reason rather than aborting the rest of the batch. */
  async bulkApprove(
    scope: TenantScope,
    items: { id: string; version: number }[],
    actorUserId: string,
  ): Promise<BulkCohortApplicationResult[]> {
    const results: BulkCohortApplicationResult[] = [];
    for (const item of items) {
      try {
        await this.approve(scope, item.id, item.version, actorUserId);
        results.push({ id: item.id, success: true });
      } catch (error) {
        results.push({
          id: item.id,
          success: false,
          message: error instanceof Error ? error.message : 'Could not approve this application.',
        });
      }
    }
    return results;
  }

  async bulkReject(
    scope: TenantScope,
    items: { id: string; version: number }[],
    reason: string | undefined,
    actorUserId: string,
  ): Promise<BulkCohortApplicationResult[]> {
    const results: BulkCohortApplicationResult[] = [];
    for (const item of items) {
      try {
        await this.reject(scope, item.id, item.version, reason, actorUserId);
        results.push({ id: item.id, success: true });
      } catch (error) {
        results.push({
          id: item.id,
          success: false,
          message: error instanceof Error ? error.message : 'Could not reject this application.',
        });
      }
    }
    return results;
  }

  /** Authenticated-applicant-only — a prospect has no session to withdraw
   * with (see docs/adr/0010-cohort-applications.md's disclosed narrowing). */
  async withdraw(
    scope: TenantScope,
    id: string,
    expectedVersion: number,
    callerId: string,
  ): Promise<CohortApplicationEntity> {
    const application = await this.cohortApplicationsRepository.findById(scope, id);
    if (!application || application.applicantUserId !== callerId) {
      throw AppException.notFound('Cohort application not found.');
    }
    if (application.status !== 'pending') {
      throw AppException.conflict(
        'INVALID_STATE_TRANSITION',
        `Cohort application cannot move from ${application.status} to withdrawn.`,
      );
    }
    try {
      const updated = await this.cohortApplicationsRepository.update(
        id,
        { status: 'withdrawn' },
        expectedVersion,
      );
      await this.auditLog.record({
        action: 'cohort_application.withdrawn',
        entityType: 'cohort_application',
        entityId: id,
        outcome: 'success',
        organizationId: scope.organizationId,
        actorUserId: callerId,
      });
      return toCohortApplicationEntity(updated);
    } catch (error) {
      if (error instanceof CohortApplicationVersionConflictError) {
        throw AppException.conflict(
          'VERSION_CONFLICT',
          `Cohort application has moved to version ${error.currentVersion}.`,
        );
      }
      throw error;
    }
  }
}
