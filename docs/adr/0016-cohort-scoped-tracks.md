# ADR-0016: Cohort-Scoped Learning Tracks and Fellowship-Wide Track Mentors

**Status:** Accepted
**Date:** 2026-09-05
**Owner:** Lead Engineering

## Context

Two related gaps reported directly: (1) every Cohort of a Fellowship implicitly offered the exact
same full set of Learning Tracks — `CurriculumSnapshotService.build()` snapshotted every track
under the Fellowship onto every Cohort, with no way for two Cohorts of the same Fellowship to offer
different tracks; (2) mentor assignment was Cohort-wide only (`CohortMentor`) — there was no way to
assign a mentor to one specific Learning Track, and no mechanism for such an assignment to narrow
what students that mentor can see.

## Decisions

1. **A Cohort selects a subset of its Fellowship's Learning Tracks to offer, via a new
   `CohortLearningTrack` join table** (`PUT /cohorts/:id/tracks`, replace-all semantics). Tracks
   themselves stay authored once at the Fellowship level — nothing about curriculum ownership
   moved. An empty selection (including every Cohort created before this feature existed) falls
   back to "every Fellowship track," preserving `CurriculumSnapshotService.build()`'s prior
   behavior exactly — the fallback lives in `build()` itself, keyed on whether any
   `CohortLearningTrack` rows exist for that Cohort, not in the API response (`GET /cohorts/:id/tracks`
   returns the true, possibly-empty selection either way, so the frontend can show "no explicit
   selection" honestly rather than fabricating a fake "all tracks" list).

2. **A new `FellowshipTrackMentor` assignment (`membershipId` + `fellowshipId` + `learningTrackId`)
   is Fellowship-wide, not Cohort-scoped, and independent of `CohortMentor`.** "Mentor X handles
   Track A" applies across every Cohort of that Fellowship running Track A — a Cohort-wide mentor
   assignment (`CohortMentor`) is unaffected and keeps meaning exactly what it always meant ("this
   mentor sees this whole Cohort"). Reuses the existing `cohort.mentor.manage` permission rather
   than adding a new key — it's the same "who manages mentor assignments" capability.

3. **A track assignment genuinely narrows visibility, not just labels it.** Every mentor-facing
   per-student read (the roster, a student's workspace, mentor notes, portfolio, submission review)
   now resolves access as: full (admin, or an active `CohortMentor` row) **or** track-matched (an
   active `FellowshipTrackMentor` row whose Fellowship+Track matches the student's own Enrollment).
   A mentor with only a track assignment sees only students actually enrolled on that track — never
   the whole Cohort — and the Mentor Portal's own "my cohorts" list surfaces a Cohort they have no
   `CohortMentor` row for at all, as long as at least one of its enrolled students is on their
   track. This is a genuine, disclosed authorization change to five existing services
   (`ProgressionService`, `SubmissionReviewsService`, `PortfolioProjectsService`,
   `MentorNotesService`, `MentorWorkspaceService`) — every one of them now resolves access through
   `resolveMentorCohortAccess`/`assertMentorCanAccessEnrollment`
   (`learning/support/mentor-cohort-scope.ts`) instead of the older cohort-only binary check,
   which is kept, unchanged, only for genuinely Cohort-wide actions (`HuddleSessionsService` — a
   huddle covers the whole Cohort, not one student) and for `SubmissionReviewsService.recordDecision`
   specifically, which deliberately has no self-access bypass (a student can never review their own
   submission, track access or not).

4. **Track-mentor discovery matches on either signal, not just the Cohort's explicit
   offering.** `Enrollment.currentLearningTrackId` (an existing, independent field predating this
   feature) is never constrained to a track the Cohort has explicitly opted into via
   `CohortLearningTrack` — so "which cohorts can this track mentor discover" checks both: the
   Cohort's own offered-tracks declaration, *or* a real Enrollment already on that track. Found via
   live verification, not assumed: an early version of this feature let a track mentor's roster
   query return the right (narrowed) students for a Cohort ID they already had, while the "my
   cohorts" list failed to surface that same Cohort at all, because nobody had also called
   `PUT /cohorts/:id/tracks` to register the offering. Fixed before shipping.

## Consequences

- Two new tables (`CohortLearningTrack`, `FellowshipTrackMentor`), no changes to any existing
  table. No new permissions.
- New endpoints: `GET/PUT /cohorts/:id/tracks`, `GET/POST /learning-tracks/:id/mentors`,
  `DELETE /learning-tracks/:id/mentors/:membershipId`.
- `CatalogModule` now exports `FellowshipTrackMentorsService`; `CohortsModule` and `CatalogModule`
  both gained `IdentityModule` as an import (for the same name-resolution batch-lookup pattern
  ADR-0015 established) — no circular dependency, since `IdentityModule` doesn't import either.
- The Mentor Portal's frontend needed no changes to *consume* the narrowed data — `listStudents`/
  `listMyCohorts` already return correctly-scoped results, so the existing roster/dashboard pages
  display them correctly with zero changes. The only new frontend surface is the two *management*
  additions: a Cohort's "Learning Tracks" section (`CohortDetailPage`) and a Track's "Track
  mentors" section (`LearningTrackDetailPage`), both following the existing list-then-edit pattern.
- The three-column "who can see what" mental model is now: Fellowship (broadest — Org/Academy
  Admin, or any Cohort-wide/track mentor) → Cohort (`CohortMentor`) → Track-within-Fellowship
  (`FellowshipTrackMentor`) → Enrollment (the student themselves). No fourth "Cohort+Track" scoped
  assignment was added — Decision 2 deliberately keeps track assignment Fellowship-wide, not
  duplicated per Cohort.
