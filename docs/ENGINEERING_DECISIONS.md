# Engineering Decisions

This document is Project Forge's permanent engineering constitution — the standing decisions every future milestone builds on. It does not duplicate implementation detail already recorded in `docs/adr/`; it states *what is decided and why*, and points to the ADR or spec that carries the deeper reasoning. Changing anything here is an architectural decision in its own right and needs a new dated entry (or a superseding ADR), never a silent edit.

Established: 2026-07-24, Architecture Lock milestone. Carries forward decisions already made in Milestones 1–2 and the two prior readiness/infrastructure checkpoints.

---

## Source of truth and process

- **Documentation is the source of truth.** `docs/` governs implementation, not the other way around. When implementation and documentation disagree, the conflict is reported and resolved explicitly — either the code is fixed to match the doc, or the doc is updated to match an implementation that has become the approved standard (as happened with plural table naming, 2026-07-24 — see `docs/database-design.md` and this file's Database section below). Docs are never silently left stale.
- **Milestone-first development.** Work proceeds in the approved sequence in `docs/development-roadmap.md`. A milestone's stated scope is a hard boundary — later-milestone functionality (Organizations, Academies, Fellowships, Cohorts, Courses, dashboards, etc.) is not started early, even opportunistically, even when it would be convenient.
- **Architecture before features.** When technical debt or architectural drift is found, it is evaluated and either fixed (if small and safe) or formally deferred with a reason and a planned milestone (`docs/KNOWN_TECHNICAL_DEBT.md`) — never silently carried forward unrecorded, and never fixed via a large speculative refactor bundled into unrelated work.
- **Security-first engineering.** Authentication, authorization, and tenant-scope correctness are treated as release blockers, not polish. A cross-tenant authorization gap (found and fixed 2026-07-23) is the standing example of the bar: any confirmed cross-tenant or privilege-escalation defect is fixed immediately, verified live against a real database, and documented — not merely noted for later.
- **No new technologies without explicit approval.** The approved stack (below) is closed by default. Adding a framework, database, queue, or major library requires an explicit decision and an ADR, not an incidental choice made while implementing something else.
- **AI-assisted development workflow.** Project Forge is built with an AI coding agent operating under `.claude/CLAUDE.md`'s repository instructions: doc-first (read `/docs` before implementing), scope-disciplined (implement only the requested milestone), and required to stop and report — not guess — when documentation conflicts with implementation or a requirement is ambiguous. Every milestone's changes are verified (lint/format/typecheck/test/build, and live database verification where behavior touches persistence or auth) before being reported complete.

## Platform and infrastructure

- **Docker is the development environment.** `docker-compose.dev.yml` provisions local-only PostgreSQL and Redis on a dedicated network with persistent volumes. It is developer tooling only — staging and production use managed services (`docs/system-architecture.md` §14), never this compose file.
- **PostgreSQL is the primary database**, managed, with UUID primary keys and all timestamps stored as `timestamptz` in UTC. It is the sole transactional source of truth (`docs/adr/` ADR-003 in `system-architecture.md` §16).
- **Redis is reserved for caching, queues, and future asynchronous processing** — provisioned in local dev infrastructure from 2026-07-23 onward, but deliberately not integrated into the application yet. It becomes load-bearing only when a module has a real asynchronous workload (notifications, background jobs); until then it stays present-but-unused rather than wired in speculatively.
- **Prisma is the ORM**, schema-first, with reviewed, checked-in migrations under `apps/api/prisma/migrations/`. Migrations are additive/expand-first by default; a destructive migration is never coupled to the same deploy as code that still depends on the old shape (`docs/system-architecture.md` §14).
- **Modular monolith architecture.** One deployable NestJS API with strict module boundaries (`docs/project-structure.md` §4, §6) — controllers thin, services own use cases, repositories are the only layer touching Prisma, and one module may only use another through its exported service interface, never its repositories or Prisma delegates directly. Service extraction happens only after a measured, real scaling or ownership need, never speculatively.
- **pnpm workspace monorepo.** `apps/*` for deployable applications, `packages/*` for reusable, dependency-light code, one lockfile, one root toolchain. Package manager and workspace layout are fixed; see `docs/project-structure.md` §1–3 for the resolved pnpm-vs-npm-workspaces discrepancy across earlier docs.
- **Shared packages strategy.** A new `packages/*` package is created only once it has a named owner, a stable public API, and at least two independent consumers — not preemptively. `@forge/ui`, `@forge/api-contract`, `@forge/config`, and `@forge/domain-contracts` are pre-scaffolded for their eventual, documented purpose (`docs/project-structure.md` §5); colocating code in `apps/web`/`apps/api` until a package earns its existence is correct, not technical debt.

## Database naming (superseded 2026-07-24)

- **Table names are plural, `snake_case`** (`users`, `roles`, `memberships`, `role_permissions`, …). This supersedes `docs/database-design.md`'s original "singular" rule, which the Identity & Access Control implementation never actually followed (including, inconsistently, in that same document's own FK-reference prose). Renaming 15 live, migrated tables for a cosmetic convention with no functional impact was rejected in favor of updating the documentation to match the standard the implementation had already established. See `docs/database-design.md` §1 and `docs/adr/0003-identity-and-access-control-foundation.md`'s 2026-07-24 addendum.
- **Identity is global; membership is per-organization.** A `User` is one platform-wide identity; a `Membership` is that identity's relationship to exactly one organization. A person can hold memberships in multiple organizations without their identity being duplicated. This was always the schema's design intent (`docs/database-design.md`) but was not correctly implemented in the invitation flow until 2026-07-24 — see ADR-0003's addendum of that date. Any future feature touching "does this person have access" must query membership, never assume a 1:1 user-to-organization relationship.

## Design system

- **Dark mode is the primary brand experience.** The application defaults to a near-black, high-contrast dark theme (`docs/adr/0004-premium-dark-design-system.md`).
- **Light mode is fully supported**, following the OS `prefers-color-scheme` setting — not a manual toggle (adding one is a UI feature decision for a future milestone, not assumed now).
- **Glassmorphism is used sparingly**, restricted by design-token convention (the `Card` component's opt-in `glass` prop) to a small, explicit set of floating/overlay surfaces (auth card, and — when built — modals, dropdowns, popovers, toasts). It is never the default for page backgrounds, generic content cards, tables, forms, or dashboards.
- **Primary actions are monochrome, not brand-colored.** Accent color (brand blue) is reserved for links, focus states, and semantic status (success/warning/danger) — not decorative use on primary CTAs (`docs/adr/0004-premium-dark-design-system.md` addendum, 2026-07-22).

## Multi-tenant foundation (2026-07-25, Milestone 3)

- **Roadmap sequencing was explicitly overridden for Milestone 3, with the conflict disclosed and a
  decision recorded before implementation — see `docs/adr/0005-multi-tenant-foundation.md`.**
  `docs/development-roadmap.md` splits Organizations/Academies (Phase 4) from Fellowships/Cohorts/
  Enrollment (Phase 6), gated on a transactional-outbox convention that was never built. The product
  owner chose to build all five entities together as briefed rather than defer to that sequencing.
  This is a one-time, disclosed exception — not a precedent that later milestones may skip ahead of
  the roadmap without the same disclosure-and-decision step.
- **Organization stays status-driven (no `deleted_at`); Academy/Fellowship/Cohort get real soft
  delete.** Matches `docs/database-design.md`'s original, differing lifecycle designs for these
  entities — see ADR-0005 Decision 2.
- **A platform Super Admin's own active-organization header must never cause a false "not found" on a
  different organization.** Found via a live browser walkthrough of the new admin UI (not just API
  testing), fixed in `OrganizationsService.get`, and covered by a regression test. This is the kind of
  cross-tenant-adjacent defect this document's security-first principle treats as a release blocker —
  see ADR-0005 Decision 9.
- **The domain-entity layer DEBT-005 named (`docs/KNOWN_TECHNICAL_DEBT.md`) is now established**, for
  the three new modules only (`organizations`'s Academy/Organization additions, `catalog`, `cohorts`).
  Existing identity/roles modules are unchanged.

## Curriculum & Learning Engine (2026-07-26, Milestone 4)

- **Curriculum versioning is a Cohort-level JSON snapshot with an explicit sync action, not the
  documented `curriculum_version`/fork/`cohort_week_release` system** — see
  `docs/adr/0006-curriculum-learning-engine.md` Decision 1. Curriculum entities are always edited in
  place; a Cohort's frozen `curriculumSnapshot` only changes via an explicit
  `POST /cohorts/:id/actions/sync-curriculum` call. This was an explicit product-owner request
  (edit-in-place, with a per-edit choice of "apply to running cohorts now" vs. "future cohorts
  only"), lighter than the documented design because certificates/assessments — the actual reason
  the doc wants strict published-curriculum immutability — remain out of scope.
- **`Module` and `Week` (two documented levels) are collapsed into one `WeeklyModule`** (one row per
  week) — the brief's explicit, repeated ask, not a deferred simplification. See ADR-0006 Decision 2.
- **A live-verified session bug was found and fixed**: React 18/19 StrictMode double-invoking
  `SessionProvider`'s session-restore effect fired two concurrent refresh-token calls, tripping the
  server's reuse-detection and silently logging users out on the next navigation. Fixed in
  `apps/web/src/contexts/session-context.tsx` by caching the in-flight refresh promise across the
  double-invocation rather than skipping the second invocation outright (a naive "run once" guard
  caused a *different* bug — the app hanging on the loading spinner forever). This is
  Milestone-2-era code, fixed here because it broke basic usability of this milestone's own admin UI
  — see ADR-0006 Decision 10 and Consequences.
- **`Assignment`/`Submission` is replaced by a lighter, ungraded `PracticalTask`/
  `PracticalTaskSubmission`** for this milestone, per the brief's explicit "Do NOT build grading
  yet." The full documented Assignment system remains future (roadmap Phase 9) work — see ADR-0006
  Decision 4.

## Student Experience (2026-07-27, Milestone 5)

- **Curriculum snapshot versioning resolution (ADR-0006 Decision 1) is now complete, not just
  gating.** `CurriculumSnapshotService`'s stored shape was extended with the display fields
  (description, resourceUrl, dueOffsetDays, etc.) a lesson reader / task detail page needs, so that
  *every* student-facing read — not only the progression gate — sources exclusively from
  `cohort.curriculumSnapshot`. Reading live catalog tables for display content would have silently
  defeated the whole versioning mechanism (an in-place curriculum edit would reach running cohorts
  immediately regardless of `sync-curriculum`). See `docs/adr/0007-student-experience.md` Decision 11.
- **Design system change: a manual dark/light/system theme toggle now exists**, superseding
  ADR-0004's "no manual toggle" stance. That stance explicitly reserved the decision for "a future
  milestone" — this milestone's brief is that future milestone, asking for one directly (Settings ->
  Appearance). See ADR-0007 Decision 2.
- **`PracticalTaskSubmission` gained a `status` lifecycle and a required Progression Engine gate
  fix**: a `draft` (saved-but-unsubmitted) row must not satisfy the `requiresPracticalWork` unlock
  gate — only `submittedAt !== null` rows count. This is a behavior change from Milestone 4, shipped
  with a regression test. See ADR-0007 Decision 6.
- **File uploads for Practical Task submissions were explicitly deferred** (GitHub repo URL + live
  demo URL only) — a disclosed product-owner decision, since no object-storage infrastructure exists
  and building one is Phase 2 kernel-sized, security-sensitive work. See ADR-0007 Decision 1.
- **A live-verified UI gap was found and fixed**: the Weekly Module detail page showed required
  Learning Resources with no inline way to acknowledge them. The underlying endpoint and progression
  gate were independently proven correct via a direct API reproduction first; the fix was a missing
  frontend affordance, not a backend defect. See ADR-0007 Decision 13.

## Mentor Experience (2026-07-29, Milestone 6)

- **Mentor cohort-scoping is a standing authorization-model tightening, not just a new check on new
  endpoints.** `ProgressionService.assertCanRead` — the sole choke point every read of a learner's
  progress flows through — was tightened from a bare self-or-org-wide-`enrollment.read` check to
  self-or-`enrollment.manage`-or-cohort-assigned-mentor. Every future milestone that adds a new
  staff-facing progress read inherits correct cohort-scoping automatically by going through
  `buildContext`, rather than needing to remember to add the check itself. This closes
  `docs/development-roadmap.md` Phase 8's "mentors only see assigned cohorts/learners/submissions"
  acceptance criterion, previously unenforced. See `docs/adr/0008-mentor-experience.md` Decision 3.
- **`StudentProfile` is renamed to `UserProfile`.** The Milestone 5 entity was already functionally
  generic (no student-only fields); Mentor Profile needed the same shape plus one field
  (`availability`), so the table/repository/service/entity were renamed rather than duplicated. The
  route stays `/me/profile`. See ADR-0008 Decision 4.
- **Submission Review lifecycle reuses the existing `PracticalTaskSubmissionStatus` enum** (no schema
  rename) with a required gate re-lock fix: a mentor's `revision_requested` decision clears the
  submission's `submittedAt`, which is what makes the existing Progression Engine gate re-lock the
  module with zero duplicated logic — the same "single source of truth" principle ADR-0007 Decision 6
  established for the draft-vs-submitted gate fix. See ADR-0008 Decision 2.
- **Weekly Huddles and at-risk/inactive heuristics are deliberately lighter than their fuller
  documented counterparts** (`docs/database-design.md` §5's scheduled-huddle system;
  `docs/development-roadmap.md`'s still-pending "approved risk/at-risk definitions"), per the brief's
  explicit "no scheduling system" instruction and the roadmap's own acknowledgment that risk criteria
  are not yet product-approved. At-risk flags are always paired with a plain-language reason string,
  never a bare score. See ADR-0008 Decisions 1 and 6.

## Administration Platform (2026-07-30, Milestone 7)

- **A new cross-cutting `AdminModule` is the standing pattern for any capability that spans two
  modules in the `organizations → catalog → cohorts → learning` chain without an already-established
  import path.** It sits as a new deepest leaf, importing all four modules plus `identity`/`platform`,
  rather than any lower module reaching sideways or backward. This resolved
  `docs/KNOWN_TECHNICAL_DEBT.md` DEBT-016 (Academy/Fellowship archive not validating child-entity
  state) without inverting the chain. Future milestones needing similar cross-module orchestration
  should extend this module rather than add a new inter-module import. See
  `docs/adr/0009-administration-platform.md` Decision 0.
- **The Audit Center's read-side (`AuditLogService.search`/`getById`) is built entirely off the
  indexes Milestone 2 already added** — no new index was needed. `AuditLogService.record()`'s
  signature and error-swallowing behavior are unchanged; the write path was only refactored to share
  its Prisma access with the new read path via an extracted `AuditLogRepository`. See ADR-0009
  Decision 2.
- **Communication Center and System Settings are both deliberately narrower than their fuller
  documented designs, matching the brief's own explicit instructions** — direct synchronous
  `Notification` persistence with no outbox/delivery-channel table (closes DEBT-026), and a single
  global `SystemSettings` singleton row rather than a 4-scope-level versioned engine. Stored
  password/session/MFA policy fields are admin-editable but not yet wired into any enforcement inside
  `identity`'s auth flows — a disclosed, intentional gap, not an oversight. See ADR-0009 Decisions 1
  and 5.
- **No PDF or charting library was introduced.** Certificates render via a `{{placeholder}}` HTML
  template the browser prints natively; Reports & Analytics reuses `ProgressRing`'s hand-rolled `<svg>`
  precedent for a new `BarChart` component. Every reporting number is computed on read from existing
  rows, never a stored time-series. See ADR-0009 Decision 4.
- **Post-ship fix (2026-07-30): admin hierarchy visibility is now enforced, not just anchored.**
  `MembershipsService.getAcademyScope()` is the new single source of truth for "how much of the org
  hierarchy can this caller see" — Super Admin/Org Admin unrestricted, Academy Admin confined to their
  anchored Academy — enforced at each module's existing `get()` existence-check chokepoint so every
  mutation (which already calls `get()` first) is covered for free. The User Management list, which
  had no organization scoping at all before this fix, is now scoped via a new `AdminUsersRepository`.
  Closes `docs/KNOWN_TECHNICAL_DEBT.md` DEBT-015 for the Academy/Fellowship/Cohort/User surface;
  curriculum-content editing and Reports/Audit/Certificates/Announcements remain unscoped, disclosed
  as follow-up. See ADR-0009 Decision 7.

## Cohort Applications (2026-07-31)

- **New self-service registration closes two gaps found during the hierarchy-scoping fix's live
  testing: no way for a student to request joining a cohort themselves, and no way for a brand-new
  prospect to apply at all.** A new `CohortApplication` entity (pending/approved/rejected/withdrawn)
  backs both an anonymous `/apply` page and an authenticated `/portal/register` page; approval is a
  manual admin action (`/admin/applications`) that reuses the existing `UsersService.invite()`
  mechanism verbatim to create an account for a prospect, then `MembershipsService
  .inviteIntoOrganization()` and `EnrollmentsService.create()` — no new account-creation or email
  code was written. Two previously-stored-but-never-read fields now do real work:
  `Fellowship.isPublic`/`Academy.isPublic` gate what's browsable, and `SystemSettings.registrationOpen`
  is the feature's kill switch. See `docs/adr/0010-cohort-applications.md`.

## Public Fellowship Experience (2026-09-04)

- **The public Tech Impact Fellowship landing page is vanilla HTML/CSS/JS, not a React route —
  the first and only part of this codebase's frontend that isn't.** Served as a static asset from
  `apps/web/public/fellowship/`, it never loads the React bundle, and calls the existing public
  API (`GET /public/fellowships`, `POST /public/cohort-applications`) directly with `fetch()`. No
  parallel application system, no duplicated curriculum data — same backend, same
  `CohortApplication` entity as the authenticated `/apply` flow. See
  `docs/adr/0011-public-fellowship-experience.md`.
- **The admin Cohort Applications queue gained search, a fellowship filter, and real server-side
  bulk approve/reject** — `CohortApplicationsService.bulkApprove()`/`bulkReject()` loop the
  existing single-item `approve()`/`reject()` per item, each independently version-checked and
  independently reported, so one bad row never blocks the rest of a batch. Same permission
  (`cohort.application.manage`), no new authorization model. The queue also now resolves and
  surfaces full applicant/fellowship/cohort/track/reviewer detail via `APPLICATION_INCLUDE` —
  previously an authenticated (non-prospect) applicant showed as a bare user id with no name or
  email anywhere in the admin UI.

## Hierarchy, Provisioning & Role-Access Correction (2026-09-04)

- **Audited before changing anything, and confirmed the backend hierarchy enforcement was already
  correct**: required non-nullable FKs at every level, every `create()` already validates its
  parent belongs to the caller's scope, every `list()`/`get()` already academy-scopes a restricted
  caller, mentor assignment is already cohort-scoped, and no `FELLOWSHIP_ADMIN` role exists
  anywhere. The real gaps were all frontend: no contextual creation flow, no child lists on parent
  detail pages, no real breadcrumb, and a flat nav. See `docs/adr/0012-hierarchy-provisioning.md`
  for the full decision record.
- **Contextual creation, child lists, and a real `Breadcrumb` component replace the flat
  "pick any parent from a dropdown" pattern** on the Fellowship/Cohort create pages and the
  Organization/Academy/Fellowship/Cohort detail pages — additive to existing routes, not a
  restructure of them.
- **The admin nav now resolves to exactly one hierarchy entry point per role** (Organizations / My
  Organization / My Academy, by permission key — `academy.create` vs `academy.update`, not a
  hardcoded role name) instead of presenting Organizations/Academies/Fellowships/Cohorts as four
  unrelated top-level items. The flat list routes still exist; they're reached by drilling down,
  not linked from the sidebar directly anymore.
- **Fixed a real cross-organization navigation bug** this task's own "Super Admin can navigate the
  hierarchy regardless of their own organization membership" requirement surfaced: visiting an
  organization's own detail page now sets it as the active tenant context for the rest of that
  browsing session, so a Super Admin drilling into a different organization than their switcher
  last had selected no longer 404s one level down. See DEBT-033 for the one path (a raw
  Academy/Fellowship/Cohort URL, deep-linked without visiting the org page first) it doesn't cover.

## Dashboard Bento Redesign (2026-09-04)

- **The Admin, Mentor, and Student dashboards now use an asymmetric Bento layout, a skeleton
  loading state, and glassmorphism content cards — a deliberate, disclosed exception to ADR-0004**
  (which reserves glass for floating surfaces and uses spinners everywhere else). Every other page
  in the app is untouched and stays on the ADR-0004 pattern. See
  `docs/adr/0013-dashboard-bento-redesign.md` for the full decision record, including why this
  exception was scoped to exactly these three pages.
- **A new compound `DashboardState` component** replaces each dashboard's own hand-rolled
  Loading/Error/Empty chain, and gives Error its own distinct visual with a working retry — before,
  a real fetch failure and "nothing here yet" rendered the identical message with no way to recover
  short of a full reload.
- **No fabricated data.** Mentor and Student have no time-series data to chart, so their Bento focal
  tile is their single most important *existing* element (Review queue; Progress ring + Continue
  learning merged into one hero tile) rather than an invented chart.

## Fellowship Real-Time Chat (2026-09-05)

- **Fellowship is the chat boundary — not Cohort, not Organization — and there is no
  `FELLOWSHIP_ADMIN` role.** Access to a Fellowship's chat is derived entirely from the same
  relationships every other module already uses (active `Enrollment` for students, active
  `CohortMentor` assignment for mentors, `chat.channel.manage` + academy scope for admins) via one
  shared `ChatAccessService`, called by both the REST controllers and the WebSocket gateway so the
  two can never drift apart. See `docs/adr/0014-fellowship-chat.md` for the full decision record.
- **Redis is now wired into the API for the first time** — narrowly, only for real-time chat-event
  fan-out via `@socket.io/redis-adapter`, never as the source of truth for messages or
  authorization (Postgres and the existing permission system remain that). A Redis outage degrades
  real-time delivery only; this was verified against a genuine outage in this project's own dev
  environment, not merely reasoned about.
- **The WebSocket gateway accepts no writes.** Every chat mutation goes through the existing REST
  endpoints; the socket is subscribe-and-receive only, re-running the same authorization check the
  REST `GET` route uses on every subscribe, with a periodic sweep that revokes a now-stale
  subscription without waiting for a reconnect.
- **Chat notifications reuse the existing `NotificationsService`** — reply notifications only, the
  same plain-persisted-row model Announcements already uses. No `@mention` system was added (no
  unique user handle exists to match against — see DEBT-034).

## Name-First Display, and List-Then-Edit Detail Pages (2026-09-05)

- **No id-bearing list or detail response the frontend renders may show a bare id where a name is
  available.** Where a real Prisma relation exists, resolve it via `include`; where none does by
  design (`Enrollment`/`AuditLog` deliberately have no FK to `User`, so history survives account
  removal), batch-resolve via `UsersService.listByIds()` in the service layer. See
  `docs/adr/0015-name-first-display.md`.
- **Any control that picks one resource from a list of names supports type-to-search** via the new
  generic `EntitySearchField<T>` (people search already existed; this generalizes it) — never a
  plain dropdown of hundreds of names, never a raw-id text filter.
- **Every editable "detail" section is read-only by default**, with an Edit button opening the
  existing form in a dialog — never an always-visible inline form. A new app-wide `useToast()`
  confirms success/failure after every such save.

## Cohort-Scoped Learning Tracks and Fellowship-Wide Track Mentors (2026-09-05)

- **A Cohort now selects which of its Fellowship's Learning Tracks it actually offers** — tracks
  stay authored once at the Fellowship level (no curriculum duplication); an empty selection falls
  back to every Fellowship track, so every Cohort created before this feature keeps working
  unchanged. See `docs/adr/0016-cohort-scoped-tracks.md`.
- **Mentor-to-track assignment is Fellowship-wide, not Cohort-scoped, and additive to (never a
  replacement for) Cohort-wide mentor assignment.** A track mentor genuinely sees only students on
  their track — this is a real, disclosed authorization change to every mentor-facing per-student
  read (roster, student workspace, mentor notes, portfolio, submission review), routed through one
  shared resolver (`learning/support/mentor-cohort-scope.ts`) rather than five separate
  reimplementations.
- **A Cohort's explicit "offered tracks" list and a student's actual enrolled track are two
  independent signals, and mentor discovery checks both.** Found via live verification: relying on
  only the explicit offering let a track mentor's own roster query return correct data while "my
  cohorts" failed to surface that Cohort at all. Fixed before shipping — see the ADR's Decision 4.

## Per-Cohort Track Switch Grace Period (2026-09-05)

- **A learner selects and may later switch their Learning Track themselves**, via a new
  self-service `POST /enrollments/:id/actions/select-track` — the pre-existing staff-only
  `PATCH /enrollments/:id` is unchanged. See `docs/adr/0017-track-switch-grace-period.md`.
- **Switching is closed by a manual admin action, not a timer, and scoped per Cohort.**
  `Cohort.trackSwitchClosedAt` is null (open) by default; an admin explicitly closes or reopens it
  per Cohort — there is no duration, deadline, or background job, and closing one Cohort never
  affects another.
- **The grace period only ever gates a *change* away from an already-set track — a learner's first
  pick is always allowed**, regardless of the Cohort's switching state. This was a specific,
  confirmed product decision, not an oversight: closing the window stops mid-stream track-hopping,
  never blocks a new or newly-onboarded learner from choosing at all.

## Student Profile/Dashboard Program Hierarchy (2026-09-06)

- **A student's Profile page and Dashboard now show which
  Organization/Academy/Fellowship/Cohort/Learning Track they belong to** —
  applying the ADR-0015 name-first-display convention to a surface it hadn't
  reached yet. Names are resolved server-side only on `GET /enrollments/me`
  (`EnrollmentsService.listMine`), not the staff-facing cohort roster
  (`GET /cohorts/:id/enrollments`) — a mentor/admin already has that
  cohort's context from the page they're on, so resolving five extra names
  on every roster row would be pure overhead with no product benefit.
- **Hierarchy resolution never fails the whole call.** If any single
  enrollment's Organization/Academy/Fellowship/Cohort/Track has since been
  hard-deleted, that one enrollment degrades to all-null hierarchy names
  (the same "since-removed record" convention `userDisplayName`/`userEmail`
  already use) rather than 404ing `GET /enrollments/me` — every page in the
  student portal depends on that one endpoint via `EnrollmentProvider`, not
  just Profile. Found live, mid-implementation, against genuinely stale
  dev-fixture data (an enrollment pointing at an already-deleted Academy),
  not merely reasoned about.

## Admin-Set-Password User Creation, and a Permanent Username (2026-09-06)

- **`POST /admin/users` lets an admin create a user with a password they set directly**, alongside
  (not instead of) the existing email-only `POST /users/invitations`. This is a deliberate,
  disclosed reversal of ADR-0009's original "no direct password editing" brief requirement — see
  that ADR's 2026-09-06 addendum for why: this environment's email adapter is a dev-mode stub with
  no real delivery, so the reset-link-only flow left a new account unusable. An admin still cannot
  view or silently overwrite an *existing* user's password — creation is rejected outright if the
  email is already taken, never silently reused.
- **A new, permanent `User.username`** (nullable, unique) — set by the admin at creation, or
  self-set/changed later by anyone from Settings (`PATCH /me`). Lowercase `[a-z0-9_-]{3,30}`, the
  same shape the not-yet-built user-to-user chat lookup can reuse without its own migration.
- **Jurisdiction at creation covers only Organization (automatic) and Academy** (a picker, required
  exactly when `ACADEMY_ADMIN` is among the selected roles) — Mentor/Student scoping stays on the
  two already-built, separate flows (`Assign mentor`, `Enroll student` on their Cohort/Track pages)
  rather than being duplicated into this dialog too.

## Real Notification Center, All Three Roles (2026-09-06)

- **The header bell and full Notification Center now read real data** (`GET /me/notifications`),
  replacing hardcoded placeholder content that predated this — see DEBT-026's 2026-09-06 closure
  note in `docs/KNOWN_TECHNICAL_DEBT.md`. Grouped into Unread/Read sections; a manual "mark unread"
  action (`POST /me/notifications/:id/actions/mark-unread`, new) is the only way a read notification
  ever reverts — never automatic.
- **Clicking a notification navigates to its source when one exists for the caller's role,
  otherwise opens a popup with the full title/body.** No fabricated destination — Student/Mentor
  have no recipient-facing announcement page and Admin has no chat surface yet, so those cases
  correctly fall through to the popup rather than a broken or misleading link
  (`resolveNotificationTarget`).
- **Extended to Admin and Mentor layouts**, not just Student — the backend already created
  notifications for any role (a mentor gets a chat-reply notification same as a student); only the
  UI to see them was Student-only before.
- **`docs/api-specification.md` §4.9 disclosed as largely aspirational**, found while documenting
  the real endpoints above: its tables describe direct/group DM conversations and a
  member-facing/scheduled Announcements design that were never built. Left in place (rewriting it is
  a separate, larger cleanup) but now clearly labeled, with the actually-implemented routes
  documented above it.

## Admin Chat Access, Channel Creation UI, and User-to-User DMs (2026-09-06)

- **Admin chat access required zero backend changes.** `ChatAccessService`'s Super/Org/Academy
  Admin authorization matrix (ADR-0014 Decision 1) already covered viewing, sending, moderating,
  and creating channels in any Fellowship within an admin's scope — the reported gap was purely
  that Admins had no chat UI at all. `FellowshipDetailPage` now has a "Chat" section reusing the
  existing `ChatWorkspace` component; `ChannelSidebar` gained the previously-missing "Create
  channel" action. See `docs/KNOWN_TECHNICAL_DEBT.md` DEBT-035 (closed).
- **User-to-user DMs are now built — a formal, disclosed reversal of ADR-0014's original "DMs out
  of scope" decision** (see that ADR's 2026-09-06 addendum). Deliberately organization-scoped
  (never platform-wide, despite `username` being a global identity) and deliberately minimal
  relative to Fellowship chat — no reactions, no reply-threading, no dedicated read-state table;
  unread signaling reuses the Notification Center built earlier this same day instead of new
  infrastructure.
- **DM real-time delivery is REST + client polling, not the WebSocket gateway** — a deliberate
  scope narrowing, not an oversight. `ChatGateway`'s authorization is Fellowship/Cohort/Enrollment/
  academy-scope-shaped; DMs need only "is the caller one of exactly two participants," a
  categorically simpler check that didn't justify extending an already-intricate, already-tested
  gateway.
- **`User.username` (added earlier the same day for admin user creation) turned out to be exactly
  the missing piece DEBT-034 (`@mention` notifications) had been blocked on** — that debt entry is
  updated to reflect the schema now existing, though `@mention` parsing itself remains unbuilt and
  unrequested.

## Real Email Delivery (2026-09-06)

- **Email is no longer a logging stub in any environment that configures it.** ADR-0003 originally,
  correctly scoped email as a console-log stub for Milestone 2 (no async side effects existed yet)
  and it was never revisited — every flow built on top of it since (invitation, password reset,
  email verification, admin-created-account notice) has been silently undeliverable in every real
  environment. `IdentityModule`'s `EMAIL_ADAPTER` is now a factory: a real `SmtpEmailAdapter`
  (generic SMTP via `nodemailer`) when `SMTP_HOST` is configured, the original
  `ConsoleEmailAdapter` otherwise — so every environment without SMTP credentials configured keeps
  working exactly as before. See `docs/adr/0003-identity-and-access-control-foundation.md`'s
  2026-09-06 addendum.
- **Generic SMTP, not a vendor SDK** — works with whatever provider or account a deployment already
  has (a personal account with an app password, a provider's own SMTP relay, or a sandbox like
  Mailtrap for testing), without committing the codebase to one vendor's API shape.
- **A second real gap found while tracing this**: `email-verification`'s emailed link had nowhere to
  land — no frontend route ever consumed that token, unlike the other three template types which
  all point at `/reset-password`. Added a minimal `/verify-email` page mirroring that page's exact
  shape.

## Chat Channel Rename/Archive/Restore UI, and a Real `#general` Member Roster (2026-09-07)

- **Rename/archive/restore, the remaining gap DEBT-035's 2026-09-06 closure explicitly disclosed,
  now have UI.** `ChannelInfoPanel` gained an edit action and an archive/restore action (both
  `chat.channel.manage`-only, server-enforced regardless); `ChatChannelsService.list()` gained a
  manager-only `includeArchived` option so a manager can find an archived channel to restore.
  Zero new backend surface — the REST endpoints were already built and tested. DEBT-035 is now
  fully closed.
- **`FellowshipChatChannelMember` — modeled in the schema since ADR-0014 but never once populated
  by any code path — now backs a real, listable roster for a Fellowship's `#general` channel, on
  explicit product request.** A new `ChatMembershipSyncService`, called from
  `EnrollmentsService.update()` on every status transition, keeps a student's row in sync with
  whether their new status is one Decision 1's Student access check already treats as granting chat
  access (`active`/`paused`/`completed`) — the two checks share one named constant so they cannot
  drift apart. This **does not change authorization at all**: `ChatAccessService.authorize()` is
  untouched, and `#general` is never a private channel, so this table's access-gating role (private
  channels only) and its new roster-backing role (`#general` only) never overlap. See ADR-0014's
  2026-09-07 addendum for the full reasoning, including why this is deliberately students-only (not
  mentors) for now.
- **New `GET /chat/channels/:channelId/members`**, gated by the already-broadly-granted
  `chat.channel.read` (any participant, not just managers — the point is anyone in the channel can
  find anyone else to message). The frontend roster lives in `ChannelInfoPanel`; clicking a member
  starts a DM via the existing `POST /me/conversations` (2026-09-06) and deep-links to it exactly
  like a `dm.message.received` notification already does.

## Invited-User Membership Activation Fix, and App-Wide API Error Messages (2026-09-07)

- **An invited/approved user's organization `Membership` never activated alongside their `User`
  account, leaving them permanently stuck on the generic landing page with `/portal` spinning
  forever.** `AuthService.resetPassword()` already activated the `User` row on invitation
  completion but never the `Membership` row that same flow creates — a gap dating back to
  `Membership` not existing yet when that activation logic was originally written. Fixed by a new
  `MembershipsService.activateAllInvitedMemberships()`, called from the same code path. See
  `docs/adr/0003-identity-and-access-control-foundation.md`'s 2026-09-07 addendum for the full
  root-cause trace (`OrganizationProvider` → `HomePage`/`RequireRole`) and live verification. One
  already-stuck real account was repaired directly via the existing membership-status endpoint.
- **Every API error surface in the frontend (124 call sites, 51 files) now shows the server's
  actual validation reason instead of the generic "The request contains invalid fields." wrapper.**
  A new `describeApiError()` helper (`apps/web/src/api/client.ts`) prefers a validation error's
  `details[0].message` over its generic top-level `message`. Applied via a verified, scripted
  codemod (not hand-edited) after `tsc`/`eslint`/`prettier`/`vite build` all confirmed clean across
  every touched file. Originated from a real user report: a weak password ("Osamuedeme" — no digit)
  was correctly rejected server-side, but the reset-password page only ever showed the generic
  wrapper text, hiding the real reason. Client-side password validation also now mirrors the
  server's letter+digit rule for immediate feedback.

## Students May Not DM Super Admin or Org Admin (2026-09-12)

- **The 2026-09-06 "anyone active in the org" DM eligibility rule is narrowed: a Student may not
  start a DM with a Super Admin or Org Admin.** Confirmed narrow on three specific points before
  implementation: only those two roles (Academy Admin and Mentor remain reachable), one-way (an
  admin can still message a Student), and hidden entirely rather than merely blocked — excluded from
  `GET /me/people/search` outright (query-level exclusion, not a post-filter, so pagination still
  fills a full page), and `POST /me/conversations` returns the identical `NOT_FOUND`/"not a member"
  already used for a genuine non-member if addressed directly, so a restricted admin is
  indistinguishable from someone who doesn't exist.
- **New `MembershipsService.hasRoleKey()`** — an org-scoped role-key check, distinct from
  `PermissionResolverService.hasPlatformRole()`'s platform-wide one (already used for Super Admin
  elsewhere). Role-name checks on purpose here, not permission-key checks: this is about who a
  Student may *reach*, not what either party may *do*.
- **The Fellowship chat member roster needed no change** — it only ever lists students (this
  session's earlier `ChatMembershipSyncService` work), so a Super Admin/Org Admin was never going to
  appear there regardless of this restriction. See `docs/adr/0014-fellowship-chat.md`'s 2026-09-12
  addendum for the full reasoning and verification.

## Missing #general Backfilled, Mentor Channel Creation, and Auto-Created Track Channels (2026-09-12)

- **Two Fellowships created before Fellowship Chat shipped (2026-09-03, two days before auto-creation
  went live 2026-09-05) had no `#general` channel at all** — surfaced as "why can't I load my
  fellowship chat." Not a code bug (verified the auto-creation hook works for everything created
  since); backfilled the one in active use through the same path a real request would use, then
  cycled the affected Enrollment's status to re-trigger the membership-roster sync now that the
  channel exists.
- **A Mentor may now create chat channels — create only, and only in a Fellowship they're actually
  assigned to (an active `CohortMentor` assignment), never rename/archive/restore, never org-wide.**
  `FellowshipChatAuthorization` gains `canCreateChannels`, distinct from `canManageChannels`.
  `GET /fellowships/:id/chat/channels`'s response shape changes accordingly — a bare `ChatChannel[]`
  becomes `{ channels, canManageChannels, canCreateChannels }`, since a Mentor's create capability is
  per-Fellowship and a static role-permission check on the frontend can't express that (this also
  incidentally fixes an Academy Admin viewing a Fellowship outside their academy seeing an
  edit/archive action that would have 403'd on click — the frontend now reads the real, server-computed
  capability instead of approximating it from a role name).
- **A Cohort being assigned a Learning Track now auto-creates that pairing's own `type: 'track'`
  channel** (new enum value + two new nullable `FellowshipChatChannel` columns, migration
  `20260912200000_add_track_chat_channels`). A Student sees only their own Cohort+Track's channel,
  never every Track channel in the Fellowship — enforced in three places that all had to be updated
  together, since this codebase doesn't centralize channel-read authorization in one function
  (`ChatChannelsService.list()`/`.requireReadAccess()` and `ChatMessagesService`'s own independent
  access check, a pre-existing duplication, not introduced here). See
  `docs/adr/0014-fellowship-chat.md`'s 2026-09-12 addendum for the full design and live verification.

## Tech Impact Fellowship — Cohort 1 realistic learning data (2026-09-14)

A data-and-experience milestone: seed a genuinely usable Tech Impact Fellowship "Cohort 1" (3
tracks, 9 weeks, real lessons/resources/tasks, a test student account) so the existing learning
engine can be exercised end-to-end as a real student, without any architecture change. New file
`apps/api/prisma/seeds/tech-impact-cohort1.seed.ts` (run via `pnpm --filter @forge/api
seed:cohort1`), following the existing `identity.seed.ts`/`dev-test-users.seed.ts` direct-Prisma,
idempotent-upsert convention — no new service, module, or API route.

- **No `Assignment` entity exists, and none was added.** `PracticalTask` + `PracticalTaskSubmission`
  is the only task/assignment system in the schema. The seed represents the brief's "task" vs.
  "assignment" distinction as two `PracticalTask` rows per week — a lighter `Practice:`-prefixed one
  (small `maxScore`, no rubric) and a fuller `Assignment:`-prefixed one (the brief's exact titles,
  `maxScore: 100`, a rubric, a longer due offset) — both live in the same table, distinguished only
  by content, not by schema.
- **Students read only `Cohort.curriculumSnapshot`, never the live catalog tables** — confirmed by
  reading `ProgressionService.buildContext()`. The seed writes live `LearningTrack`/`Course`/
  `WeeklyModule`/`Lesson`/`LearningResource`/`PracticalTask` rows and then calls its own
  `rebuildCurriculumSnapshot()`, an exact structural mirror of `CurriculumSnapshotService.build()`,
  so the new content is actually visible to a student. Any future seed touching the live catalog for
  an already-created cohort must do the same, or its content will be silently invisible.
- **The 3 new tracks (Web Development, WordPress Website Design, Graphics Design) are additive.**
  Cohort 1 already had two empty, unrelated `LearningTrack`s ("Software Engineering", "Product
  Design") offered to it from earlier session testing. These were left untouched — not deleted, not
  populated — per "implement only the requested milestone."
  See [[DEBT-036]] tracking of a follow-on gap this surfaced. All 3 new tracks were added as further
  `CohortLearningTrack` offering rows alongside the existing two.
- **Reused the pre-existing Organization/Academy** rather than creating new ones: the seed looks up
  an Academy already hosting a Fellowship titled "Tech Impact" (falls back to slug `ota-doyen`, then
  creates one) instead of assuming a fixed id, so it works whichever earlier-session fixture state
  the database is in.
- **The seeded test student's `currentLearningTrackId` is deliberately left unset at seed time.**
  Track selection is a real, student-callable, ownership-checked endpoint
  (`POST /enrollments/:id/actions/select-track`, `EnrollmentsService.selectTrack()`); the seed only
  enrolls the student in Cohort 1 and leaves track selection to be performed live through the
  product, the way a real student would, rather than pre-setting it via direct DB write.
- **Idempotency key for `Lesson`/`LearningResource`/`PracticalTask`:** these have no unique
  slug/natural key in the schema, so the seed uses `findFirst({ weeklyModuleId, title })` as its
  lookup-before-write key, relying on titles being authored uniquely within a given week. Verified
  by running the seed twice and diffing row counts/ids — no duplicates.
- **All YouTube URLs are real, verified links** (via live web search, each confirmed to appear in a
  search result's own link data rather than accepted from summary text), converted to `/embed/<id>`
  form — the lesson reader's `<iframe>` renders `lesson.resourceUrl` directly and a `/watch?v=` URL
  is refused by YouTube's frame-ancestors policy.
- **Test student credentials are development-only** (see the README's "Tech Impact Fellowship
  Cohort 1 seed data" section) and must never be set as real credentials in any deployed
  configuration — same convention already established for `dev-test-users.seed.ts`.

## Track chat channel membership now syncs instantly (2026-09-14)

Reported live: a Student selecting "Web Development" for the Tech Impact Fellowship Cohort 1 did
not see/appear in that track's chat channel.

- **Root cause was two-fold.** (1) The Cohort 1 seed script (`tech-impact-cohort1.seed.ts`) wrote
  its 3 new tracks into `CohortLearningTrack` directly via Prisma, bypassing
  `CohortsService.setOfferedTracks()` — the only code path that auto-creates a track's chat channel
  (`ChatChannelsService.createTrackChannel()`). Result: Web Development, WordPress Website Design,
  and Graphics Design had no `type: 'track'` channel at all. Fixed by driving the real
  `PUT /cohorts/:id/tracks` endpoint (remove-then-restore the 3 tracks so `setOfferedTracks()`'s
  own newly-added-track diff sees them as new), not a direct Prisma write — see this doc's own
  "Tech Impact Fellowship — Cohort 1 realistic learning data" entry above for why that seed bypassed
  the service layer in the first place, since this is the fallout of that same shortcut.
  (2) Even once a track channel exists, `ChatMembershipSyncService` (the `FellowshipChatChannelMember`
  roster-sync introduced 2026-09-07) only ever covered `#general` + Enrollment status — track
  channels and Mentor assignment were never wired into it at all, so a channel's "who's in this
  channel" roster (`GET /chat/channels/:id/members`) would stay empty regardless. **Access itself
  was never actually blocked** — `ChatChannelsService.list()`/`ChatMessagesService.requireChannelAccess()`
  already compute track-channel read/write access live from `Enrollment.currentLearningTrackId` and
  `CohortMentor`, never from this roster table — but the roster not reflecting reality is what a
  real user sees as "I wasn't added."
- **Fix:** `ChatMembershipSyncService` gains three methods. `syncTrackMembership()` — called from
  `EnrollmentsService.selectTrack()` (self-service) and `.update()` (admin-driven) whenever
  `currentLearningTrackId` changes — adds the student to their new track's channel roster and
  removes them from their previous one on a switch. `syncMentorMembership()` — called from
  `CohortsService.assignMentor()`/`.unassignMentor()` — adds/removes a Mentor from a Cohort's
  `#general` and every one of its track channels. `backfillTrackChannelRoster()` — called right
  after `createTrackChannel()` creates a *new* channel — populates it immediately with every
  Student already on that track and every Mentor already on that cohort, so a channel created after
  those relationships already existed (a track added mid-cohort, or backfilled as above) doesn't
  start with an empty roster despite already-granted access. None of these change how access is
  authorized; they only keep the roster (`FellowshipChatChannelMember`) — which the codebase already
  keeps solely as a display convenience, per that service's own file-level doc comment — accurate.
- **Mentors have no per-track assignment in the schema** (`CohortMentor` is Cohort-wide, not scoped
  to a Learning Track), matching `ChatAccessService`'s existing design where a Mentor's
  `canCreateChannels` already grants them every track channel in a Fellowship they're assigned to,
  not just one. "Instant access when added to a track" for a Mentor is therefore satisfied by the
  Cohort-level sync above; there is no narrower "this track only" concept to build without a schema
  change, which was out of scope for this fix.

## Milestone 8 — Production hardening (2026-09-21)

A security/reliability/deployability pass over the existing platform — explicitly not a new-feature
milestone. Full findings, fixes, and live verification are in the milestone completion report; the
decisions worth recording here are the ones with lasting effect on how the codebase works.

- **Rate limiting is now tiered, not one flat global rule.** `@nestjs/throttler`'s existing
  (already-installed) named-throttler support is used via per-route `@Throttle({ default: {...} })`
  overrides on login, refresh, forgot/reset-password, every MFA route, invitations, and chat/DM
  message-send — closing DEBT-003. Deliberately still IP-based, not per-authenticated-user: global
  guard order (`ThrottlerGuard` before `JwtAuthGuard`) means no authenticated identity exists yet when
  the throttler's tracker runs, and reordering guards app-wide was judged too broad a change to make
  silently in a hardening pass — see DEBT-037.
- **`ChatGateway` gained its own flood protection**, since `ThrottlerGuard` never runs for WebSocket
  gateways at all (it only reads `ExecutionContext.switchToHttp()`). Two independent in-memory,
  per-instance, fixed-window counters: a per-IP connection limit (30/min) and a per-socket event limit
  (60/10s, covering `chat.subscribe` and both typing events — message *sending* was already
  REST-only, per ADR-0014 Decision 3, so it was already covered by the HTTP throttler). Not
  Redis-backed — see DEBT-038 for the multi-instance caveat this leaves open.
- **`GET /health` (liveness) and `GET /health/ready` (readiness) are now two different checks.**
  Liveness never touches the database, so a real Postgres outage can't cause an orchestrator to kill
  otherwise-healthy API instances on top of the outage; readiness does check the database (`SELECT 1`
  via Prisma) and returns `503 NOT_READY` if it's unreachable. Redis is deliberately not part of
  readiness — chat's REST read/write paths keep working without it (ADR-0014 Decision 2), so an
  unreachable Redis is not a reason to report the whole API as not ready.
- **`env.validation.ts` now rejects the literal placeholder secret value `.env.example` ships**
  (`"replace-with-a-random-32-byte-minimum-secret"`) for `JWT_ACCESS_SECRET`/`COOKIE_SECRET`, in every
  environment, not only production — it happened to be long enough to pass the existing `.min(32)`
  check, meaning a `.env` copied without actually generating real secrets would previously boot
  "successfully" on a publicly-known value. `NODE_ENV` is now a recognized, validated config value
  (default `development`); `main.ts` logs an explicit warning at boot if `NODE_ENV=production` with no
  SMTP configured (password reset/verification emails would only be console-logged) or a non-HTTPS
  `WEB_ORIGIN`.
- **CI now actually runs what it claims to.** `pnpm test` was previously executed with no database or
  Redis at all, even though six `*.integration.spec.ts` suites need a real PostgreSQL (one also needs
  Redis and boots the full `AppModule`) — verified locally that these suites fail immediately
  (`PrismaClientInitializationError`) without a reachable database, so this was very likely failing
  silently or being ignored rather than actually validating anything. `.github/workflows/ci.yml` now
  provisions `postgres:16-alpine` and `redis:7-alpine` service containers (matching
  `docker-compose.dev.yml`), sets the required env vars as CI-only throwaway values, and adds
  `prisma validate` and `prisma migrate deploy` steps before `pnpm test`. Also adds an informational
  (non-blocking) `pnpm audit --prod` step — non-blocking because pnpm's `--prod` flag does not cleanly
  exclude devDependency-only advisories in this workspace, confirmed by testing it; making it blocking
  now would fail CI on tooling vulnerabilities that never reach a shipped runtime.
- **Runtime-reachable dependency vulnerabilities fixed via version bumps**, not overrides where a
  direct bump was possible: `react-router-dom` (CSRF-bypass advisory, was resolving to a vulnerable
  7.18.1), `joi` (prototype-pollution advisories). `qs` and `multer` — both transitive, both actually
  reachable in the API's production dependency graph via Express/`@nestjs/platform-express` — pinned
  via a new root `pnpm.overrides` entry. Six remaining advisories (`brace-expansion`, `fast-uri`,
  `js-yaml`, `nanoid`, `deepmerge-ts`, `postcss`) confirmed via `pnpm why` to be devDependency-only
  (eslint's and Tailwind's own dependency trees) — never shipped to a production runtime — and left
  alone rather than force-overridden under time pressure; see the CI audit step above.
- **A production Dockerfile for the API now exists** (`apps/api/Dockerfile`) — none did before, despite
  `docs/system-architecture.md` §14 calling for a "containerized Nest API." Standard multi-stage
  pnpm-workspace build using `pnpm deploy` to extract `@forge/api`'s own production `node_modules`.
  **Not build-verified** — Docker was unavailable in the environment this was written in — see
  DEBT-039. No cloud provider or hosting platform was selected; this is a build artifact only.
- **The web app gained a router-level `errorElement`** (`RouteErrorPage`) and a configured
  `QueryClient` (bounded retry that skips 4xx client errors, since `client.ts`'s own 401
  refresh-and-retry logic already handles the one 4xx retrying could ever fix). Both are production
  reliability fixes, not redesigns: previously an uncaught render error anywhere in the route tree
  unmounted the whole app to a blank screen, and every failed query retried 3 times by default
  regardless of whether the error was retryable.

## Milestone 9 — Production launch readiness (2026-09-21)

A launch-readiness audit and documentation pass, not a feature milestone — the goal was verifying the
existing system is genuinely ready for the real Tech Impact Fellowship Cohort 1 launch, fixing only
genuine launch-blocking issues found, and documenting everything an operator needs. No product code was
changed this milestone; every fix was a live data/configuration correction through real, existing APIs.

- **Found and fixed: a duplicate public Fellowship listing.** A stale "Tech Impact Fellowship" row
  (slug `tif`, under an already-archived academy, left over from early Milestone 3/4 testing) was
  independently `isPublic: true` alongside the real one (slug `tech-impact-fellowship`, the one Cohort 1
  actually belongs to) — the public catalog (`GET /public/fellowships`) would have shown a real
  applicant two "Tech Impact Fellowship" entries, one of them a dead end. Fixed via the real admin API
  (`PATCH /fellowships/:id { isPublic: false }`), not a database edit — confirmed the catalog now shows
  exactly one.
- **Found and fixed (explicit product decision): Cohort 1 was not actually applyable.** The public
  application system correctly only lists cohorts with status `enrolling` (an already-`active` cohort
  shouldn't accept new applicants) — but Cohort 1's status had been set to `active`, and its dates
  backdated two weeks, by the Milestone 7 seed script specifically to let the student learning
  experience be tested immediately. That meant zero cohorts appeared on the public page at all. Per
  explicit user decision, Cohort 1 was reopened: status set to `enrolling`, dates moved to a real future
  window (`startsAt` ~3 weeks out, `endsAt` = `startsAt` + the Fellowship's 12-week duration). Verified
  safe beforehand by reading `DeadlineService.computeFromContext()`: it uses
  `enrollment.joinedAt ?? cohort.startsAt`, and every already-enrolled student has a real `joinedAt`
  already set, so their progress/deadlines are unaffected by the date change; `cohort.endsAt` is only
  ever surfaced as a display "estimated completion date," never gating logic. `CohortsService`'s
  lifecycle state machine has no `active → enrolling` transition (by design — a real running cohort
  shouldn't normally un-start), so this was a one-time, explicitly-approved direct data correction, not
  a new admin feature — the same category of action this codebase's own seed scripts already use for
  controlled initialization, not a precedent for routine cohort management.
- **Removed clearly-disposable test fixtures from the real Cohort 1**: three synthetic
  `CohortApplication` rows used to verify the admin review queue
  (`ada.tester`/`bola.tester`/`chidi.tester`@example.com) and four stale application-history rows
  against the Milestone 2 `student@test.local` fixture, plus the two never-activated "invited"
  enrollments the approved ones had created. Two now-orphaned, never-activated `User`/`Membership` rows
  (Ada/Bola) were deliberately left in place rather than hard-deleted — they hold no enrollment or
  application anywhere and can never log in (no password was ever set), and `User` has enough
  `onDelete: Restrict` relations elsewhere that verifying the full deletion blast radius for two already
  -harmless rows wasn't worth the risk under launch time pressure.
- **Confirmed, not fixed: this shared development database is not a direct production candidate.**
  Full audit found ~300 auto-generated integration-test fixture accounts (from repeatedly running
  `*.integration.spec.ts` against this database rather than an isolated one) and three documented,
  intentional development fixtures (`student@test.local`, `student@techimpact.test`, `mentor@test.local`)
  still holding real enrollment/mentor-assignment slots in Cohort 1. Recommendation, documented in
  `docs/runbooks/database-operations.md`: launch on a genuinely fresh database (migrations +
  `identity.seed.ts` only), not by promoting this one.
- **Confirmed live: email is real, not a stub.** SMTP credentials were already configured in this
  environment; a real send was attempted through the configured relay as part of live E2E testing and
  produced a genuine SMTP-level rejection (because the test recipient was intentionally fake) — proving
  the relay is live and reachable, not a console-log stub. Also confirmed: a failed email send does not
  roll back or corrupt the triggering action (a user/enrollment was still created despite the bounce).
- **No dedicated "resend invitation" action exists** — if an invitation email fails to deliver, the
  practical recovery is `POST /auth/forgot-password` once the address is corrected (reuses the existing
  reset-password flow). Documented as a real, disclosed gap rather than built, per this milestone's
  explicit "document as backlog instead of implementing" instruction for anything not required for
  launch itself.
- **New documentation**: `docs/runbooks/production-deployment.md`, `environment-configuration.md`,
  `database-operations.md`, `admin-operations.md`, `student-onboarding.md`, `mentor-onboarding.md`,
  `incident-recovery.md`, `release-checklist.md`, and the top-level
  `docs/PRODUCTION_LAUNCH_CHECKLIST.md` — see that checklist for the complete, item-by-item verified/
  not-verified launch status.

## Milestone 10 — Post-launch stabilization (2026-09-21)

An evidence-driven stabilization pass, not a feature milestone. Project Forge has not yet been
deployed to real production (Milestone 9 concluded "READY WITH DOCUMENTED BLOCKERS"), so there is no
real production error log or user feedback to draw from — this is stated explicitly rather than
invented, per this milestone's own instruction. Evidence instead came from a live, read-only
data-integrity audit of the full Application → Approval → Enrollment → Track → Cohort → Curriculum
Snapshot → Submission → Mentor Review → Chat Membership chain, `docs/KNOWN_TECHNICAL_DEBT.md`'s
accumulated register, and direct code inspection of hot paths this project's own prior live testing
actually exercised. Full findings in `docs/V1.1_ISSUE_REGISTER.md`.

- **Fixed: a real chat-roster gap found by the audit.** An enrolled student was missing from their
  track's chat channel roster — `ChatMembershipSyncService.backfillTrackChannelRoster()` (Milestone 8)
  only ever backfills a channel's roster at the moment that channel is *newly created*, so a channel
  that already existed before that fix shipped never got reconciled. Fixed with a new, permanent,
  idempotent reconciliation script (`apps/api/prisma/repairs/repair-chat-membership.ts`,
  `pnpm --filter @forge/api repair:chat-membership`) — safe to re-run any time, in production too,
  since it only ever adds rows via the existing upsert and never touches access authorization (which
  was already computed live and was never actually affected by this gap). Run once against the live
  database this milestone: 5 track channels reconciled, 1 real gap closed, re-verified at zero
  remaining gaps. `ChatMembershipSyncService` had zero unit test coverage before this milestone despite
  being exactly where the gap lived — 7 new tests added.
- **Fixed: no notification when a mentor reviews a submission.** Directly observed during Milestone 9's
  own live testing (a revision request went unnoticed until the submission was manually re-opened) and
  confirmed by data (100% of this database's 18 ever-created `Notification` rows were
  `dm.message.received` — no application-status, task-review, or mentor-assignment event had ever
  fired one). `SubmissionReviewsService.recordDecision()` now calls the existing
  `NotificationsService.notify()` after recording the decision, reusing the exact fire-and-forget,
  never-blocks-the-transaction pattern `ChatMessagesService.notifyReply()` already established — no new
  notification infrastructure, no new schema. 3 new regression tests.
- **Found, documented, deliberately not fixed: an N+1 query pattern in the mentor review queue.**
  `MentorDashboardService.listReviewQueue()` looks up enrollments, tasks, and review history one ID at
  a time via `Promise.all(ids.map(...))` rather than batched `findMany` calls. Real finding, but no
  measured production slowness exists at Cohort 1's actual scale (capacity 30) — fixing it now would be
  exactly the "premature optimization" this milestone's own instructions warned against. Documented in
  `docs/V1.1_ISSUE_REGISTER.md` (V11-003) and `docs/POST_LAUNCH_BACKLOG.md` with the exact fix already
  described for whoever picks it up once there's a real reason to.
- **Security/isolation regression check: no regression found.** Re-ran the login rate-limit check (5
  attempts through, 6th blocked) and the full automated suite including
  `tenant-isolation.integration.spec.ts` and `chat-websocket-isolation.integration.spec.ts` — every
  previously-fixed boundary from Milestones 8/9 remains intact.
- **New documents**: `docs/V1.1_ISSUE_REGISTER.md` (the full evidence-driven findings register) and
  `docs/POST_LAUNCH_BACKLOG.md` (consolidating deferred items already tracked across
  `docs/KNOWN_TECHNICAL_DEBT.md` and `docs/development-roadmap.md` — nothing newly invented).

## Amendment process

A new permanent decision is added here, dated, when a milestone establishes one. A decision is only ever *superseded* (with the change dated and the reason recorded, as in the Database Naming section above) — never silently deleted, so the history of why the constitution reads the way it does stays intact.
