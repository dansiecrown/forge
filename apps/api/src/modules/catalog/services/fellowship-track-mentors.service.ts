import { Injectable } from '@nestjs/common';
import { UsersService } from '../../identity/services/users.service';
import { MembershipsService } from '../../organizations/services/memberships.service';
import { AuditLogService } from '../../platform/audit-log.service';
import { AppException } from '../../../shared/errors/app.exception';
import type { TenantScope } from '../../../shared/tenancy/tenant-scope';
import {
  toFellowshipTrackMentorEntity,
  type FellowshipTrackMentorEntity,
} from '../entities/fellowship-track-mentor.entity';
import { FellowshipTrackMentorsRepository } from '../repositories/fellowship-track-mentors.repository';
import { LearningTracksService } from './learning-tracks.service';

/** Fellowship-wide, per-track mentor assignment — a mentor assigned here
 * can see/review students on this track across every Cohort of the
 * Fellowship that offers it, independent of any single Cohort's own
 * mentor roster (`CohortMentor`, unaffected by this service). See
 * docs/adr/0016-cohort-scoped-tracks.md Decisions 2–3. */
@Injectable()
export class FellowshipTrackMentorsService {
  constructor(
    private readonly repository: FellowshipTrackMentorsRepository,
    private readonly learningTracksService: LearningTracksService,
    private readonly membershipsService: MembershipsService,
    private readonly usersService: UsersService,
    private readonly auditLog: AuditLogService,
  ) {}

  async list(scope: TenantScope, learningTrackId: string): Promise<FellowshipTrackMentorEntity[]> {
    await this.learningTracksService.get(scope, learningTrackId);
    const rows = await this.repository.listByTrack(learningTrackId);
    return rows.map((row) => toFellowshipTrackMentorEntity(row, row.membership.user));
  }

  async assign(
    scope: TenantScope,
    learningTrackId: string,
    membershipId: string,
    actorUserId: string,
  ): Promise<FellowshipTrackMentorEntity> {
    const track = await this.learningTracksService.get(scope, learningTrackId);
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

    const existing = await this.repository.findActive(
      track.fellowshipId,
      learningTrackId,
      membershipId,
    );
    if (existing) {
      throw AppException.conflict(
        'ALREADY_ASSIGNED',
        'This mentor is already assigned to this track.',
      );
    }

    const assignment = await this.repository.assign(
      track.fellowshipId,
      learningTrackId,
      membershipId,
    );
    await this.auditLog.record({
      action: 'fellowship.track_mentor_assigned',
      entityType: 'learning_track',
      entityId: learningTrackId,
      outcome: 'success',
      organizationId: scope.organizationId,
      actorUserId,
      metadata: { membershipId, fellowshipId: track.fellowshipId },
    });
    const user = await this.usersService.getById(membership.userId);
    return toFellowshipTrackMentorEntity(assignment, user);
  }

  async unassign(
    scope: TenantScope,
    learningTrackId: string,
    membershipId: string,
    actorUserId: string,
  ): Promise<void> {
    const track = await this.learningTracksService.get(scope, learningTrackId);
    const { count } = await this.repository.unassign(
      track.fellowshipId,
      learningTrackId,
      membershipId,
    );
    if (count === 0) {
      throw AppException.notFound('This mentor is not currently assigned to this track.');
    }
    await this.auditLog.record({
      action: 'fellowship.track_mentor_unassigned',
      entityType: 'learning_track',
      entityId: learningTrackId,
      outcome: 'success',
      organizationId: scope.organizationId,
      actorUserId,
      metadata: { membershipId, fellowshipId: track.fellowshipId },
    });
  }

  /** Not exposed over HTTP — the mentor-portal access-narrowing check
   * (`learning` module's mentor-scope helper) uses this to decide whether a
   * mentor who has *no* cohort-wide `CohortMentor` assignment can still see
   * a given student, via a track-level assignment instead. Returns
   * `{fellowshipId, learningTrackId}` pairs, not full entities — the
   * caller only ever needs to match them against an Enrollment's own
   * `fellowshipId`/`currentLearningTrackId`. */
  async listActiveAssignmentsForMembership(
    membershipId: string,
  ): Promise<{ fellowshipId: string; learningTrackId: string }[]> {
    const rows = await this.repository.listActiveForMembership(membershipId);
    return rows.map((row) => ({
      fellowshipId: row.fellowshipId,
      learningTrackId: row.learningTrackId,
    }));
  }
}
