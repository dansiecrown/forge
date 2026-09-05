import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { CurriculumSnapshotService } from '../../catalog/services/curriculum-snapshot.service';
import { FellowshipsService } from '../../catalog/services/fellowships.service';
import { LearningTracksService } from '../../catalog/services/learning-tracks.service';
import { UsersService } from '../../identity/services/users.service';
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
    private readonly curriculumSnapshotService: CurriculumSnapshotService,
    private readonly auditLog: AuditLogService,
    private readonly usersService: UsersService,
    private readonly learningTracksService: LearningTracksService,
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
    callerId: string,
  ): Promise<CollectionResult<CohortEntity>> {
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

    const { rows, hasMore } = await this.cohortsRepository.list(scope, {
      fellowshipId: options.fellowshipId,
      // A restricted caller's own academy always wins over whatever
      // academyId they supplied — the query param is a convenience filter,
      // never a trust boundary.
      academyId: academyScope.restricted ? (academyScope.academyId as string) : options.academyId,
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

  async get(scope: TenantScope, id: string, callerId: string): Promise<CohortEntity> {
    const cohort = await this.cohortsRepository.findById(scope, id);
    if (!cohort) {
      throw AppException.notFound('Cohort not found.');
    }
    const academyScope = await this.membershipsService.getAcademyScope(scope, callerId);
    if (academyScope.restricted && academyScope.academyId !== cohort.academyId) {
      throw AppException.notFound('Cohort not found.');
    }
    return toCohortEntity(cohort);
  }

  /** Existence + org/academy-scope check for the enrollments flow below —
   * not exposed over HTTP directly. */
  async assertExists(
    scope: TenantScope,
    cohortId: string,
    callerId: string,
  ): Promise<CohortEntity> {
    return this.get(scope, cohortId, callerId);
  }

  async create(
    scope: TenantScope,
    input: CreateCohortDto,
    actorUserId: string,
  ): Promise<CohortEntity> {
    const fellowship = await this.fellowshipsService.assertOpenForCohortCreation(
      scope,
      input.fellowshipId,
      actorUserId,
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

    // Every new cohort starts with a fresh snapshot of its fellowship's
    // current curriculum — see docs/adr/0006-curriculum-learning-engine.md
    // Decision 1. This is the "future cohorts only" half of the versioning
    // resolution: no sync call is needed for a cohort that never existed
    // before the edit.
    const snapshot = await this.curriculumSnapshotService.build(scope, input.fellowshipId);

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
      curriculumSnapshot: snapshot as unknown as Prisma.InputJsonValue,
      curriculumSnapshotAt: new Date(),
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
    actorUserId: string,
  ): Promise<CohortEntity> {
    const existing = await this.get(scope, id, actorUserId);

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
    nextStatus: 'active' | 'paused' | 'completed' | 'archived',
    expectedVersion: number,
    actorUserId: string,
  ): Promise<CohortEntity> {
    const existing = await this.get(scope, id, actorUserId);
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
    actorUserId: string,
  ): Promise<CohortEntity> {
    return this.transition(scope, id, 'active', expectedVersion, actorUserId);
  }

  pause(
    scope: TenantScope,
    id: string,
    expectedVersion: number,
    actorUserId: string,
  ): Promise<CohortEntity> {
    return this.transition(scope, id, 'paused', expectedVersion, actorUserId);
  }

  complete(
    scope: TenantScope,
    id: string,
    expectedVersion: number,
    actorUserId: string,
  ): Promise<CohortEntity> {
    return this.transition(scope, id, 'completed', expectedVersion, actorUserId);
  }

  /** No child entity sits below Cohort in the tenant hierarchy, so — unlike
   * Academy/Fellowship archive — this needs no cross-module composition in
   * `AdminModule`; it's a plain named transition, mirroring
   * activate/pause/complete. `archived` was already a valid
   * `ALLOWED_TRANSITIONS.completed` target before this method existed (only
   * reachable via the generic `update()` call) — see
   * docs/adr/0009-administration-platform.md. */
  archive(
    scope: TenantScope,
    id: string,
    expectedVersion: number,
    actorUserId: string,
  ): Promise<CohortEntity> {
    return this.transition(scope, id, 'archived', expectedVersion, actorUserId);
  }

  /** Regenerates this cohort's frozen curriculum snapshot from current live
   * curriculum state — the explicit, admin-triggered "apply to this
   * already-running cohort now" action. See
   * docs/adr/0006-curriculum-learning-engine.md Decision 1. */
  async syncCurriculum(
    scope: TenantScope,
    id: string,
    expectedVersion: number,
    actorUserId: string,
  ): Promise<CohortEntity> {
    const existing = await this.get(scope, id, actorUserId);
    if (existing.version !== expectedVersion) {
      throw AppException.conflict(
        'VERSION_CONFLICT',
        `Cohort has moved to version ${existing.version}.`,
      );
    }
    const snapshot = await this.curriculumSnapshotService.build(scope, existing.fellowshipId, id);
    const updated = await this.cohortsRepository.updateCurriculumSnapshot(
      id,
      snapshot as unknown as Prisma.InputJsonValue,
    );
    await this.auditLog.record({
      action: 'cohort.curriculum_synced',
      entityType: 'cohort',
      entityId: id,
      outcome: 'success',
      organizationId: scope.organizationId,
      actorUserId,
    });
    return toCohortEntity(updated);
  }

  // --- Mentor assignment -----------------------------------------------

  async listMentors(
    scope: TenantScope,
    cohortId: string,
    callerId: string,
  ): Promise<CohortMentorEntity[]> {
    await this.get(scope, cohortId, callerId);
    const rows = await this.cohortsRepository.listMentors(cohortId);
    return rows.map((row) => toCohortMentorEntity(row, row.membership.user));
  }

  async assignMentor(
    scope: TenantScope,
    cohortId: string,
    membershipId: string,
    actorUserId: string,
  ): Promise<CohortMentorEntity> {
    await this.get(scope, cohortId, actorUserId);
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
    const user = await this.usersService.getById(membership.userId);
    return toCohortMentorEntity(assignment, user);
  }

  async unassignMentor(
    scope: TenantScope,
    cohortId: string,
    membershipId: string,
    actorUserId: string,
  ): Promise<void> {
    await this.get(scope, cohortId, actorUserId);
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

  /** Thin wrapper over the existing `findActiveMentorAssignment` repository
   * method — the per-cohort half of mentor-cohort-scope authorization (see
   * `support/mentor-cohort-scope.ts` in the `learning` module). */
  async hasActiveMentorAssignment(cohortId: string, membershipId: string): Promise<boolean> {
    const assignment = await this.cohortsRepository.findActiveMentorAssignment(
      cohortId,
      membershipId,
    );
    return assignment !== null;
  }

  /** The Mentor Portal's own "my cohorts" list — the reverse of
   * `listMentors`. */
  async listMyCohorts(membershipId: string): Promise<CohortEntity[]> {
    const rows = await this.cohortsRepository.listActiveForMentor(membershipId);
    return rows.map(toCohortEntity);
  }

  /** The Fellowship-wide-track-mentor half of "my cohorts" — cohorts this
   * caller has no `CohortMentor` row for at all, reachable only because one
   * of the given tracks is among what that cohort offers. See
   * docs/adr/0016-cohort-scoped-tracks.md Decision 3. */
  async listOfferingTracks(
    scope: TenantScope,
    learningTrackIds: string[],
  ): Promise<CohortEntity[]> {
    const rows = await this.cohortsRepository.listOfferingAnyTrack(
      scope.organizationId,
      learningTrackIds,
    );
    return rows.map(toCohortEntity);
  }

  // --- Track offerings (docs/adr/0016-cohort-scoped-tracks.md) -----------

  async listOfferedTracks(scope: TenantScope, cohortId: string, callerId: string) {
    const cohort = await this.get(scope, cohortId, callerId);
    const trackIds = await this.cohortsRepository.listOfferedTrackIds(cohort.id);
    if (trackIds.length === 0) return [];
    return Promise.all(trackIds.map((trackId) => this.learningTracksService.get(scope, trackId)));
  }

  /** Replace-all — every id must belong to this cohort's own Fellowship, the
   * same check every other cross-entity reference in this module enforces
   * (e.g. `assertOpenForCohortCreation`). An empty list is valid: it clears
   * the cohort's selection, which `CurriculumSnapshotService.build()` reads
   * as "fall back to every Fellowship track" (its pre-existing behavior),
   * not "offer nothing." */
  async setOfferedTracks(
    scope: TenantScope,
    cohortId: string,
    learningTrackIds: string[],
    actorUserId: string,
  ): Promise<void> {
    const cohort = await this.get(scope, cohortId, actorUserId);
    const tracks = await Promise.all(
      learningTrackIds.map((trackId) => this.learningTracksService.get(scope, trackId)),
    );
    const foreign = tracks.find((track) => track.fellowshipId !== cohort.fellowshipId);
    if (foreign) {
      throw AppException.validation([
        {
          field: 'learningTrackIds',
          code: 'TRACK_NOT_IN_FELLOWSHIP',
          message: `Track "${foreign.name}" does not belong to this cohort's Fellowship.`,
        },
      ]);
    }

    await this.cohortsRepository.setOfferedTracks(cohortId, learningTrackIds);
    await this.auditLog.record({
      action: 'cohort.tracks_updated',
      entityType: 'cohort',
      entityId: cohortId,
      outcome: 'success',
      organizationId: scope.organizationId,
      actorUserId,
      metadata: { learningTrackIds },
    });
  }

  // --- Track switch grace period (docs/adr/0017-track-switch-grace-period.md) --

  /** Manual, admin-driven close — no automatic timer. Only gates a learner
   * *changing* an already-set `Enrollment.currentLearningTrackId`; their
   * first pick is never affected (see `EnrollmentsService.selectTrack`). */
  async closeTrackSwitching(
    scope: TenantScope,
    cohortId: string,
    expectedVersion: number,
    actorUserId: string,
  ): Promise<CohortEntity> {
    return this.setTrackSwitchClosedAt(scope, cohortId, new Date(), expectedVersion, actorUserId);
  }

  async reopenTrackSwitching(
    scope: TenantScope,
    cohortId: string,
    expectedVersion: number,
    actorUserId: string,
  ): Promise<CohortEntity> {
    return this.setTrackSwitchClosedAt(scope, cohortId, null, expectedVersion, actorUserId);
  }

  private async setTrackSwitchClosedAt(
    scope: TenantScope,
    cohortId: string,
    trackSwitchClosedAt: Date | null,
    expectedVersion: number,
    actorUserId: string,
  ): Promise<CohortEntity> {
    // Academy-scope enforcement, matching `update()`'s own convention —
    // `CohortsRepository.update()` below only checks organizationId.
    await this.get(scope, cohortId, actorUserId);
    try {
      const updated = await this.cohortsRepository.update(
        scope,
        cohortId,
        { trackSwitchClosedAt },
        expectedVersion,
      );
      await this.auditLog.record({
        action: trackSwitchClosedAt
          ? 'cohort.track_switching_closed'
          : 'cohort.track_switching_reopened',
        entityType: 'cohort',
        entityId: cohortId,
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
}
