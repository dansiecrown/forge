import { Injectable } from '@nestjs/common';
import type { User } from '@prisma/client';
import { FellowshipsService } from '../../catalog/services/fellowships.service';
import { LearningTracksService } from '../../catalog/services/learning-tracks.service';
import { UsersService } from '../../identity/services/users.service';
import { AcademiesService } from '../../organizations/services/academies.service';
import { MembershipsService } from '../../organizations/services/memberships.service';
import { OrganizationsService } from '../../organizations/services/organizations.service';
import { AuditLogService } from '../../platform/audit-log.service';
import { AppException } from '../../../shared/errors/app.exception';
import { CollectionResult, parseLimit } from '../../../shared/pagination/collection-result';
import type { TenantScope } from '../../../shared/tenancy/tenant-scope';
import { toEnrollmentEntity, type EnrollmentEntity } from '../entities/enrollment.entity';
import type { UpdateEnrollmentDto } from '../dtos/enrollment.dto';
import {
  EnrollmentConflictError,
  EnrollmentsRepository,
  EnrollmentVersionConflictError,
} from '../repositories/enrollments.repository';
import { CohortsService } from './cohorts.service';

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  invited: ['active', 'withdrawn'],
  active: ['paused', 'completed', 'withdrawn'],
  paused: ['active', 'completed', 'withdrawn'],
  completed: [],
  withdrawn: [],
};

@Injectable()
export class EnrollmentsService {
  constructor(
    private readonly enrollmentsRepository: EnrollmentsRepository,
    private readonly cohortsService: CohortsService,
    private readonly membershipsService: MembershipsService,
    private readonly learningTracksService: LearningTracksService,
    private readonly auditLog: AuditLogService,
    private readonly usersService: UsersService,
    private readonly organizationsService: OrganizationsService,
    private readonly academiesService: AcademiesService,
    private readonly fellowshipsService: FellowshipsService,
  ) {}

  /** Batch-resolves display names for a page of enrollments in one query —
   * `Enrollment` has no Prisma relation to `User` to `include` directly (see
   * docs/adr/0015-name-first-display.md), so this is the one place that
   * gap is bridged, shared by every list-returning method below. */
  private async withUsers(
    rows: import('@prisma/client').Enrollment[],
  ): Promise<EnrollmentEntity[]> {
    const users = await this.usersService.listByIds([...new Set(rows.map((r) => r.userId))]);
    const byId = new Map<string, User>(users.map((u) => [u.id, u]));
    return rows.map((row) => toEnrollmentEntity(row, byId.get(row.userId)));
  }

  async list(
    scope: TenantScope,
    options: { cohortId?: string; status?: string; cursor?: string; limit?: string },
  ): Promise<CollectionResult<EnrollmentEntity>> {
    const limit = parseLimit(options.limit);
    const { rows, hasMore } = await this.enrollmentsRepository.list(scope, {
      cohortId: options.cohortId,
      status: options.status as never,
      cursor: options.cursor,
      limit,
    });
    return new CollectionResult(await this.withUsers(rows), {
      nextCursor: hasMore ? rows[rows.length - 1].id : null,
      previousCursor: options.cursor ?? null,
      limit,
      hasMore,
    });
  }

  /** Self-lookup for a Student discovering their own enrollment(s) — see
   * EnrollmentsRepository.findByUserId. Also resolves the full
   * Organization/Academy/Fellowship/Cohort/Track hierarchy by name, for the
   * student Profile/Dashboard "which program am I in" display — see
   * `EnrollmentEntity`'s hierarchy fields and
   * docs/adr/0015-name-first-display.md. */
  async listMine(
    scope: TenantScope,
    callerId: string,
    options: { cursor?: string; limit?: string },
  ): Promise<CollectionResult<EnrollmentEntity>> {
    const limit = parseLimit(options.limit);
    const { rows, hasMore } = await this.enrollmentsRepository.findByUserId(scope, callerId, {
      cursor: options.cursor,
      limit,
    });
    const users = await this.usersService.listByIds([...new Set(rows.map((r) => r.userId))]);
    const usersById = new Map<string, User>(users.map((u) => [u.id, u]));
    const entities = await Promise.all(
      rows.map(async (row) => {
        const hierarchy = await this.resolveHierarchyNames(scope, row, callerId);
        return toEnrollmentEntity(row, usersById.get(row.userId), hierarchy);
      }),
    );
    return new CollectionResult(entities, {
      nextCursor: hasMore ? rows[rows.length - 1].id : null,
      previousCursor: options.cursor ?? null,
      limit,
      hasMore,
    });
  }

  /** Never throws — an enrollment whose Organization/Academy/Fellowship/
   * Cohort/Track has since been hard-deleted (or a Track since unset) must
   * not take down the caller's entire `GET /enrollments/me` (every page in
   * the student portal depends on it, not just the Profile display it was
   * built for). Falls back to all-null hierarchy names for that one row,
   * the same "since-removed record" convention `userDisplayName`/
   * `userEmail` already use above. */
  private async resolveHierarchyNames(
    scope: TenantScope,
    row: import('@prisma/client').Enrollment,
    callerId: string,
  ) {
    try {
      const [organization, academy, fellowship, cohort, track] = await Promise.all([
        this.organizationsService.get(callerId, scope.organizationId, row.organizationId),
        this.academiesService.get(scope, row.academyId, callerId),
        this.fellowshipsService.get(scope, row.fellowshipId, callerId),
        this.cohortsService.get(scope, row.cohortId, callerId),
        row.currentLearningTrackId
          ? this.learningTracksService.get(scope, row.currentLearningTrackId)
          : Promise.resolve(null),
      ]);
      return {
        organizationName: organization.name,
        academyName: academy.name,
        fellowshipTitle: fellowship.title,
        cohortName: cohort.name,
        currentLearningTrackName: track?.name ?? null,
      };
    } catch {
      return {
        organizationName: null,
        academyName: null,
        fellowshipTitle: null,
        cohortName: null,
        currentLearningTrackName: null,
      };
    }
  }

  async get(scope: TenantScope, id: string): Promise<EnrollmentEntity> {
    const enrollment = await this.enrollmentsRepository.findById(scope, id);
    if (!enrollment) {
      throw AppException.notFound('Enrollment not found.');
    }
    const [user] = await this.usersService.listByIds([enrollment.userId]);
    return toEnrollmentEntity(enrollment, user);
  }

  /** Used by `CohortApplicationsService.approve()` to make approval
   * idempotent — looked up before falling back to `create()`, so a retried
   * approval never double-creates. Not exposed over HTTP. */
  async findByCohortAndUser(
    scope: TenantScope,
    cohortId: string,
    userId: string,
  ): Promise<EnrollmentEntity | null> {
    const enrollment = await this.enrollmentsRepository.findByCohortAndUser(cohortId, userId);
    if (!enrollment || enrollment.organizationId !== scope.organizationId) {
      return null;
    }
    return toEnrollmentEntity(enrollment);
  }

  /** Enrolls a student into a cohort. Business rules enforced here
   * (capacity, active membership) plus, at the database level, "only one
   * active/pending Enrollment per Fellowship" via the partial unique index
   * on `enrollments` (see EnrollmentsRepository) — the DB is the ultimate
   * source of truth for that rule, not just this application check. */
  async create(
    scope: TenantScope,
    cohortId: string,
    studentUserId: string,
    actorUserId: string,
  ): Promise<EnrollmentEntity> {
    const cohort = await this.cohortsService.assertExists(scope, cohortId, actorUserId);

    const isMember = await this.membershipsService.hasActiveMembership(scope, studentUserId);
    if (!isMember) {
      throw AppException.validation([
        {
          field: 'studentUserId',
          code: 'NOT_A_MEMBER',
          message: 'This person is not an active member of the organization.',
        },
      ]);
    }

    const activeCount = await this.enrollmentsRepository.countActiveForCohort(cohortId);
    if (activeCount >= cohort.capacity) {
      throw AppException.conflict('CAPACITY_REACHED', 'This cohort has reached its capacity.');
    }

    try {
      const enrollment = await this.enrollmentsRepository.create(scope, {
        academyId: cohort.academyId,
        fellowshipId: cohort.fellowshipId,
        cohortId,
        userId: studentUserId,
      });
      await this.auditLog.record({
        action: 'enrollment.created',
        entityType: 'enrollment',
        entityId: enrollment.id,
        outcome: 'success',
        organizationId: scope.organizationId,
        actorUserId,
      });
      return toEnrollmentEntity(enrollment);
    } catch (error) {
      if (error instanceof EnrollmentConflictError) {
        throw AppException.conflict('ACTIVE_ENROLLMENT_EXISTS', error.message);
      }
      throw error;
    }
  }

  /** Handles a lifecycle status transition and/or a `currentLearningTrackId`
   * change — either may be present, matching `UpdateEnrollmentDto`'s
   * optional `status` (docs/adr/0006-curriculum-learning-engine.md: track
   * selection is a plain field edit via the existing PATCH endpoint, not a
   * new one). */
  async update(
    scope: TenantScope,
    id: string,
    input: UpdateEnrollmentDto,
    expectedVersion: number,
    actorUserId?: string,
  ): Promise<EnrollmentEntity> {
    const existing = await this.get(scope, id);

    if (input.status && !ALLOWED_TRANSITIONS[existing.status]?.includes(input.status)) {
      throw AppException.conflict(
        'INVALID_STATE_TRANSITION',
        `Enrollment cannot move from ${existing.status} to ${input.status}.`,
      );
    }

    if (input.currentLearningTrackId) {
      const track = await this.learningTracksService.get(scope, input.currentLearningTrackId);
      if (track.fellowshipId !== existing.fellowshipId) {
        throw AppException.validation([
          {
            field: 'currentLearningTrackId',
            code: 'TRACK_NOT_IN_FELLOWSHIP',
            message: "This learning track does not belong to the enrollment's fellowship.",
          },
        ]);
      }
    }

    try {
      const updated = await this.enrollmentsRepository.update(
        id,
        { status: input.status, currentLearningTrackId: input.currentLearningTrackId },
        expectedVersion,
      );
      await this.auditLog.record({
        action: input.status ? 'enrollment.status_changed' : 'enrollment.updated',
        entityType: 'enrollment',
        entityId: id,
        outcome: 'success',
        organizationId: scope.organizationId,
        actorUserId,
        metadata: {
          status: input.status,
          currentLearningTrackId: input.currentLearningTrackId,
          reason: input.reason,
        },
      });
      return toEnrollmentEntity(updated);
    } catch (error) {
      if (error instanceof EnrollmentVersionConflictError) {
        throw AppException.conflict(
          'VERSION_CONFLICT',
          `Enrollment has moved to version ${error.currentVersion}.`,
        );
      }
      throw error;
    }
  }

  /** The learner's own self-service counterpart to `update()` — ownership is
   * checked here (not via a permission key, matching the `enrollments/me`
   * convention), and a *change* away from an already-set track is blocked
   * once the cohort's grace period has closed. The very first pick is never
   * gated, regardless of that cohort's state — see
   * docs/adr/0017-track-switch-grace-period.md. No `If-Match` — this is a
   * self-service action, not exposed to a version-tracking client. */
  async selectTrack(
    scope: TenantScope,
    enrollmentId: string,
    learningTrackId: string,
    callerId: string,
  ): Promise<EnrollmentEntity> {
    const existing = await this.get(scope, enrollmentId);
    if (existing.userId !== callerId) {
      // Cross-tenant-style "not found," not "forbidden" — same convention
      // as every other ownership check in this codebase (never confirm a
      // resource exists to a caller who has no legitimate claim to it).
      throw AppException.notFound('Enrollment not found.');
    }

    const track = await this.learningTracksService.get(scope, learningTrackId);
    if (track.fellowshipId !== existing.fellowshipId) {
      throw AppException.validation([
        {
          field: 'learningTrackId',
          code: 'TRACK_NOT_IN_FELLOWSHIP',
          message: "This learning track does not belong to the enrollment's fellowship.",
        },
      ]);
    }

    const isChange =
      existing.currentLearningTrackId !== null &&
      existing.currentLearningTrackId !== learningTrackId;
    if (isChange) {
      const cohort = await this.cohortsService.get(scope, existing.cohortId, callerId);
      if (cohort.trackSwitchClosedAt) {
        throw AppException.conflict(
          'TRACK_SWITCHING_CLOSED',
          'Track switching has closed for this cohort. Contact an admin if you need to change tracks.',
        );
      }
    }

    if (existing.currentLearningTrackId === learningTrackId) {
      return existing;
    }

    try {
      const updated = await this.enrollmentsRepository.update(
        enrollmentId,
        { currentLearningTrackId: learningTrackId },
        existing.version,
      );
      await this.auditLog.record({
        action: isChange ? 'enrollment.track_switched' : 'enrollment.track_selected',
        entityType: 'enrollment',
        entityId: enrollmentId,
        outcome: 'success',
        organizationId: scope.organizationId,
        actorUserId: callerId,
        metadata: { learningTrackId, previousTrackId: existing.currentLearningTrackId },
      });
      return toEnrollmentEntity(updated);
    } catch (error) {
      if (error instanceof EnrollmentVersionConflictError) {
        throw AppException.conflict(
          'VERSION_CONFLICT',
          `Enrollment has moved to version ${error.currentVersion}.`,
        );
      }
      throw error;
    }
  }
}
