// Hand-authored request/response contracts for the Cohorts and Enrollments
// endpoints (docs/api-specification.md §4.6, cohort/enrollment/mentor-
// assignment only — huddles/attendance are out of scope for Milestone 3).

export interface Cohort {
  id: string;
  organizationId: string;
  academyId: string;
  fellowshipId: string;
  name: string;
  slug: string;
  status: 'draft' | 'enrolling' | 'active' | 'paused' | 'completed' | 'archived';
  startsAt: string;
  endsAt: string;
  timezone: string;
  capacity: number;
  description: string | null;
  enrollmentDeadline: string | null;
  /** Frozen curriculum read-model — see docs/adr/0006-curriculum-learning-engine.md. */
  curriculumSnapshot: unknown;
  curriculumSnapshotAt: string | null;
  /** Null (default) means a learner may still switch their own enrolled
   * track after their first pick — see
   * docs/adr/0017-track-switch-grace-period.md. */
  trackSwitchClosedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCohortRequest {
  fellowshipId: string;
  name: string;
  slug: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  capacity: number;
  description?: string;
  enrollmentDeadline?: string;
}

export interface UpdateCohortRequest {
  name?: string;
  startsAt?: string;
  endsAt?: string;
  timezone?: string;
  capacity?: number;
  description?: string;
  enrollmentDeadline?: string;
  status?: 'enrolling' | 'archived';
}

export interface ListCohortsParams {
  fellowshipId?: string;
  academyId?: string;
  status?: string;
  q?: string;
  cursor?: string;
  limit?: number;
}

export interface CohortMentorAssignment {
  id: string;
  cohortId: string;
  membershipId: string;
  /** Resolved server-side — see docs/adr/0015-name-first-display.md. */
  userDisplayName: string;
  userEmail: string;
  assignedAt: string;
}

export interface Enrollment {
  id: string;
  organizationId: string;
  academyId: string;
  fellowshipId: string;
  cohortId: string;
  userId: string;
  /** Resolved server-side — see docs/adr/0015-name-first-display.md. Null
   * only in the edge case of a since-removed user record. */
  userDisplayName: string | null;
  userEmail: string | null;
  status: 'invited' | 'active' | 'paused' | 'completed' | 'withdrawn';
  /** The learner's single active Learning Track within this Fellowship. */
  currentLearningTrackId: string | null;
  /** Resolved server-side, and — unlike `userDisplayName`/`userEmail` above
   * — only ever populated by `GET /enrollments/me`, never the staff-facing
   * cohort roster (`GET /cohorts/:id/enrollments`); null there. Powers the
   * student Profile/Dashboard "which Org/Academy/Fellowship/Cohort/Track am
   * I in" display — see docs/adr/0015-name-first-display.md. */
  organizationName: string | null;
  academyName: string | null;
  fellowshipTitle: string | null;
  cohortName: string | null;
  currentLearningTrackName: string | null;
  invitedAt: string;
  joinedAt: string | null;
  endedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEnrollmentRequest {
  studentUserId: string;
}

// `status` is optional so a PATCH can change just `currentLearningTrackId`
// without also transitioning lifecycle status.
export interface UpdateEnrollmentRequest {
  status?: 'invited' | 'active' | 'paused' | 'completed' | 'withdrawn';
  currentLearningTrackId?: string;
  reason?: string;
}

/** Replace-all — see docs/adr/0016-cohort-scoped-tracks.md Decision 1. An
 * empty list clears the cohort's selection, which falls back to offering
 * every track under the Fellowship (the pre-existing behavior). */
export interface SetCohortTracksRequest {
  learningTrackIds: string[];
}

/** Self-service pick/switch — see docs/adr/0017-track-switch-grace-period.md.
 * The first pick is never gated; a change away from an already-set track
 * is rejected once the cohort's `trackSwitchClosedAt` is set. */
export interface SelectEnrollmentTrackRequest {
  learningTrackId: string;
}
