# ADR-0017: Per-Cohort Track Switch Grace Period

**Status:** Accepted
**Date:** 2026-09-05
**Owner:** Lead Engineering

## Context

A learner picks a single Learning Track for their Enrollment (`Enrollment.currentLearningTrackId`,
predating this feature). Reported gap: there was no student-facing way to make that first pick at
all outside of staff manually issuing a `PATCH /enrollments/:id`, and no policy for whether — or
until when — a learner could change their mind afterward.

## Decisions

1. **The grace period is a manual admin switch, not a timer.** `Cohort.trackSwitchClosedAt
   DateTime?` is null by default (switching open) or a timestamp an admin explicitly set by calling
   `POST /cohorts/:id/actions/close-track-switching`. There is no duration, deadline, or background
   job — it stays open indefinitely until an admin closes it, and stays closed until an admin
   reopens it (`.../reopen-track-switching`). Chosen directly over a time-boxed duration: the
   product owner's own framing was "a manual switch the admin flips," not a countdown.

2. **The policy is scoped per Cohort, not per Organization.** Each Cohort carries its own
   `trackSwitchClosedAt` independently — closing switching for one Cohort has no effect on any
   other, including sibling Cohorts of the same Fellowship. Reusing `Organization.settings Json?`
   for a single org-wide flag was considered and rejected for this reason; a Cohort-level column is
   the only shape that matches the confirmed policy scope.

3. **Only a *change away from* an already-set track is ever gated — the first pick is always
   allowed**, regardless of `trackSwitchClosedAt`. `EnrollmentsService.selectTrack()` computes
   `isChange = currentLearningTrackId !== null && currentLearningTrackId !== requestedTrackId` and
   only consults the Cohort's grace-period state when `isChange` is true. This matches the
   confirmed requirement precisely: closing the window stops learners from moving between tracks,
   never from making their initial selection (at application time or immediately after joining).
   Reselecting the same track is a no-op (short-circuits before touching the repository or audit
   log), and picking a track outside the Enrollment's own Fellowship is rejected as a validation
   error independent of the grace-period check.

4. **A new self-service endpoint, not an extension of the existing staff-only route.**
   `PATCH /enrollments/:id` remains staff-only (`enrollment.manage`) and unchanged. A learner acts
   on their own Enrollment via the new `POST /enrollments/:id/actions/select-track`, gated by
   `enrollment.progress.read` (already granted org-wide to `STUDENT`) purely to satisfy
   `PermissionsGuard`; real ownership is enforced inside the service
   (`existing.userId !== callerId` → `NOT_FOUND`, the same ownership-as-not-found convention
   `GET /enrollments/me` already uses) rather than by permission key. This mirrors the precedent
   that "can this endpoint be called at all" (permission) and "does the caller own this specific
   row" (service-level ownership check) are deliberately separate layers.

## Consequences

- One new column: `cohorts.track_switch_closed_at TIMESTAMPTZ(3)` (nullable, no default-value
  migration needed — null is the correct historical value for every existing Cohort).
- Two new Cohort actions (`close-track-switching`, `reopen-track-switching`), both
  `cohort.update`, both routed through `CohortsService.get()` first for academy-scope enforcement
  before the mutation — the same convention every other Cohort-mutating service method follows.
- One new Enrollment action (`select-track`) and one new audit action pair
  (`enrollment.track_selected` / `enrollment.track_switched`, distinguished by `isChange`) plus
  `cohort.track_switching_closed` / `cohort.track_switching_reopened`.
- No change to `CurriculumSnapshotService`, `CohortLearningTrack`, or any mentor-facing
  authorization path from ADR-0016 — this feature only touches who may change
  `Enrollment.currentLearningTrackId` and when, not who can see what.
