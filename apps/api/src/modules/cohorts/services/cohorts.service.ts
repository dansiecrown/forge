import { Injectable } from '@nestjs/common';
import { FellowshipsService } from '../../catalog/services/fellowships.service';
import { MembershipsService } from '../../organizations/services/memberships.service';
import { AuditLogService } from '../../platform/audit-log.service';
import { AppException } from '../../../shared/errors/app.exception';
import { CollectionResult, parseLimit } from '../../../shared/pagination/collection-result';
import type { TenantScope } from '../../../shared/tenancy/tenant-scope';
import { toCohortMentorEntity, type CohortMentorEntity } from '../entities/cohort-mentor.entity';
import { toCohortEntity, type CohortEntity } from '../entities/cohort.entity';
import type { CreateCohortDto, UpdateCohortDto } from '../dtos/cohort.dto';
import { CohortsRepository, CohortVersionConflictError } from '../repositories/cohorts.repository';

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  draft: ['enrolling'],
  enrolling: ['active'],
  active: ['paused', 'completed'],
  paused: ['active', 'completed'],
  completed: ['archived'],
  archived: [],
};

@Injectable()
export class CohortsService {
  constructor(
    private readonly cohortsRepository: CohortsRepository,
    private readonly fellowshipsService: FellowshipsService,
    private readonly membershipsService: MembershipsService,
    private readonly auditLog: AuditLogService,
  ) {}

  async list(
    scope: TenantScope,
    options: {
      fellowshipId?: string;
      academyId?: string;
      status?: string;
      q?: string;
      cursor?: string;
      limit?: string;
    },
  ): Promise<CollectionResult<CohortEntity>> {
    const limit = parseLimit(options.limit);
    const { rows, hasMore } = await this.cohortsRepository.list(scope, {
      fellowshipId: options.fellowshipId,
      academyId: options.academyId,
      status: options.status as never,
      q: options.q,
      cursor: options.cursor,
      limit,
    });
    return new CollectionResult(rows.map(toCohortEntity), {
      nextCursor: hasMore ? rows[rows.length - 1].id : null,
      previousCursor: options.cursor ?? null,
      limit,
      hasMore,
    });
  }

  async get(scope: TenantScope, id: string): Promise<CohortEntity> {
    const cohort = await this.cohortsRepository.findById(scope, id);
    if (!cohort) {
      throw AppException.notFound('Cohort not found.');
    }
    return toCohortEntity(cohort);
  }

  /** Existence + org-scope check for the enrollments flow below — not
   * exposed over HTTP directly. */
  async assertExists(scope: TenantScope, cohortId: string): Promise<CohortEntity> {
    return this.get(scope, cohortId);
  }

  async create(
    scope: TenantScope,
    input: CreateCohortDto,
    actorUserId?: string,
  ): Promise<CohortEntity> {
    const fellowship = await this.fellowshipsService.assertOpenForCohortCreation(
      scope,
      input.fellowshipId,
    );

    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(input.endsAt);
    if (endsAt <= startsAt) {
      throw AppException.validation([
        { field: 'endsAt', code: 'INVALID_CHRONOLOGY', message: 'endsAt must be after startsAt.' },
      ]);
    }

    const existing = await this.cohortsRepository.findBySlug(
      scope,
      fellowship.academyId,
      input.slug,
    );
    if (existing) {
      throw AppException.conflict(
        'SLUG_TAKEN',
        'This cohort slug is already in use in this academy.',
      );
    }

    const cohort = await this.cohortsRepository.create(scope, {
      academyId: fellowship.academyId,
      fellowshipId: input.fellowshipId,
      name: input.name,
      slug: input.slug,
      startsAt,
      endsAt,
      timezone: input.timezone,
      capacity: input.capacity,
      description: input.description,
      enrollmentDeadline: input.enrollmentDeadline ? new Date(input.enrollmentDeadline) : undefined,
    });

    await this.auditLog.record({
      action: 'cohort.created',
      entityType: 'cohort',
      entityId: cohort.id,
      outcome: 'success',
      organizationId: scope.organizationId,
      actorUserId,
    });
    return toCohortEntity(cohort);
  }

  async update(
    scope: TenantScope,
    id: string,
    input: UpdateCohortDto,
    expectedVersion: number,
    actorUserId?: string,
  ): Promise<CohortEntity> {
    const existing = await this.get(scope, id);

    const { status: lifecycleStatus, ...fields } = input;
    const data: Record<string, unknown> = { ...fields };
    if (fields.startsAt) data.startsAt = new Date(fields.startsAt);
    if (fields.endsAt) data.endsAt = new Date(fields.endsAt);
    if (fields.enrollmentDeadline) data.enrollmentDeadline = new Date(fields.enrollmentDeadline);

    if (data.startsAt || data.endsAt) {
      const startsAt = (data.startsAt as Date | undefined) ?? existing.startsAt;
      const endsAt = (data.endsAt as Date | undefined) ?? existing.endsAt;
      if (endsAt <= startsAt) {
        throw AppException.validation([
          {
            field: 'endsAt',
            code: 'INVALID_CHRONOLOGY',
            message: 'endsAt must be after startsAt.',
          },
        ]);
      }
    }

    if (lifecycleStatus && !ALLOWED_TRANSITIONS[existing.status]?.includes(lifecycleStatus)) {
      throw AppException.conflict(
        'INVALID_STATE_TRANSITION',
        `Cohort cannot move from ${existing.status} to ${lifecycleStatus}.`,
      );
    }
    if (lifecycleStatus) data.status = lifecycleStatus;

    try {
      const updated = await this.cohortsRepository.update(scope, id, data, expectedVersion);
      await this.auditLog.record({
        action: 'cohort.updated',
        entityType: 'cohort',
        entityId: id,
        outcome: 'success',
        organizationId: scope.organizationId,
        actorUserId,
      });
      return toCohortEntity(updated);
    } catch (error) {
      if (error instanceof CohortVersionConflictError) {
        throw AppException.conflict(
          'VERSION_CONFLICT',
          `Cohort has moved to version ${error.currentVersion}.`,
        );
      }
      throw error;
    }
  }

  private async transition(
    scope: TenantScope,
    id: string,
    nextStatus: 'active' | 'paused' | 'completed',
    expectedVersion: number,
    actorUserId?: string,
  ): Promise<CohortEntity> {
    const existing = await this.get(scope, id);
    if (!ALLOWED_TRANSITIONS[existing.status]?.includes(nextStatus)) {
      throw AppException.conflict(
        'INVALID_STATE_TRANSITION',
        `Cohort cannot move from ${existing.status} to ${nextStatus}.`,
      );
    }
    if (existing.version !== expectedVersion) {
      throw AppException.conflict(
        'VERSION_CONFLICT',
        `Cohort has moved to version ${existing.version}.`,
      );
    }
    const updated = await this.cohortsRepository.updateStatus(id, nextStatus);
    await this.auditLog.record({
      action: `cohort.${nextStatus}`,
      entityType: 'cohort',
      entityId: id,
      outcome: 'success',
      organizationId: scope.organizationId,
      actorUserId,
    });
    return toCohortEntity(updated);
  }

  activate(
    scope: TenantScope,
    id: string,
    expectedVersion: number,
    actorUserId?: string,
  ): Promise<CohortEntity> {
    return this.transition(scope, id, 'active', expectedVersion, actorUserId);
  }

  pause(
    scope: TenantScope,
    id: string,
    expectedVersion: number,
    actorUserId?: string,
  ): Promise<CohortEntity> {
    return this.transition(scope, id, 'paused', expectedVersion, actorUserId);
  }

  complete(
    scope: TenantScope,
    id: string,
    expectedVersion: number,
    actorUserId?: string,
  ): Promise<CohortEntity> {
    return this.transition(scope, id, 'completed', expectedVersion, actorUserId);
  }

  // --- Mentor assignment -----------------------------------------------

  async listMentors(scope: TenantScope, cohortId: string): Promise<CohortMentorEntity[]> {
    await this.get(scope, cohortId);
    const rows = await this.cohortsRepository.listMentors(cohortId);
    return rows.map(toCohortMentorEntity);
  }

  async assignMentor(
    scope: TenantScope,
    cohortId: string,
    membershipId: string,
    actorUserId?: string,
  ): Promise<CohortMentorEntity> {
    await this.get(scope, cohortId);
    const membership = await this.membershipsService.findById(scope, membershipId);
    if (!membership) {
      throw AppException.validation([
        {
          field: 'membershipId',
          code: 'UNKNOWN_MEMBERSHIP',
          message: 'This membership does not belong to the active organization.',
        },
      ]);
    }
    const existing = await this.cohortsRepository.findActiveMentorAssignment(
      cohortId,
      membershipId,
    );
    if (existing) {
      throw AppException.conflict(
        'ALREADY_ASSIGNED',
        'This mentor is already assigned to this cohort.',
      );
    }

    const assignment = await this.cohortsRepository.assignMentor(cohortId, membershipId);
    await this.auditLog.record({
      action: 'cohort.mentor_assigned',
      entityType: 'cohort',
      entityId: cohortId,
      outcome: 'success',
      organizationId: scope.organizationId,
      actorUserId,
      metadata: { membershipId },
    });
    return toCohortMentorEntity(assignment);
  }

  async unassignMentor(
    scope: TenantScope,
    cohortId: string,
    membershipId: string,
    actorUserId?: string,
  ): Promise<void> {
    await this.get(scope, cohortId);
    const { count } = await this.cohortsRepository.unassignMentor(cohortId, membershipId);
    if (count === 0) {
      throw AppException.notFound('This mentor is not currently assigned to this cohort.');
    }
    await this.auditLog.record({
      action: 'cohort.mentor_unassigned',
      entityType: 'cohort',
      entityId: cohortId,
      outcome: 'success',
      organizationId: scope.organizationId,
      actorUserId,
      metadata: { membershipId },
    });
  }
}
