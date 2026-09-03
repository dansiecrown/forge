# ADR-0009: Administration Platform

**Status:** Accepted
**Date:** 2026-07-30
**Owner:** Lead Engineering

## Context

Milestone 7's brief asked for the complete Administration Platform on top of Milestones 1–6: an
Admin Dashboard, User Management, expanded Organization/Academy/Fellowship/Cohort Management, Role &
Permission Management, an Audit Center, Reports & Analytics, a Communication Center, Certificate
Management, and System Settings — giving Super Admins, Organization Admins, and Academy Admins the
tools to manage the whole platform, while explicitly reusing the existing permission system, audit
logging, Progression Engine, and Curriculum Snapshot architecture rather than replacing them.

Pre-implementation regression check: `pnpm --filter @forge/api test` — 28/28 suites, 164/164 tests
passing. No regressions found, nothing to fix before starting.

**"Administration Platform" spans several previously-separate roadmap concerns** (dashboards,
identity operations, audit, reporting, communications, credentialing, and configuration), so unlike
prior milestones this ADR opens with the one cross-cutting architectural decision every other
feature's placement depends on, before the per-feature reconciliations.

## Decisions

0. **A new cross-cutting `AdminModule` resolves the archive-validation problem (reopens DEBT-016)
   without inverting the one-directional module chain.** `organizations → catalog → cohorts →
   learning` is a strict one-directional chain; validating "does this Academy have active
   Fellowships" from inside `organizations` would require importing `catalog`, and validating "does
   this Fellowship have active Cohorts" from inside `catalog` would require importing `cohorts` —
   both invert the chain. `AdminModule` (`apps/api/src/modules/admin/`) is a new deepest leaf,
   importing `[OrganizationsModule, CatalogModule, CohortsModule, LearningModule, IdentityModule,
   PlatformModule]`, exactly mirroring the shape `LearningModule` already established one level up.
   **Placement rule applied throughout this milestone:** a capability's controller/service lives in
   `AdminModule` *iff* it needs to read/orchestrate across two modules where the natural owner can't
   import the other without inverting the chain; otherwise it's added directly to the owning module,
   exactly like every prior milestone. Concretely: Organization→Academy archive-validation stays
   **inside** `OrganizationsService.archive()` (Academy already lives in the `organizations` module);
   Academy→Fellowship and Fellowship→Cohort validation genuinely need `AdminModule`; Cohort archive
   has no child below it and stays entirely inside `CohortsService` as a new named `archive()` method
   (mirroring `activate`/`pause`/`complete`, delegating to the existing `transition()` state machine
   — `ALLOWED_TRANSITIONS.completed` already listed `'archived'` as a target, so no enum/schema change
   was needed). For Academy/Fellowship, the pre-existing unvalidated routes
   (`POST /academies/:id/actions/archive`, `POST /fellowships/:id/actions/retire`) are left unchanged
   — no existing test breaks — and `AdminModule` adds a second, admin-authoritative entry point
   (`POST /admin/academies/:id/actions/archive`, `POST /admin/fellowships/:id/actions/retire`) that
   runs the child-state check first, then calls straight through to the unmodified service method.
   The same "root module, reachable everywhere, no upstream-of-downstream violation" reasoning also
   placed the Audit Center's read-side and `SystemSettings`'s bare read/write primitive in
   `PlatformModule` rather than `AdminModule` — see Decisions 2 and 5.
1. **Communication Center is a deliberately lighter system than `docs/database-design.md`'s
   outbox-delivered `Notification`/`Announcement` design (reopens DEBT-026), matching the brief's own
   explicit instruction** ("Do NOT implement email providers. Do NOT implement SMS. Backend should
   support future integrations."). `Notification` is append-only with no `channel`/delivery-attempt
   columns — direct synchronous `prisma.notification.createMany` on `Announcement.publish()`, the same
   "scoped-down kernel, no outbox" precedent `AuditLogService`'s own doc comment already established
   in Milestone 2. `NotificationsService` lives in `PlatformModule` specifically so it's a ready-to-
   call primitive for future domain events elsewhere in the chain (submission approved, huddle
   recorded, etc.) — but only `Announcement.publish()` calls it this milestone; retrofitting every
   existing service's domain events to also emit notifications is a materially larger, unscoped
   refactor deliberately left undone. Audience resolution (`AnnouncementsRepository.
   resolveAudienceUserIds`) is scope-driven: `platform` → every active user; `cohort` → active/paused
   enrollments; `academy` → active/invited memberships with that `academyId`; `organization` → active/
   invited memberships in that org.
2. **The Audit Center's entire read-side is new — `AuditLogService` had only ever had `record()`.**
   `AuditLogRepository` (`platform/repositories/audit-log.repository.ts`) is extracted from the
   previously-inline `prisma.auditLog.create` call so `search()`/`getById()` can share the same
   access without duplicating it; `record()`'s signature and error-swallowing behavior are unchanged.
   `search()` is built entirely off the four indexes that already existed on `AuditLog`
   (`(organizationId, occurredAt desc)`, `(actorUserId, occurredAt desc)`, `(entityType, entityId,
   occurredAt desc)`, `(requestId)`) — no new index was needed. The admin-facing `AdminAuditService`
   (in `AdminModule`) always forces the org-scoped route's `organizationId` filter to the caller's own
   active scope — `audit.read` alone would otherwise let a custom tenant role read another
   organization's log via a spoofed query param; a separate `searchPlatform()` method, gated by the
   same `assertPlatformSuperAdmin` helper Decision 0 introduces, is the only path to a genuine
   cross-organization search.
3. **Certificate eligibility omits `docs/database-design.md`'s "mentor recommendation" criterion.**
   The brief's own Certificate Management feature list — templates, generation, issue history,
   verification, PDF generation — never mentions a mentor-recommendation step, and no such concept
   (a mentor "endorsing" a student for graduation) exists anywhere in the codebase built so far. The
   eligibility rule implemented is the other three documented criteria plus admin approval: ≥90%
   required-lesson completion (reusing `summarizeProgress`'s existing `progressPercent` computation,
   zero duplicated gate logic), ≥75% huddle attendance (a new `AdminStatsRepository.
   getAttendanceRateForEnrollment`, since no existing repository computed a per-enrollment rate), and
   every `requiresPracticalWork` module's tasks `completed` (reusing `ProgressionService.
   buildContext`'s already-loaded `ctx.modules`/`ctx.submissions`). `Certificate.eligibilitySnapshot`
   freezes this evidence at issue time — the same "frozen read-model, never recomputed against live
   data" precedent `Cohort.curriculumSnapshot` already established in ADR-0006.
4. **No PDF library, no charting library — both "new technology" triggers were avoided entirely.**
   `docs/database-design.md`'s certificate generation implies a rendering pipeline; instead
   `CertificateTemplate.bodyHtml` is a `{{placeholder}}` template string the frontend fills and prints
   via the browser's native `window.print()` — the backend only ever serves HTML + data, never a
   generated binary artifact. Reports & Analytics' "simple charts only, no predictive analytics" is
   satisfied by a new hand-rolled `<svg>` `BarChart` component
   (`apps/web/src/components/admin/bar-chart.tsx`), matching `ProgressRing`'s exact established
   precedent (theme-token `fill-*`/`stroke-*` classes, `role="img"`, Tailwind transition classes) —
   every `AdminReportsService`/`AdminStatsRepository` endpoint returns pre-aggregated counts/rates
   computed on read, never a stored time-series or forecast.
5. **System Settings is one global singleton row (`SystemSettings.id = 'global'`), not
   `docs/database-design.md`'s fuller 4-scope-level (platform/organization/academy/fellowship)
   versioned key-value engine.** Branding and maintenance mode aren't organization-scoped concepts
   anywhere else in this schema, and the brief's own flat field list (platform branding, default
   theme, feature toggles, password/session/MFA/registration policy, maintenance mode) has no
   per-scope override requirement. `SystemSettingsService` is a bare read/write primitive with no
   authorization inside it — same shape as `AuditLogService`/`NotificationsService` — living in
   `PlatformModule` (reachable from `identity`) specifically so `identity`'s auth flows can eventually
   read live policy without an upstream-of-downstream violation, even though **nothing reads it yet**:
   the stored `passwordPolicy`/`sessionPolicy`/`mfaPolicy`/`featureFlags` fields are served to the
   admin UI for display/editing only this milestone, not wired into `AuthService.login`,
   `PasswordService`, `MfaService`, or `RefreshSessionService`'s token TTL — rewiring already-tested
   authentication code to branch on stored policy is a deeper, riskier change than "build the
   Administration Platform," and is left as a disclosed, clean follow-up. The write surface
   (`AdminSettingsService`, `AdminModule`) is gated by both `platform.settings.manage` and the same
   `assertPlatformSuperAdmin` double-gate as every other platform-wide operation.
6. **User Management's "force password reset" reuses the existing token-based reset-link mechanism
   rather than adding a login-blocking gate.** `UsersService.forcePasswordReset` issues a new
   `PasswordResetToken` and sends the same `password-reset` email template `AuthService.
   forgotPassword` already uses; `AdminUsersService.forcePasswordReset` additionally calls
   `RefreshSessionService.revokeAllForUser` so an already-issued session can't outlive the reset. It
   does **not** add a `mustResetPasswordAt` flag that blocks login until the user resets — that would
   touch `AuthService.login`, the same class of risk flagged in Decision 5. "No direct password
   editing" (an explicit brief requirement) is enforced by omission: no route or service method in
   `AdminModule` ever sets a password directly. `MfaService.adminDisable` is the one new genuinely
   security-sensitive method — an admin-forced MFA disable with no proof-of-possession check, unlike
   the existing self-service `disable()` — reachable only through the `user.mfa.reset`-gated admin
   controller, never a self-service route.

7. **Post-ship fix (2026-07-30): admin visibility is now confined to the caller's own place in the
   org hierarchy, closing `docs/KNOWN_TECHNICAL_DEBT.md` DEBT-015 for the core Academy/Fellowship/
   Cohort/User surface.** A live bug report found two real gaps this milestone shipped with: (a) an
   Academy Admin's admin console showed every Academy/Fellowship/Cohort in the organization, not just
   their own, and (b) the User Management list had **no organization scoping at all** — any admin
   role saw every user on the entire platform. `MembershipsService.getAcademyScope(scope, userId)` is
   the new single source of truth: Super Admin and any organization-scoped role (`ORG_ADMIN`) resolve
   to `{ restricted: false }`; an academy-scoped role (`ACADEMY_ADMIN`) resolves to
   `{ restricted: true, academyId }`, confined to the one Academy its membership is anchored to (or to
   nothing at all if never anchored — mirroring the "cross-tenant read is 404, never 403" convention
   `OrganizationsService.get()` already established, the safe interpretation is always "sees nothing,"
   never "sees everything"). This is enforced at each module's existing existence-check chokepoint —
   `AcademiesService.get()`, `FellowshipsService.get()`, `CohortsService.get()` — since every mutation
   in each service already calls its own `get()` first as a pre-check, gating scope there closes both
   read and write paths with no further per-method changes. `list()` in each service forces the
   restricted caller's own academy id, overriding (never trusting) any client-supplied `academyId`
   query param. `AdminUsersRepository` (new, `AdminModule`, injects `PrismaService` directly — the
   same precedent `AdminStatsRepository` established, since `identity` sits upstream of
   `organizations` in the one-directional chain and must not depend on `Membership`) scopes the User
   Management list/detail by organization membership and, when restricted, by academy via
   `Membership.academyId` or `Enrollment.academyId` (covering both staff and enrolled students).
   **Deliberately not covered by this fix:** the curriculum-content tree (Learning Tracks down through
   Practical Tasks) still only enforces organization scope, via a new `FellowshipsService.
   assertExistsInOrg()` kept deliberately separate from the academy-scoped `get()` — extending scoping
   into curriculum editing, and into Reports/Audit/Certificates/Announcements, is out of scope for this
   fix and tracked as follow-up in DEBT-015's remaining-gap note.

## Consequences

- `docs/database-design.md` remains the schema-design source of truth for the fields it already
  specifies for the fuller outbox-delivered Notification, 4-scope versioned SystemSettings, and
  mentor-recommendation certificate criterion; this ADR is the record of where the live schema
  (`apps/api/prisma/migrations/20260730090000_administration_platform/`) diverges and why.
- `docs/KNOWN_TECHNICAL_DEBT.md` DEBT-016 (Academy/Fellowship archive not validating child-entity
  state) is closed — resolved by `AdminModule`'s composition, not by adding cross-module imports.
  DEBT-026 (Communication Center's fuller documented design) is closed by disclosure — the narrower
  direct-persistence model is the intended implementation, not a gap. DEBT-015 (academy-scoped
  permission enforcement) is closed for the Academy/Fellowship/Cohort/User surface by Decision 7,
  with a disclosed remaining gap for curriculum-content editing and Reports/Audit/Certificates/
  Announcements.
- New technical debt opened: password/session/MFA policy fields are stored and admin-editable but not
  yet enforced anywhere in `identity`; `featureFlags` is a single platform-wide boolean map, not a
  per-organization governed rollout system; certificate PDF generation depends on the browser's print
  dialog, with no server-side rendering fallback; `SystemSettings` has no scope hierarchy or
  change-history table, only optimistic-concurrency `version`; Communication Center notifications are
  triggered by announcement publish only, not by other domain events; Reports & Analytics' at-risk/
  activity figures inherit Mentor Experience's existing simple-heuristic caveats (ADR-0008 Decision
  6) rather than introducing new ones.
- No Redis/BullMQ, background jobs, email/SMS providers, object storage, video processing, AI
  features, search indexing, or production-hardening/observability work was built — all explicitly
  out of scope per the milestone brief.
- The `AdminModule` composition pattern (Decision 0) is a standing architectural precedent, not just
  an implementation detail: any future milestone needing a capability that spans two modules in the
  existing chain without an already-established import path should extend `AdminModule` (or a
  similarly-scoped new leaf module) rather than adding a new inter-module import that risks a cycle.
