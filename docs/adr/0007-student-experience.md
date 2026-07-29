# ADR-0007: Student Experience

**Status:** Accepted
**Date:** 2026-07-27
**Owner:** Lead Engineering

## Context

Milestone 5's brief asked for the complete student-facing layer on top of Milestone 4's Curriculum &
Learning Engine — dashboard, weekly learning loop, distraction-free lesson reader, resource
browsing/bookmarking, practical task submission, a progress center, a lightweight portfolio,
profile, and settings (theme, MFA, sessions, password, notification preferences) — built end to end
(database, API, portal UI, tests) in one pass. Unlike Milestone 3, this follows the documented
roadmap order correctly (Phase 7, immediately after Phase 6's catalogue/curriculum/cohorts work).

One question was put to the user before implementation began, per the Architecture Lock rule: how to
handle file uploads for Practical Task submissions, since no object-storage infrastructure exists
anywhere in the codebase and the docs place it explicitly in Phase 2 kernel scope as security-
sensitive work (malware scan-gate, retention policy, signed URLs). Resolved: submissions support a
GitHub repository URL and a live demo URL only this milestone (Decision 1).

Several further reconciliations were self-resolved (not escalated, since each was either a
mechanical implementation detail or directly authorized by the brief itself) and are recorded here
per the Architecture Lock rule, the same way ADR-0006 recorded Milestone 4's:

## Decisions

1. **File uploads are deferred to the real `FileAsset`/object-storage system.** Practical Task
   submissions this milestone carry a `repositoryUrl` and `liveDemoUrl` only (typed columns on
   `PracticalTaskSubmission`, replacing the generic `submissionMetadata Json?` going forward — left
   in place rather than dropped, per expand-first migration discipline). This was an explicit
   product-owner decision, not a guess. See `docs/KNOWN_TECHNICAL_DEBT.md`.
2. **A manual dark/light/system theme toggle now exists, superseding ADR-0004's original "no manual
   toggle" stance.** ADR-0004 declined to build one, reasoning it was "a UI feature decision for a
   future milestone, not assumed now" — this milestone's brief explicitly asks for one (Settings ->
   Appearance), which is exactly the future milestone that line anticipated. Implemented as a
   `data-theme` attribute on `<html>` (`ThemeProvider`, `apps/web/src/contexts/theme-context.tsx`),
   persisted to `localStorage`, defaulting to "system" (no override — the existing
   `prefers-color-scheme` media-query blocks in `globals.css` keep governing) unless the learner
   picks Dark or Light explicitly. The two new CSS blocks are verbatim copies of the existing
   dark-default `:root` and light `@media` variable sets, re-scored under a `[data-theme="..."]`
   attribute selector so they win regardless of source order (higher specificity than a bare `:root`
   or a media-scoped `:root`), rather than relying on cascade placement.
3. **Portfolio is a deliberately lighter `PortfolioProject` entity than `docs/database-design.md`
   §6's documented `Portfolio`/`PortfolioItem`/`Project` system** (consent workflow, `unlisted`
   visibility tier, custom theming, SEO metadata) — that fuller system belongs to roadmap Phase 9,
   which also needs Certificates/Projects/Assessments, none of which exist yet. `PortfolioProject`
   has a `private|public` visibility (no `unlisted`), is generated from a specific submitted
   `PracticalTaskSubmission`, and its "public URL" is a stored `publicSlug`
   (`shared/crypto/opaque-token.ts`'s existing `generateOpaqueToken`, reused, no new dependency)
   **never served by a real unauthenticated route** — the brief's own "placeholder only" instruction,
   confirmed live: the frontend renders it as inert copy-only text, not an anchor. Same reconciliation
   pattern as ADR-0006 Decision 4 (Assignment -> PracticalTask): lighter now, full versioned/consent
   system remains Phase 9 debt. `PortfolioProject` is organization-scoped like every other resource in
   the system (no precedent anywhere for a genuinely cross-tenant read) — a student in two
   organizations gets two separate portfolios; building the first cross-tenant-readable resource in
   the system was judged a bigger architectural move than this milestone should make unprompted.
4. **Learning Streak and "time spent learning" are computed on read from data that already exists,
   not tracked via a new event-log table.** No session/activity-tracking infrastructure exists or
   should be built now — that is Phase 11 analytics territory. Streak = count of consecutive local
   calendar days (in the caller's own `User.timezone`, via the runtime's built-in `Intl`, no new date
   library) with at least one lesson-completion/resource-acknowledgment/practical-task-submission
   event. Time spent = sum of `estimatedDurationMinutes` across completed lessons and acknowledged
   resources, surfaced in the API as `estimatedMinutesLearned` — named honestly as an estimate, not
   measured engagement, the same precedent ADR-0006 set for `estimatedCompletionDate` sourcing
   directly from `cohort.endsAt` rather than a fabricated pacing projection.
5. **Practical Task deadlines are computed, not persisted, from the same progression data the gate
   already reads.** `PracticalTask.dueOffsetDays` is relative ("days after this module unlocks"), and
   nothing persists a per-enrollment "module unlocked at" timestamp. `DeadlineService` computes it:
   Module 1 unlocks at `enrollment.joinedAt ?? cohort.startsAt`; Module N (N>1) unlocks at the latest
   completion/acknowledgment/submission timestamp among Module N-1's required items (or is `null` if
   Module N-1 is not yet satisfied); a module with no required items at all is satisfied the instant
   it unlocks. A task's absolute due date = its module's computed unlock date + `dueOffsetDays`.
6. **`PracticalTaskSubmission` gains a `status` enum** (`draft, submitted, under_review,
   revision_requested, completed`) for forward compatibility, but this milestone — which explicitly
   excludes Mentor functionality — can only reach `draft` and `submitted`. Editing an already-
   `submitted` row (only permitted before its computed due date) reverts it to `draft`; the student
   must explicitly re-submit. This keeps the invariant "`status = submitted` implies content
   unchanged since submission" intact for when mentor review starts reading submissions against that
   status. **Required correctness fix to the Progression Engine**: a `draft` row must not satisfy the
   `requiresPracticalWork` gate — only rows with `submittedAt !== null` count as "actually submitted."
   This is a behavior change from Milestone 4 (which treated any submission row's existence as
   satisfying the gate), caught and fixed with a regression test before this milestone shipped.
   `under_review`/`revision_requested`/`completed` remain unreachable pending Mentor Review (a future
   milestone) — see `docs/KNOWN_TECHNICAL_DEBT.md`, same pattern as the existing DEBT-021.
   Portfolio-project creation is gated on `status !== 'draft'` (i.e., submitted at least once) rather
   than literally on the unreachable `completed` value — the brief says "completed Practical Tasks,"
   but "submitted" is the only practically achievable reading this milestone.
7. **Bookmarks are a new lightweight join table** (`ResourceBookmark` — no `organizationId`, no
   `version`, no soft delete, matching the `LessonCompletion`/`ResourceAcknowledgment` precedent of a
   tenant-scope-by-parent, hard-delete-on-toggle join row). "Recently accessed" is read as "most
   recently acknowledged" (reusing `ResourceAcknowledgment` timestamps), not a new view-event-log —
   acknowledging a resource already means the student opened and engaged with it.
8. **Auto-save lesson progress is completion-signal-based, not position-based.** No new scroll/seek-
   position persistence layer was built; "progress" means the existing idempotent completion
   recording (`POST /lessons/:id/actions/complete`, built in Milestone 4) triggered by the student's
   own "Mark complete" action, not a fabricated partial-read tracker.
9. **The Notification Center (header bell + full `/portal/notifications` page) and Settings ->
   Notifications tab are frontend-only placeholders, taken literally from the brief's "UI only... no
   backend notification engine."** No `Notification` Prisma model, no API route, no persistence
   beyond an optional `localStorage` cache for the preference toggles' own continuity. Verified live
   (not just assumed): opening the bell fires zero REST calls to any notification endpoint. Docs'
   fuller `Notification` entity (`database-design.md` §5) and
   `GET/PATCH /notification-preferences` (`api-specification.md` §4.9) are correctly untouched,
   deferred to roadmap Phase 10.
10. **`StudentProfile` is a new, genuinely additive entity** (bio, skills, interests, GitHub/LinkedIn/
    website URLs, `learningPreferencesMetadata`) — none of this exists on `User` or anywhere else
    today. One row per platform identity (`userId`, no `organizationId`), matching
    `docs/ENGINEERING_DECISIONS.md`'s "identity is global" precedent for `User` itself.
    `timezone`/`locale` deliberately stay on `User`, already owned by the existing `PATCH /me`, not
    duplicated. `PATCH /me/profile` deliberately does **not** require an `If-Match` header —
    every other resource's optimistic-concurrency requirement protects against lost updates when
    multiple *different* staff members might edit the same shared resource; a profile has exactly one
    possible writer (the owning student), so that race does not exist. A narrow, documented deviation
    from the version+`If-Match` convention, not an oversight.
11. **The curriculum snapshot's own interfaces were extended with display fields** (`description`,
    `resourceUrl`, `attachmentMetadata`, `dueOffsetDays`, etc. per entity) — not a new table.
    Milestone 4's `CurriculumSnapshotService` deliberately stored only what the progression *gate*
    needed (id/title/order/required-flags/status). A student-facing lesson reader or task detail page
    needs actual content, and fetching that live from catalog tables at read time would have silently
    defeated Milestone 4's whole point: an admin's in-place edit would then reach already-running
    cohorts immediately regardless of whether `sync-curriculum` was called. Every student-facing read
    this milestone sources *only* from `cohort.curriculumSnapshot`, never live catalog tables — a
    natural completion of ADR-0006 Decision 1, not a new mechanism. A cohort whose snapshot predates
    this milestone simply has a thinner snapshot until an admin calls `sync-curriculum` — the
    existing, already-understood recovery path.
12. **Role-aware landing redirect is the only routing-authorization change.** A session whose active
    membership's role set is exactly `{STUDENT}` is redirected from `/` to `/portal`; everyone else's
    existing behavior is untouched. No general RBAC route-guard system was built (that remains
    DEBT-017 / the documented Phase-5 shell's job) — this is the one `if` needed to make the student
    portal reachable, per the brief's explicit instruction not to build one.
13. **A live-verified UI gap was found and fixed during manual walkthrough**: the Weekly Module
    detail page listed required Learning Resources with no way to acknowledge them inline — a student
    could see "required," but the only "Mark complete" action lived on the separate, standalone
    Learning Resources browse page. The underlying acknowledge endpoint and progression gate were
    independently proven correct via a direct, isolated API reproduction (module 2 stayed locked
    until the lesson, resource, *and* task were all satisfied, then unlocked exactly on the resource
    acknowledgment); the missing action was purely a frontend affordance gap on one page, now added,
    matching the Learning Resources page's existing button/handler pattern.
14. **MFA enrollment confirmation and self-service disable were wired, not designed from scratch.**
    `MfaService.verifyEnrollment` and `MfaFactorsRepository.disable` were both already fully
    implemented in Milestone 2 but never reachable from any route — `POST /auth/mfa/confirm-
    enrollment` and `POST /auth/mfa/disable` (the latter backed by a new, small
    `MfaService.disable(userId, code)` requiring a valid current TOTP or recovery code) are pure
    wiring. The enrollment secret is shown as copy-able text plus a manual-entry key, not a QR code
    image — adding a QR-rendering library is a new-dependency decision this milestone does not need
    to make, and the brief asks for "MFA Management," not a specific enrollment UX.

## Consequences

- `docs/database-design.md` remains the schema-design source of truth for the fields it already
  specifies for Portfolio/Notification; this ADR is the record of where the live schema
  (`apps/api/prisma/migrations/20260726232514_student_experience/`) diverges and why — the doc itself
  is not rewritten, since the divergences are milestone-specific simplifications, not corrections of
  a wrong prior spec.
- New technical debt opened in `docs/KNOWN_TECHNICAL_DEBT.md`: file uploads unsupported for
  submissions; three submission statuses unreachable pending Mentor Review; streak/time-spent are
  estimates, not measured engagement; Portfolio has no real public route, consent workflow, or
  versioning; Notification Center/Preferences remain frontend-only placeholders.
- No Mentor functionality, admin improvements, notification backend, or production hardening were
  built — all explicitly out of scope per the milestone brief.
- The manual theme toggle (Decision 2) is a standing design-system change, not just an implementation
  detail — recorded in `docs/ENGINEERING_DECISIONS.md` alongside this ADR since it supersedes a prior
  dated decision (ADR-0004) rather than merely extending unstated ground.
