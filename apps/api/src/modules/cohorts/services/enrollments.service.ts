import { Injectable } from '@nestjs/common';
import { MembershipsService } from '../../organizations/services/memberships.service';
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
    private readonly auditLog: AuditLogService,
  ) {}

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
    return new CollectionResult(rows.map(toEnrollmentEntity), {
      nextCursor: hasMore ? rows[rows.length - 1].id : null,
      previousCursor: options.cursor ?? null,
      limit,
      hasMore,
    });
  }

  async get(scope: TenantScope, id: string): Promise<EnrollmentEntity> {
    const enrollment = await this.enrollmentsRepository.findById(scope, id);
    if (!enrollment) {
      throw AppException.notFound('Enrollment not found.');
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
    actorUserId?: string,
  ): Promise<EnrollmentEntity> {
    const cohort = await this.cohortsService.assertExists(scope, cohortId);

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

  async updateStatus(
    scope: TenantScope,
    id: string,
    input: UpdateEnrollmentDto,
    expectedVersion: number,
    actorUserId?: string,
  ): Promise<EnrollmentEntity> {
    const existing = await this.get(scope, id);
    if (!ALLOWED_TRANSITIONS[existing.status]?.includes(input.status)) {
      throw AppException.conflict(
        'INVALID_STATE_TRANSITION',
        `Enrollment cannot move from ${existing.status} to ${input.status}.`,
      );
    }

    try {
      const updated = await this.enrollmentsRepository.updateStatus(
        id,
        input.status,
        expectedVersion,
      );
      await this.auditLog.record({
        action: 'enrollment.status_changed',
        entityType: 'enrollment',
        entityId: id,
        outcome: 'success',
        organizationId: scope.organizationId,
        actorUserId,
        metadata: { status: input.status, reason: input.reason },
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
