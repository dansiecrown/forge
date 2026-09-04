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

## Amendment process

A new permanent decision is added here, dated, when a milestone establishes one. A decision is only ever *superseded* (with the change dated and the reason recorded, as in the Database Naming section above) — never silently deleted, so the history of why the constitution reads the way it does stays intact.
