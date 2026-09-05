# ADR-0008: Mentor Experience

**Status:** Accepted
**Date:** 2026-07-29
**Owner:** Lead Engineering

## Context

Milestone 6's brief asked for the complete mentor-facing layer on top of Milestone 4's Curriculum &
Learning Engine and Milestone 5's Student Experience: a mentor dashboard, cohort workspace (student
roster), student workspace, submission review (approve / request revision), a feedback/review-history
system, weekly huddle + attendance recording, progress monitoring, mentor profile, and settings reuse
— plus, critically, enforcing that mentors can only access cohorts/students/submissions they are
actually assigned to. `CohortMentor` (mentor-to-cohort assignment) already existed from Milestone 3
as an admin feature, but nothing read it for authorization purposes before this milestone — `MENTOR`
held `enrollment.read` organization-wide, with zero cohort-level scoping anywhere in the system.
`docs/development-roadmap.md` Phase 8 states as an explicit acceptance criterion: "Mentors only see
assigned cohorts/learners/submissions" — this was not enforced before this milestone.

Pre-implementation regression check: `pnpm --filter @forge/api test` — 24/24 suites, 133/133 tests
passing. No regressions found, nothing to fix before starting.

Several reconciliations were self-resolved (not escalated, since each follows brief-explicit
instructions or established precedent) and are recorded here per the Architecture Lock rule, the same
way ADR-0006 and ADR-0007 recorded Milestones 4 and 5's:

## Decisions

1. **Weekly Huddles are a deliberately lighter system than `docs/database-design.md` §5's fully
   scheduled design** (title, start/end times, `scheduled → live → completed/cancelled` status,
   meeting type, joining URL, recording asset, recurrence, Calendar Event relationship) and its
   4-value attendance enum (`present|late|absent|excused`). The brief explicitly says "No scheduling
   system. No calendar. No Zoom integration" and asks for a 3-value attendance status. `HuddleSession`
   is one row per `(cohortId, weekNumber)` — keyed off the stable scalar `weekNumber`, not a live
   `WeeklyModule` FK, consistent with the established "cohorts read curriculum only through the
   frozen snapshot" architecture (ADR-0006 Decision 1). Neither `HuddleSession` nor
   `HuddleAttendance` soft-deletes — a huddle record is corrected in place (attendance included,
   tracked via `recordedByMembershipId`/`recordedAt`), not hidden-then-recreated.
2. **Submission Review lifecycle maps directly onto the already-existing
   `PracticalTaskSubmissionStatus` enum** (`draft/submitted/under_review/revision_requested/
   completed`, added in Milestone 5 but only `draft`/`submitted` reachable until this milestone) —
   no schema rename needed. "Resubmitted" is not a new persisted status; it is derived by
   `SubmissionReviewsService.listHistory`: a submission currently `submitted` whose most recent
   `revision_requested` review predates its current `submittedAt` is a resubmission. "Approved" maps
   to the existing `completed` value, labeled "Approved" in the API/UI layer only.
   **Required correctness fix** (same class as Milestone 5's own required draft-vs-submitted gate
   fix): `reviewDecisionUpdate()` (exported from `practical-task-submissions.repository.ts`, shared
   by `PracticalTaskSubmissionsRepository.applyReviewDecision` and
   `SubmissionReviewsRepository.recordDecision`'s transaction so the mapping exists exactly once) —
   `approved` → `status: completed`; `revision_requested` → `status: revision_requested` **and**
   `submittedAt: null`. Clearing `submittedAt` is what makes the pre-existing
   `ProgressionService.buildContext`'s `submittedAt !== null` gate check re-lock the module with zero
   duplicated logic — the single source of truth for "is this task satisfied" stays exactly where it
   already lived. Symmetric with `saveDraft`'s existing "editing reverts to draft" precedent. This is
   the single most important behavior in the milestone and has its own named regression test
   (`progression.service.spec.ts` — "re-locks module 2 when a revision is requested, and re-unlocks
   it on resubmission").
3. **Mentor cohort-scoping is mandatory, not optional, and required tightening existing Milestone
   4/5 code — not just adding a parallel check to new endpoints.** `docs/development-roadmap.md`
   Phase 8's "mentors only see assigned cohorts" is a real, documented acceptance criterion, not just
   the brief's own ask. New helper `apps/api/src/modules/learning/support/mentor-cohort-scope.ts`
   (`assertMentorAssignedToCohort`) bypasses on the caller holding `enrollment.manage` (confirmed
   granted only to `ORG_ADMIN`/`ACADEMY_ADMIN`, never `MENTOR` — deliberately not `enrollment.read`,
   which `MENTOR` already holds organization-wide and would defeat the scoping entirely), otherwise
   resolves the caller's active membership and checks `CohortsService.hasActiveMentorAssignment`
   (wrapping the already-existing `CohortsRepository.findActiveMentorAssignment` — no new repository
   method needed for that half; the reverse lookup, `listActiveForMentor`, was genuinely new).
   `ProgressionService.assertCanRead` — the sole choke point every read of a learner's progress flows
   through (`buildContext`, `getProgress`, and by extension every `StudentCurriculumController`
   route) — was **tightened** from a bare self-or-org-wide-`enrollment.read` check to
   self-or-`enrollment.manage`-or-cohort-assigned-mentor, using the same helper. This is a genuine
   behavior change to existing Milestone 4/5 code, not purely additive: it is what makes every mentor
   read of student progress data correctly cohort-scoped, including the endpoints mentors are told to
   reuse rather than duplicate. Verified with a dedicated test: a mentor holding org-wide
   `enrollment.read`/`enrollment.progress.read` at the guard layer but *not* assigned to a given
   cohort is still rejected at the service layer — the actual Phase 8 acceptance criterion. See
   `docs/KNOWN_TECHNICAL_DEBT.md` DEBT-015, updated to note MENTOR's cohort-scoping gap is now closed
   (`ACADEMY_ADMIN`'s academy-scoping gap remains separate, unresolved debt).
4. **`StudentProfile` is renamed to `UserProfile`, gaining an `availability` column, rather than
   building a second near-identical profile table for mentors.** The Milestone 5 entity (bio, skills,
   interests, GitHub/LinkedIn/website URLs, `learningPreferencesMetadata`) was already functionally
   generic — nothing about it was student-specific except its name — and Mentor Profile needs the
   same shape plus one additional field ("Availability"). Renamed throughout
   (`UserProfilesRepository`/`UserProfilesService`/`UserProfileEntity`/`@forge/api-contract`'s
   `user-profile.ts`); the route stays `/me/profile`, unchanged. `skills` is relabeled "Areas of
   Expertise" for the mentor variant of `ProfileForm` — same underlying field, no schema or API
   change, purely a UI label keyed off a new `variant: 'student' | 'mentor'` prop. Migration
   hand-written as a pure `ALTER TABLE ... RENAME TO ...` (plus the new column), not Prisma's default
   destructive drop/recreate diff — preserves existing rows and the underlying `student_profiles_*`-
   named constraints/indexes, which Postgres and Prisma both work correctly with despite the
   cosmetic name mismatch. No avatar upload — "No uploads" per brief — a deterministic
   initials-circle (`AvatarPlaceholder`, hashed from display name to a stable hue) stands in, needing
   no schema change.
5. **An assigned mentor can read all of a student's portfolio projects, private and public alike** —
   an otherwise-undocumented gap, resolved by observation rather than guesswork: portfolio projects
   are sourced only from already-submitted practical tasks the mentor already has full review access
   to, so this exposes no new information a mentor couldn't already see via the submission itself.
   `PortfolioProjectsService.listForMentor` reuses the existing `list()` repository call unchanged
   (visibility was never filtered at the repository layer to begin with) behind the same
   `assertMentorAssignedToCohort` gate, exposed on a route kept separate from the student's own
   (`GET /mentors/students/:enrollmentId/portfolio-projects`) rather than changing
   `PermissionsGuard`'s all-required-permissions semantics to support an "either/or" check.
6. **At-risk/inactive/falling-behind heuristics are simple, transparent, reason-carrying
   computations over existing progression timestamps — never a bare score.**
   `docs/development-roadmap.md` explicitly lists "approved risk/at-risk definitions" as a pending
   dependency, not a spec being contradicted, so this is a placeholder pending product-approved
   criteria (recorded in `docs/KNOWN_TECHNICAL_DEBT.md`), not a guess presented as fact. Two
   independent signals, computed on read (`learning-stats.util.ts`): `isInactive` (no
   completion/acknowledgment/submission event in 7+ days, reusing the same event rows
   `computeStreakDays` already reads) and `isFallingBehindCohortMedian` (15+ percentage points below
   the cohort's median progress, computed once per cohort-roster read and reused across every
   student in it — not repeated per student). Every `atRisk: true` is paired with a plain-language
   `atRiskReason` string naming which signal(s) fired and by how much; the single-student workspace
   view (`MentorWorkspaceService.getStudentWorkspace`) deliberately omits the cohort-median
   comparison to avoid re-scanning the whole cohort for one student — its at-risk flag is
   inactivity-only, with its own distinct reason text. Mentor notes are **team-visible within a
   cohort's assigned mentors**, not author-private — any assigned mentor can read, edit, or delete
   any note about a shared student, matching a shared-context "team notebook" rather than an ACL;
   every create/update/delete is audit-logged (`mentor_note.created/updated/deleted`), which is what
   "private and audited" actually protects — notes never reach any student-facing route regardless of
   who authored them.

Two small additive read endpoints, not present in the original implementation plan, were added
during frontend build-out once the exact data the Mentor Portal UI needed became concrete — both
follow the same authorization pattern as their siblings, so neither is a new architectural decision:

- `GET /practical-task-submissions/:id` (`SubmissionReviewsService.getDetail`) — the Submission
  Review page must work as a standalone deep link (`/mentor/submissions/:submissionId`) with no prior
  navigation state; the review queue alone did not carry the submission's repo/demo URLs.
- `GET /mentors/huddles/:sessionId/attendance` (`HuddleSessionsService.listAttendanceForSession`) —
  symmetric with the existing `PUT` of the same shape, needed to pre-fill the mentor's attendance
  roster for an already-recorded huddle rather than always defaulting every student to "present."

## Consequences

- `docs/database-design.md` remains the schema-design source of truth for the fields it already
  specifies for the fuller scheduled-huddle and rubric-scored/attempt-versioned review systems; this
  ADR is the record of where the live schema
  (`apps/api/prisma/migrations/20260727171814_mentor_experience/`) diverges and why — the doc itself
  is not rewritten, since the divergences are milestone-specific simplifications, not corrections of
  a wrong prior spec.
- New technical debt opened in `docs/KNOWN_TECHNICAL_DEBT.md`: no rubric scoring, no attempt-versioned
  resubmission history (a resubmission overwrites the same row, matching Milestone 5's existing
  submission-editing precedent), huddles remain unscheduled with 3-value attendance only, at-risk
  heuristics are simple/placeholder pending product-approved criteria, mentor notes are team-visible
  rather than per-author-private. DEBT-023 (`under_review` unreachable) is narrowed, not closed — the
  brief's review lifecycle has no "claimed for review" step, a mentor decides atomically, so
  `under_review` stays intentionally unreachable. DEBT-015 updated: MENTOR's cohort-scoping gap is
  closed; `ACADEMY_ADMIN`'s academy-scoping gap remains separate, unresolved debt.
- No Certificates, Messaging, notification backend, Redis/BullMQ/queues, object storage, calendar or
  video-conferencing integration, or Super Admin improvements were built — all explicitly out of
  scope per the milestone brief.
- The `ProgressionService.assertCanRead` tightening (Decision 3) is a standing authorization-model
  change, not just an implementation detail — every future milestone that adds a new staff-facing
  progress read inherits cohort-scoping automatically by going through `buildContext`, rather than
  needing to remember to add the check itself.
