import { Injectable } from '@nestjs/common';
import { CohortsService } from '../../cohorts/services/cohorts.service';
import { EnrollmentsService } from '../../cohorts/services/enrollments.service';
import { MembershipsService } from '../../organizations/services/memberships.service';
import { PermissionResolverService } from '../../organizations/services/permission-resolver.service';
import { AuditLogService } from '../../platform/audit-log.service';
import { AppException } from '../../../shared/errors/app.exception';
import type { TenantScope } from '../../../shared/tenancy/tenant-scope';
import { toMentorNoteEntity, type MentorNoteEntity } from '../entities/mentor-note.entity';
import {
  MentorNoteVersionConflictError,
  MentorNotesRepository,
} from '../repositories/mentor-notes.repository';
import { assertMentorAssignedToCohort } from '../support/mentor-cohort-scope';

/** Team-visible within a cohort's assigned mentors — any assigned mentor can
 * read/edit/delete any note about a shared student, not author-only. Never
 * exposed to any student-facing route. Every mutation is audit-logged, which
 * is what "private and audited" actually protects — see
 * docs/adr/0008-mentor-experience.md Decision 6. */
@Injectable()
export class MentorNotesService {
  constructor(
    private readonly mentorNotesRepository: MentorNotesRepository,
    private readonly enrollmentsService: EnrollmentsService,
    private readonly cohortsService: CohortsService,
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

  async list(
    scope: TenantScope,
    enrollmentId: string,
    callerId: string,
  ): Promise<MentorNoteEntity[]> {
    const enrollment = await this.enrollmentsService.get(scope, enrollmentId);
    await this.assertMentor(scope, callerId, enrollment.cohortId);
    const rows = await this.mentorNotesRepository.list(scope, enrollmentId);
    return rows.map(toMentorNoteEntity);
  }

  async create(
    scope: TenantScope,
    enrollmentId: string,
    body: string,
    callerId: string,
  ): Promise<MentorNoteEntity> {
    const enrollment = await this.enrollmentsService.get(scope, enrollmentId);
    await this.assertMentor(scope, callerId, enrollment.cohortId);
    const membership = await this.membershipsService.getActiveMembership(scope, callerId);
    if (!membership) {
      throw AppException.validation([
        {
          field: 'callerId',
          code: 'NO_ACTIVE_MEMBERSHIP',
          message: 'You must be an active member of this organization to write mentor notes.',
        },
      ]);
    }

    const created = await this.mentorNotesRepository.create(scope, {
      cohortId: enrollment.cohortId,
      enrollmentId,
      authorMembershipId: membership.id,
      body,
    });
    await this.auditLog.record({
      action: 'mentor_note.created',
      entityType: 'mentor_note',
      entityId: created.id,
      outcome: 'success',
      organizationId: scope.organizationId,
      actorUserId: callerId,
      metadata: { enrollmentId },
    });
    return toMentorNoteEntity(created);
  }

  private async loadForMutation(
    scope: TenantScope,
    id: string,
    callerId: string,
  ): Promise<MentorNoteEntity> {
    const row = await this.mentorNotesRepository.findById(scope, id);
    if (!row) {
      throw AppException.notFound('Mentor note not found.');
    }
    await this.assertMentor(scope, callerId, row.cohortId);
    return toMentorNoteEntity(row);
  }

  async update(
    scope: TenantScope,
    id: string,
    body: string,
    expectedVersion: number,
    callerId: string,
  ): Promise<MentorNoteEntity> {
    await this.loadForMutation(scope, id, callerId);
    try {
      const updated = await this.mentorNotesRepository.update(scope, id, body, expectedVersion);
      await this.auditLog.record({
        action: 'mentor_note.updated',
        entityType: 'mentor_note',
        entityId: id,
        outcome: 'success',
        organizationId: scope.organizationId,
        actorUserId: callerId,
      });
      return toMentorNoteEntity(updated);
    } catch (error) {
      throw this.mapVersionConflict(error);
    }
  }

  async delete(
    scope: TenantScope,
    id: string,
    expectedVersion: number,
    callerId: string,
  ): Promise<void> {
    await this.loadForMutation(scope, id, callerId);
    try {
      await this.mentorNotesRepository.softDelete(scope, id, expectedVersion);
      await this.auditLog.record({
        action: 'mentor_note.deleted',
        entityType: 'mentor_note',
        entityId: id,
        outcome: 'success',
        organizationId: scope.organizationId,
        actorUserId: callerId,
      });
    } catch (error) {
      throw this.mapVersionConflict(error);
    }
  }

  private mapVersionConflict(error: unknown): unknown {
    if (error instanceof MentorNoteVersionConflictError) {
      return AppException.conflict(
        'VERSION_CONFLICT',
        `Mentor note has moved to version ${error.currentVersion}.`,
      );
    }
    return error;
  }
}
