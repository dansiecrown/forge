# ADR-0006: Curriculum & Learning Engine

**Status:** Accepted
**Date:** 2026-07-26
**Owner:** Lead Engineering

## Context

Milestone 4's brief asked for the full Curriculum & Learning Engine — Learning Tracks, Courses,
Weekly Modules, Lessons, Learning Resources, Practical Tasks, a sequential-unlock Progression
Engine, mentor-huddle metadata, and the admin UI to author all of it — built end to end (database,
API, admin UI, tests) in one pass, on top of Milestone 3's Organization → Academy → Fellowship →
Cohort → Enrollment foundation.

Two genuine conflicts against `docs/` were found and resolved with the product owner before
implementation began, per the Architecture Lock rule:

1. `docs/database-design.md` and `docs/development-roadmap.md` Phase 6 require curriculum
   publishing to be versioned, with an active cohort referencing an immutable curriculum snapshot
   (`curriculum_version`/`completion_policy_version` fields, "published course immutable except
   through new version," a `POST /fellowships/:id/actions/create-version` fork endpoint, a
   `cohort_week_release` join). The milestone brief never mentions versioning at all — Parts A–D
   describe plain draft/published/archived CRUD. Since Milestone 3 already lets Cohorts exist and
   run against Fellowships, this is not cosmetic: it decides whether editing a Course after a
   Cohort has started immediately changes what already-enrolled learners see. Raised with the
   product owner, who asked for a middle ground: edit in place, but let an admin choose whether an
   edit affects already-running cohorts immediately or only cohorts created from then on. See
   Decision 1.
2. The brief's single "Weekly Module" (Part C: "Each Course contains Weekly Modules. Each module
   represents one fellowship week... Week 1... Week 24") collapses `docs/database-design.md`'s two
   distinct levels — `Module` (an ordered grouping of weeks) and `Week` (the actual weekly
   delivery/release unit). Resolved by building the brief's literal, flatter shape. See Decision 2.

`docs/project-structure.md` already pre-declares the module homes this milestone needs: `catalog`
"owns fellowships, courses, curriculum modules, weeks, lessons, and resources," and a separate
`learning` module is already named in the documented module list for progression — so neither the
new entities nor the progression engine are a surprise addition; only their internal shape required
reconciliation.

## Decisions

1. **Curriculum versioning is realized as a Cohort-level JSON snapshot with an explicit sync
   action, not the documented fork/version-table system.** `Cohort` gains `curriculumSnapshot: Json?`
   and `curriculumSnapshotAt: DateTime?`. A new `CurriculumSnapshotService` (in `catalog`) composes
   the full Track → Course → WeeklyModule → Lesson/Resource/Task tree into this JSON shape. Every
   Learning Track/Course/WeeklyModule/Lesson/LearningResource/PracticalTask edit is always applied
   in place (single source of truth — no parallel duplicate rows, no `curriculum_version` column, no
   fork endpoint). A cohort's snapshot is populated once at creation and is otherwise frozen until a
   new, explicit `POST /cohorts/:id/actions/sync-curriculum` action (permission
   `cohort.curriculum.sync`) regenerates it from current live curriculum state. The Progression
   Engine (Decision 5) reads only this frozen snapshot, never the live catalog tables directly. This
   is the entire "apply to this already-running cohort now" (call sync) vs. "future cohorts only"
   (do nothing — the next cohort created gets the current structure automatically) mechanism the
   product owner asked for, without inverting the one-directional module dependency chain
   (`organizations → catalog → cohorts → learning`) the way a catalog-triggered fan-out write into
   Cohort rows would have required. It is lighter than the documented design specifically because
   certificates and assessments — the actual reason `docs/database-design.md` wants strict
   published-curriculum immutability — remain out of scope this milestone.
2. **`Module` and `Week` are collapsed into one `WeeklyModule`** — one row per week, directly under
   `Course`, uniquely keyed by `(courseId, weekNumber)`. The documented extra grouping level is
   dropped, not deferred as a TODO; it added no value once the brief explicitly and repeatedly asked
   for "Week 1 … Week 24" as the addressable unit. Reordering does not apply at this level — week
   number is the identity and the order.
3. **`LearningTrack` is a genuinely new entity**, not a contradiction of anything documented.
   `PLATFORM_MODEL.md`'s diagram gestures at it (`Enrollment → Learning Track → Course Modules → …`)
   but `docs/database-design.md` never specified it with fields. This ADR is where it gets a
   concrete shape: belongs to `Fellowship`, contains `Course`s, carries `difficulty`,
   `estimatedWeeks`, `prerequisitesMetadata`, `learningOutcomes`, `tags`, and `displayOrder`.
4. **`Assignment`/`Submission` (graded, versioned, rubric- and attempt-tracked, per
   `docs/database-design.md`) is replaced by a much lighter `PracticalTask`/
   `PracticalTaskSubmission`** — no grading, no attempts, no review workflow, a submission upsert
   with no history. This matches the brief's explicit "Do NOT build grading yet" instruction. It is
   not a partial implementation of the documented Assignment system; it is a deliberately narrower
   placeholder. The full Assignment/Submission/Review system remains future (roadmap Phase 9) work.
   `PracticalTask.dueOffsetDays` is relative ("days after this week unlocks for a given enrollment"),
   not an absolute `dueDate`, since the task belongs to the reusable curriculum template — an
   absolute date only makes sense for one specific delivery run (a Cohort), and the template is
   cohort-agnostic.
5. **The Progression Engine (`ProgressionService`, in the new `learning` module) evaluates a fixed
   gate rule, not a generic rules interpreter.** A Weekly Module is satisfied once all of its
   `completionRequired` lessons are completed, all `isRequired` resources are acknowledged, and —
   only when `requiresPracticalWork` is set — all practical tasks in it have a recorded submission.
   `WeeklyModule.unlockRules`, `Course.completionCriteria`, and `PracticalTask.rubricMetadata`/
   `maxScore` are stored metadata for future use, not machine-interpreted this milestone — consistent
   with the brief's own "Do NOT build grading yet." `estimatedCompletionDate` in the progress summary
   is the cohort's own `endsAt`, surfaced directly rather than a fabricated pacing projection.
   Lesson-completion/resource-acknowledgment/practical-task-submission recording is idempotent
   (recording the same lesson complete twice is a no-op, not an error), matching the "completion is
   idempotent" principle `docs/development-roadmap.md` states for the (still out-of-scope) student
   portal — costs nothing extra to honor now.
6. **`Mentor Huddle` is modeled as metadata fields directly on `WeeklyModule`**
   (`huddleScheduleMetadata`, `huddleMeetingLink`, `mentorHuddleNotes`, `huddleAttendanceRequired`,
   plus `requiresMentorHuddle`) — a curriculum-authoring-time template default, not the documented
   per-cohort scheduled entity with its own attendance-evidence table
   (`docs/database-design.md`'s `MentorHuddle`/`Attendance`). This matches the brief's explicit "Do
   NOT implement attendance tracking." Real per-cohort huddle scheduling and attendance evidence
   remain new, documented technical debt (see `docs/KNOWN_TECHNICAL_DEBT.md`).
7. **One shared `curriculum.*` permission namespace** (`curriculum.read/create/update/publish/
   archive/restore`) **covers all six new entity types**, rather than six separate per-resource
   namespaces the way Academy/Fellowship/Cohort each have their own. Unlike those three — which have
   genuinely different actor/permission profiles (e.g., platform-only Organization actions) — all six
   curriculum entities are authored by the same roles (ORG_ADMIN, ACADEMY_ADMIN) with no differing
   profile; six namespaces would have been roughly thirty near-identical keys for zero behavioral
   difference. Two additional narrow keys were added where a genuine distinction exists:
   `cohort.curriculum.sync` (the explicit snapshot-refresh action) and `enrollment.progress.read` /
   `learning.progress.record` (self-scoped for STUDENT, broader for staff via the existing
   `enrollment.read` permission — see Decision 8).
8. **Progress-read authorization reuses the existing `enrollment.read` permission as the
   staff-vs-self distinguishing signal**, rather than inventing a new concept. `enrollment.read` is
   granted to MENTOR/ORG_ADMIN/ACADEMY_ADMIN but not STUDENT; `GET /enrollments/:id/progress` lets a
   caller view their own enrollment's progress unconditionally, and anyone else's only if they hold
   `enrollment.read`. This is the same no-deep-scope simplification already documented as DEBT-015
   (no per-cohort-assignment check for mentors), not new debt.
9. **New dependency: `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities`** for the admin
   UI's drag-and-drop reordering (Learning Tracks within a Fellowship, Courses within a Track,
   Lessons/Resources/Tasks within a WeeklyModule). No drag-and-drop library existed in the repository
   before this milestone (confirmed by searching every `package.json` and the lockfile). Adding one
   is justified because the milestone brief itself explicitly asks for "drag-and-drop ordering where
   appropriate" (Part I) — not a speculative addition. `@dnd-kit` was chosen specifically because its
   built-in keyboard sensor satisfies `docs/product-design-specification.md`'s explicit requirement
   that "drag has keyboard alternative"; the shared `SortableList` component additionally renders
   explicit, always-visible Up/Down buttons as a second, more discoverable non-drag path.
10. **Two live-verified bugs were found and fixed during manual UI walkthrough** (not just API
    testing), per this project's established "run the app before declaring success" standard:
    - **Frontend:** the Learning Track create form's "Difficulty" `<select>` had an empty-string
      placeholder option (`<option value="">Beginner (default)</option>`), but its zod schema used
      `z.enum([...]).optional()`, which accepts `undefined` but rejects an empty string. This
      silently blocked form submission with no visible error (no error message was rendered for that
      field). Fixed by removing the empty option and defaulting the form's `difficulty` field to
      `'beginner'` directly; added the missing inline error-message rendering for that field on both
      the create and detail pages as defense in depth.
    - **Frontend, pre-existing (Milestone 2 code, found here via this milestone's longer,
      multi-step live UI test):** `SessionProvider`'s session-restore effect called
      `refreshSession()` directly in an effect with an empty dependency array. Under React 18/19
      StrictMode (enabled in `main.tsx`, development only), React intentionally double-invokes
      effects on mount (mount → cleanup → mount again), which fired two concurrent
      `refreshSession()` calls carrying the same rotating refresh-token cookie. The first rotated it
      successfully; the second then presented an already-rotated token, which the server's reuse
      detection correctly (but here, falsely) flagged as theft and revoked the entire session —
      silently logging the user back out moments after a successful restore or login, on the very
      next full page navigation. A first fix attempt (a simple "only run once" boolean ref guard)
      introduced a *second* bug: it prevented the duplicate network call, but StrictMode's first
      invocation is cleaned up (its own `cancelled` closure flag flips `true`) before the second
      invocation runs, so skipping the second invocation's call entirely left the successful result
      applied only by the already-cancelled first instance — the app hung on the loading spinner
      forever. The correct fix caches the in-flight *promise* itself in a ref so concurrent effect
      invocations share one network call while each invocation's own `cancelled` closure still
      independently and correctly governs whether it applies the result. See
      `apps/web/src/contexts/session-context.tsx`.

## Consequences

- `docs/database-design.md` remains the schema-design source of truth for the fields it already
  specifies; this ADR is the record of every place the live schema
  (`apps/api/prisma/migrations/20260725221837_curriculum_learning_engine/`) diverges from it and why
  — the doc itself is not rewritten, since the divergences are milestone-specific simplifications,
  not corrections of a wrong prior spec.
- New technical debt opened in `docs/KNOWN_TECHNICAL_DEBT.md`: real per-cohort Mentor Huddle
  scheduling and attendance evidence remain unbuilt (only template-level metadata exists); the full
  curriculum versioning/fork system remains unbuilt in favor of the lighter snapshot mechanism;
  `unlockRules`/`completionCriteria`/`rubricMetadata` are stored but not machine-interpreted.
- No dashboards, certificates, messaging, notifications, analytics, grading, or attendance tracking
  were built — all explicitly out of scope per the milestone brief.
- The session-restore double-refresh fix (Decision 10) touches Milestone 2 code outside this
  milestone's nominal scope. It was fixed rather than merely logged as debt because it is a
  live-verified defect that breaks the basic usability of the very admin UI this milestone
  delivers (losing an in-progress authoring form to an unexpected sign-out), consistent with the
  Architecture Lock rule's "fixing a verified bug" exception to scope discipline, and with
  `docs/ENGINEERING_DECISIONS.md`'s standing precedent of fixing confirmed defects immediately
  once found live rather than deferring them.
