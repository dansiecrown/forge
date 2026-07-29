import { Injectable } from '@nestjs/common';
import type { HuddleAttendanceStatus } from '@prisma/client';
import { CohortsService } from '../../cohorts/services/cohorts.service';
import { EnrollmentsService } from '../../cohorts/services/enrollments.service';
import { MembershipsService } from '../../organizations/services/memberships.service';
import { PermissionResolverService } from '../../organizations/services/permission-resolver.service';
import { AuditLogService } from '../../platform/audit-log.service';
import { AppException } from '../../../shared/errors/app.exception';
import type { TenantScope } from '../../../shared/tenancy/tenant-scope';
import {
  toHuddleAttendanceEntity,
  type HuddleAttendanceEntity,
  type HuddleAttendanceWithWeekEntity,
} from '../entities/huddle-attendance.entity';
import { toHuddleSessionEntity, type HuddleSessionEntity } from '../entities/huddle-session.entity';
import { HuddleAttendanceRepository } from '../repositories/huddle-attendance.repository';
import { HuddleSessionsRepository } from '../repositories/huddle-sessions.repository';
import { assertMentorAssignedToCohort } from '../support/mentor-cohort-scope';

async function requireActiveMembership(
  membershipsService: MembershipsService,
  scope: TenantScope,
  callerId: string,
): Promise<{ id: string }> {
  const membership = await membershipsService.getActiveMembership(scope, callerId);
  if (!membership) {
    throw AppException.validation([
      {
        field: 'callerId',
        code: 'NO_ACTIVE_MEMBERSHIP',
        message: 'You must be an active member of this organization to record huddles.',
      },
    ]);
  }
  return membership;
}

@Injectable()
export class HuddleSessionsService {
  constructor(
    private readonly huddleSessionsRepository: HuddleSessionsRepository,
    private readonly huddleAttendanceRepository: HuddleAttendanceRepository,
    private readonly cohortsService: CohortsService,
    private readonly enrollmentsService: EnrollmentsService,
    private readonly membershipsService: MembershipsService,
    private readonly permissionResolver: PermissionResolverService,
    private readonly auditLog: AuditLogService,
  ) {}

  private assertMentor(scope: TenantScope, callerId: string, cohortId: string): Promise<void> {
    return assertMentorAssignedToCohort(
      this.cohortsService,
      this.membershipsService,
      this.permissionResolver,
      scope,
      callerId,
      cohortId,
    );
  }

  /** `null` means no huddle has been recorded for this cohort/week yet —
   * not a 404, the same "optional by default" convention as `UserProfile`. */
  async getSession(
    scope: TenantScope,
    cohortId: string,
    weekNumber: number,
    callerId: string,
  ): Promise<HuddleSessionEntity | null> {
    await this.assertMentor(scope, callerId, cohortId);
    const row = await this.huddleSessionsRepository.findByCohortAndWeek(cohortId, weekNumber);
    return row ? toHuddleSessionEntity(row) : null;
  }

  async upsertSession(
    scope: TenantScope,
    cohortId: string,
    weekNumber: number,
    callerId: string,
    data: { notes?: string; discussionTopics?: string[]; actionItems?: string[] },
  ): Promise<HuddleSessionEntity> {
    await this.assertMentor(scope, callerId, cohortId);
    const membership = await requireActiveMembership(this.membershipsService, scope, callerId);

    const row = await this.huddleSessionsRepository.upsert(
      scope,
      cohortId,
      weekNumber,
      membership.id,
      data,
    );
    await this.auditLog.record({
      action: 'huddle_session.upserted',
      entityType: 'huddle_session',
      entityId: row.id,
      outcome: 'success',
      organizationId: scope.organizationId,
      actorUserId: callerId,
      metadata: { cohortId, weekNumber },
    });
    return toHuddleSessionEntity(row);
  }

  async recordAttendance(
    scope: TenantScope,
    sessionId: string,
    callerId: string,
    entries: { enrollmentId: string; status: HuddleAttendanceStatus }[],
  ): Promise<HuddleAttendanceEntity[]> {
    const session = await this.huddleSessionsRepository.findById(sessionId);
    if (!session) {
      throw AppException.notFound('Huddle session not found.');
    }
    await this.assertMentor(scope, callerId, session.cohortId);
    const membership = await requireActiveMembership(this.membershipsService, scope, callerId);

    for (const entry of entries) {
      const enrollment = await this.enrollmentsService.get(scope, entry.enrollmentId);
      if (enrollment.cohortId !== session.cohortId) {
        throw AppException.validation([
          {
            field: 'enrollmentId',
            code: 'COHORT_MISMATCH',
            message: 'This learner is not enrolled in this huddle’s cohort.',
          },
        ]);
      }
    }

    const rows = await Promise.all(
      entries.map((entry) =>
        this.huddleAttendanceRepository.upsert(
          sessionId,
          entry.enrollmentId,
          entry.status,
          membership.id,
        ),
      ),
    );
    await this.auditLog.record({
      action: 'huddle_attendance.recorded',
      entityType: 'huddle_session',
      entityId: sessionId,
      outcome: 'success',
      organizationId: scope.organizationId,
      actorUserId: callerId,
      metadata: { count: rows.length },
    });
    return rows.map(toHuddleAttendanceEntity);
  }

  /** Pre-fills the mentor's attendance roster for an already-recorded
   * session — symmetric with `recordAttendance` above. */
  async listAttendanceForSession(
    scope: TenantScope,
    sessionId: string,
    callerId: string,
  ): Promise<HuddleAttendanceEntity[]> {
    const session = await this.huddleSessionsRepository.findById(sessionId);
    if (!session) {
      throw AppException.notFound('Huddle session not found.');
    }
    await this.assertMentor(scope, callerId, session.cohortId);
    const rows = await this.huddleAttendanceRepository.listForSession(sessionId);
    return rows.map(toHuddleAttendanceEntity);
  }

  /** Dual-path read — the learner themselves, or a mentor assigned to their
   * cohort. Feeds both the student's own attendance view and the mentor's
   * student-workspace tab. */
  async listAttendanceForEnrollment(
    scope: TenantScope,
    enrollmentId: string,
    callerId: string,
  ): Promise<HuddleAttendanceWithWeekEntity[]> {
    const enrollment = await this.enrollmentsService.get(scope, enrollmentId);
    if (enrollment.userId !== callerId) {
      await this.assertMentor(scope, callerId, enrollment.cohortId);
    }
    const rows = await this.huddleAttendanceRepository.listForEnrollment(enrollmentId);
    return rows.map((row) => ({
      ...toHuddleAttendanceEntity(row),
      weekNumber: row.huddleSession.weekNumber,
    }));
  }
}
