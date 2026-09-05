import { FellowshipTrackMentorsService } from '../../catalog/services/fellowship-track-mentors.service';
import { CohortsService } from '../../cohorts/services/cohorts.service';
import { MembershipsService } from '../../organizations/services/memberships.service';
import { PermissionResolverService } from '../../organizations/services/permission-resolver.service';
import { AppException } from '../../../shared/errors/app.exception';
import type { TenantScope } from '../../../shared/tenancy/tenant-scope';

/** Given the caller (a Mentor, or staff acting on a cohort) and a cohort id,
 * asserts the caller is either an org/academy admin (via `enrollment.manage`
 * — deliberately not `enrollment.read`, which MENTOR already holds
 * org-wide and would defeat this scoping entirely) or an actively-assigned
 * mentor of that cohort. Used only where the action is genuinely cohort-wide
 * (a Huddle Session covers the whole cohort, not one student) — see
 * `resolveMentorCohortAccess`/`assertMentorCanAccessEnrollment` below for
 * every per-student read, which a Fellowship-wide track mentor (no
 * `CohortMentor` row at all) must also be able to pass. See
 * docs/adr/0008-mentor-experience.md Decision 3 and
 * docs/adr/0016-cohort-scoped-tracks.md Decision 3. */
export async function assertMentorAssignedToCohort(
  cohortsService: CohortsService,
  membershipsService: MembershipsService,
  permissionResolver: PermissionResolverService,
  scope: TenantScope,
  callerId: string,
  cohortId: string,
): Promise<void> {
  const canManageAnyEnrollment = await permissionResolver.hasPermission(
    callerId,
    scope.organizationId,
    'enrollment.manage',
  );
  if (canManageAnyEnrollment) {
    return;
  }

  const membership = await membershipsService.getActiveMembership(scope, callerId);
  const assigned = membership
    ? await cohortsService.hasActiveMentorAssignment(cohortId, membership.id)
    : false;
  if (!assigned) {
    throw AppException.forbidden('You are not assigned to this cohort.');
  }
}

export interface MentorCohortAccess {
  /** True for an admin (`enrollment.manage`) or a caller with an active
   * `CohortMentor` row — unrestricted view of the whole cohort, same as
   * `assertMentorAssignedToCohort`'s pass condition. */
  fullAccess: boolean;
  /** Meaningful only when `fullAccess` is false: the Learning Track ids
   * this caller's `FellowshipTrackMentor` assignments cover for this
   * cohort's Fellowship. A caller with neither full nor track access never
   * reaches this shape — `resolveMentorCohortAccess` throws instead. */
  trackIds: string[];
}

/** The bulk-read counterpart to `assertMentorAssignedToCohort` — used
 * wherever the caller needs to know *how much* of the cohort they can see
 * (the roster, "my cohorts"), not just whether they may open it at all. A
 * Fellowship-wide track mentor with no cohort-wide assignment passes this
 * (unlike the plain assert above) with `fullAccess: false` and their
 * matching track ids, so the caller can filter results to just those
 * tracks' students. See docs/adr/0016-cohort-scoped-tracks.md Decisions
 * 2–3. */
export async function resolveMentorCohortAccess(
  cohortsService: CohortsService,
  membershipsService: MembershipsService,
  permissionResolver: PermissionResolverService,
  fellowshipTrackMentorsService: FellowshipTrackMentorsService,
  scope: TenantScope,
  callerId: string,
  cohortId: string,
  fellowshipId: string,
): Promise<MentorCohortAccess> {
  const canManageAnyEnrollment = await permissionResolver.hasPermission(
    callerId,
    scope.organizationId,
    'enrollment.manage',
  );
  if (canManageAnyEnrollment) {
    return { fullAccess: true, trackIds: [] };
  }

  const membership = await membershipsService.getActiveMembership(scope, callerId);
  if (!membership) {
    throw AppException.forbidden('You are not assigned to this cohort.');
  }

  const cohortWide = await cohortsService.hasActiveMentorAssignment(cohortId, membership.id);
  if (cohortWide) {
    return { fullAccess: true, trackIds: [] };
  }

  const trackAssignments = await fellowshipTrackMentorsService.listActiveAssignmentsForMembership(
    membership.id,
  );
  const trackIds = trackAssignments
    .filter((assignment) => assignment.fellowshipId === fellowshipId)
    .map((assignment) => assignment.learningTrackId);
  if (trackIds.length === 0) {
    throw AppException.forbidden('You are not assigned to this cohort.');
  }
  return { fullAccess: false, trackIds };
}

/** The per-enrollment counterpart — every mentor-facing read/action that
 * already targets one specific student (mentor notes, portfolio, submission
 * review, progression) reduces to this single call instead of hand-rolling
 * the track-match check itself. Passes for the student's own account, an
 * admin, a cohort-wide mentor, or a track mentor whose track matches this
 * enrollment's `currentLearningTrackId` — a student who hasn't picked a
 * track yet is invisible to a track-only mentor, by construction. */
export async function assertMentorCanAccessEnrollment(
  cohortsService: CohortsService,
  membershipsService: MembershipsService,
  permissionResolver: PermissionResolverService,
  fellowshipTrackMentorsService: FellowshipTrackMentorsService,
  scope: TenantScope,
  callerId: string,
  enrollment: {
    userId: string;
    cohortId: string;
    fellowshipId: string;
    currentLearningTrackId: string | null;
  },
): Promise<void> {
  if (enrollment.userId === callerId) {
    return;
  }
  const access = await resolveMentorCohortAccess(
    cohortsService,
    membershipsService,
    permissionResolver,
    fellowshipTrackMentorsService,
    scope,
    callerId,
    enrollment.cohortId,
    enrollment.fellowshipId,
  );
  if (access.fullAccess) {
    return;
  }
  if (
    enrollment.currentLearningTrackId &&
    access.trackIds.includes(enrollment.currentLearningTrackId)
  ) {
    return;
  }
  throw AppException.forbidden('You are not assigned to this cohort.');
}
