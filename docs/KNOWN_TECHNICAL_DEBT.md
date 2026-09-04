# Known Technical Debt

Intentionally deferred engineering items — tracked here rather than silently dropped, so a debt item is a documented decision, not a forgotten bug. Most were surfaced by the Engineering Readiness Review (2026-07-23) and the Architecture Lock milestone (2026-07-24); nothing here blocks Milestone 3 unless its "Planned milestone" says otherwise.

Format: **ID** — Title, then Description / Priority / Reason for deferral / Planned milestone.

---

**DEBT-001 — Membership optimistic concurrency**
- **Description:** `docs/api-specification.md` documents a `version` field for `PATCH /memberships/:id`, but `Membership` has no `version` column, so the endpoint can't implement the documented concurrency contract (unlike `Role`, which does have one).
- **Priority:** Medium
- **Reason for deferral:** No membership-management UI exists yet, so there is no real concurrent-edit scenario to protect against today. Adding an unused column now would be speculative schema change ahead of need.
- **Planned milestone:** Whichever milestone first builds membership-management UI (roadmap Phase 4, tenant/platform administration).

**DEBT-002 — Membership reactivation / non-partial unique constraint**
- **Description:** `memberships`' unique constraint on `(organization_id, user_id)` is not partial on status. A former member (status `ended`) cannot currently be re-invited into the same organization — `POST /users/invitations` now correctly returns `409 ALREADY_MEMBER` for this case rather than a raw `500`, but reactivating an ended membership (vs. creating a fresh one, vs. preserving history) is not implemented.
- **Priority:** Medium
- **Reason for deferral:** Requires a product decision about ended-membership semantics (does history persist? does re-joining reset role grants?), not a mechanical bug fix. Guessing this now risks building the wrong model.
- **Planned milestone:** Same milestone as DEBT-001, or whenever an "offboard then re-invite" flow becomes a real product requirement.

**DEBT-003 — Per-endpoint rate limiting**
- **Description:** Rate limiting is one flat global rule (300 req/min/IP) rather than the documented per-endpoint tiers (sign-in/reset 5/15 min, refresh 30/min, etc.) in `docs/system-architecture.md` §6.
- **Priority:** Medium-High
- **Reason for deferral:** Explicitly scoped out of Milestone 2's "right-sized kernel" (ADR-0003) — proper tiered limiting belongs with the fuller observability/rate-limit kernel from roadmap Phase 2, not bolted on ad hoc.
- **Planned milestone:** Phase 2 kernel revisit, or Phase 12 (production hardening) at the latest.

**DEBT-004 — Mandatory MFA enforcement**
- **Description:** TOTP MFA enrollment/verification is fully built and works, but nothing yet *requires* enrollment for admins/mentors at first sign-in or for students at cohort start, as `docs/system-architecture.md` §6 specifies.
- **Priority:** High
- **Reason for deferral:** Enforcing this needs an onboarding/enrollment-gating flow that doesn't exist yet — no onboarding UI was in Milestone 2's scope.
- **Planned milestone:** Roadmap Phase 5 (web shell / onboarding foundation), or sooner if an admin/mentor role ships before then.

**DEBT-005 — No domain entity layer**
- **Description:** `apps/api/src/modules/*` has no `entities/` layer; repositories return raw Prisma types (`User`, `Role`, `Membership`, …) straight through services to controllers, contradicting `docs/project-structure.md` §4's module shape.
- **Priority:** Low-Medium (maintainability, not correctness)
- **Reason for deferral:** Introducing a domain-entity/mapping layer for a single module (identity) now, with no second module to validate the pattern against, risks building the wrong abstraction. Better proven once Organizations/Catalog exist.
- **Planned milestone:** Milestone 3 or 4, once a second module's domain rules can validate the pattern.
- **Status (2026-07-25):** Resolved for the three modules Milestone 3 added to (`organizations`'s Organization/Academy additions, `catalog`, `cohorts`) — each has an `entities/` layer with a `to<Name>Entity()` mapper; controllers return entities, never raw Prisma rows. The original identity/roles modules are unchanged; retrofitting them remains open, separate debt.

**DEBT-006 — Role rename not implemented**
- **Description:** `docs/api-specification.md` documents `PATCH /roles/:roleId` accepting a `name` field (role rename); `UpdateRolePermissionsDto` only accepts `permissionIds`. A spec-conforming request that includes `name` is rejected outright by the global `forbidNonWhitelisted` validation pipe.
- **Priority:** Low
- **Reason for deferral:** Implementing rename is a small new capability (service logic + audit copy), not a mechanical DTO fix — out of scope for an architecture-lock pass that must not expand functionality.
- **Planned milestone:** Alongside Milestone 4 (tenant/platform administration), when role management UI is built.

**DEBT-007 — `GET /users` and `GET /users/:userId` response shape**
- **Description:** `GET /users` returns raw Prisma `User` rows (including internal fields like `deletedAt`) instead of the documented `{id,displayName,roles}` shape, and omits `roles` entirely. `GET /users/:userId` returns a flat shape instead of the documented `{user,membership,capabilities}` nesting.
- **Priority:** Medium (touches data minimization, not just contract accuracy)
- **Reason for deferral:** A correct fix needs a real response-mapping/serialization decision (which fields are safe to expose; how "roles" and "capabilities" are computed across the caller's scope) — best done alongside DEBT-005's entity/mapping layer rather than patched ad hoc.
- **Planned milestone:** Same milestone as DEBT-005.

**DEBT-008 — `InviteUserDto` requires an undocumented field**
- **Description:** `InviteUserDto` requires `displayName`, which the `docs/api-specification.md` request sample for `POST /users/invitations` doesn't show.
- **Priority:** Low
- **Reason for deferral:** Harmless as implemented (an inviting admin naturally knows the invitee's name); low value to change in isolation.
- **Planned milestone:** Bundle with the next `docs/api-specification.md` §4.2 pass (see DEBT-006/007).

**DEBT-009 — CSRF mitigation is SameSite=Lax only**
- **Description:** No dedicated CSRF token exists for the cookie-bearing refresh endpoint; `SameSite=Lax` is the sole mitigation (documented in ADR-0003 since Milestone 2).
- **Priority:** Medium
- **Reason for deferral:** Acceptable for the current low-value action surface (auth only); revisit before the refresh-cookie flow guards higher-value actions (e.g. payments).
- **Planned milestone:** Before Phase 9 (payments foundation), or Phase 12 (hardening) at the latest.

**DEBT-010 — No `created_by`/`updated_by` attribution columns**
- **Description:** `docs/database-design.md` §1 lists `created_by`/`updated_by` as standard on every mutable tenant record; no model has them.
- **Priority:** Low
- **Reason for deferral:** Threading actor attribution through every write path across every module is a larger, cross-cutting change than a targeted fix — better done once, deliberately, than piecemeal per module.
- **Planned milestone:** Phase 2 kernel revisit or Phase 12 (hardening).

**DEBT-011 — No breach-password screening**
- **Description:** Password strength validation exists (length, letter+digit, common-password denylist) but does not check against a breach-password corpus (e.g. HaveIBeenPwned-style k-anonymity lookup), as conditionally specified in `docs/system-architecture.md` §6 ("where legally/operationally approved").
- **Priority:** Low
- **Reason for deferral:** Explicitly conditional on legal/operational approval in the original architecture doc — not yet sought.
- **Planned milestone:** Phase 12 (hardening), if/when approved.

**DEBT-012 — No end-to-end test suite**
- **Description:** `docs/project-structure.md` §4 documents `apps/api/test/{contract,e2e,support}/`; none exist. `supertest`/`@types/supertest` are installed in anticipation but unused.
- **Priority:** Medium
- **Reason for deferral:** Didn't block Milestone 2 delivery (unit/guard test coverage is solid — 32 passing specs); all verification since has been done via live manual HTTP testing against a real database instead, which is thorough but not repeatable/automated.
- **Planned milestone:** Before Milestone 3's feature surface grows significantly — the manual-verification approach doesn't scale past one module.

**DEBT-013 — `AuthController` bypasses its service layer for sessions**
- **Description:** `AuthController` injects `AuthSessionsRepository` directly for session listing/revocation instead of going through a service, inconsistent with the rest of the module.
- **Priority:** Low
- **Reason for deferral:** Cosmetic architecture inconsistency with no correctness impact; not worth the regression risk of touching tested, working auth code outside a dedicated pass.
- **Planned milestone:** Opportunistic — next time `AuthController` is touched for an unrelated reason.

**DEBT-014 — `MembershipsController` hand-rolls authorization instead of using the shared guard**
- **Description:** `MembershipsController` implements its own `assertPermission`/`assertSelfOrPermission` checks instead of the `@RequirePermissions` + `PermissionsGuard` mechanism `RolesController`/`PermissionsController`/`UsersController` use.
- **Priority:** Low-Medium
- **Reason for deferral:** Works correctly today (covered by existing tests); refactoring authorization code carries real regression risk that isn't worth taking without dedicated test coverage written specifically for the refactor.
- **Planned milestone:** Alongside DEBT-005/DEBT-007, when the module gets broader attention.

**DEBT-015 — Academy-scoped permission enforcement is anchored but not deep — CLOSED for the core hierarchy (2026-07-30)**
- **Description:** Milestone 3 added `Membership.academyId` (per ADR-0003's deferral) so an academy-scoped membership (e.g. `ACADEMY_ADMIN`) can point at a specific `Academy` row. `PermissionResolverService` was not extended to actually use it — resolved permissions are still purely organization-scoped; nothing currently checks that an `ACADEMY_ADMIN`'s actions stay within their own academy.
- **Priority:** Medium
- **Status (2026-07-29):** `MENTOR`'s cohort-scoping gap is closed — Milestone 6's
  `assertMentorAssignedToCohort` helper plus the tightened `ProgressionService.assertCanRead` now
  enforce that a mentor can only read a learner's progress/curriculum/portfolio data when actively
  assigned to that learner's cohort (`docs/adr/0008-mentor-experience.md` Decision 3). This debt item
  remains open for `ACADEMY_ADMIN` specifically — an academy-scoped admin's actions are still not
  checked against their own academy anywhere.
- **Resolution (2026-07-30):** A live bug report ("Academy Admin sees all academies, not just their
  own") surfaced that Milestone 7's new admin surface had exactly this gap, plus a second,
  worse one: the User Management list had *zero* organization scoping at all (any authenticated
  admin saw every user on the platform). Fixed by adding `MembershipsService.getAcademyScope()` —
  Super Admin and any organization-scoped role (`ORG_ADMIN`) resolve to unrestricted; an
  academy-scoped role resolves to `{ restricted: true, academyId }`, confined to the one Academy
  its membership is anchored to (or to nothing, if never anchored — the safe default). This is
  enforced at each module's existing existence-check chokepoint (`AcademiesService.get`,
  `FellowshipsService.get`, `CohortsService.get` — every mutation already routes through `get()`
  first, so gating it there closes read *and* write paths in one place), plus a new
  `AdminUsersRepository` (Prisma-direct, same precedent as `AdminStatsRepository`) that scopes the
  User Management list/detail by organization membership and, when restricted, by academy
  (`Membership.academyId` or `Enrollment.academyId`). See `docs/adr/0009-administration-platform.md`
  Decision 6.
- **Remaining gap (not closed):** The curriculum-content tree (Learning Tracks/Courses/Weekly
  Modules/Lessons/Resources/Practical Tasks) does not carry caller identity through its own internal
  existence-check chain (`LearningTracksService` etc. call the new `FellowshipsService.assertExistsInOrg`,
  an org-scope-only check, deliberately not the academy-scoped `get()`) — an Academy Admin can still
  read/edit curriculum content nested under a fellowship outside their academy. Also not covered:
  Reports, Audit Center, Certificates, Announcements. Tracked as follow-up; out of scope for this fix
  (the reported gap was Academy/Fellowship/Cohort/User visibility specifically).
- **Planned milestone:** Curriculum-tree and Reports/Audit/Certificates/Announcements academy-scoping,
  next time either surface gets dedicated attention.

**DEBT-016 — Academy archive / Fellowship retire do not block on active descendants — CLOSED (2026-07-30)**
- **Description:** `docs/database-design.md` documents Academy as "cannot delete while active fellowship/cohort records exist" and Fellowship as "never delete with cohorts." Neither was enforced — archiving an Academy with active Fellowships/Cohorts beneath it, or retiring a Fellowship with active Cohorts, previously succeeded.
- **Resolution:** Milestone 7 added a new cross-cutting `AdminModule` (`apps/api/src/modules/admin/`) that imports both sides of the chain and validates child-entity state before delegating to the unmodified `AcademiesService.archive()`/`FellowshipsService.retire()` — a new top-level composition point above the chain, not an inverted import. New routes `POST /admin/academies/:id/actions/archive` and `POST /admin/fellowships/:id/actions/retire` are the validated entry points; the original unvalidated routes are left in place for backward compatibility. See `docs/adr/0009-administration-platform.md` Decision 0.
- **Planned milestone:** Resolved in Milestone 7 (Administration Platform).

**DEBT-017 — Admin UI ships ahead of the Phase-5 web application shell**
- **Description:** `apps/web/src/layouts/admin-layout.tsx` is a minimal, purpose-built shell (sidebar nav + org switcher) for the four Milestone 3 admin sections. `docs/development-roadmap.md` Phase 5 describes a fuller "web application shell and shared experience foundation" (route/cache conventions, shared session/tenant/theme context patterns) that doesn't exist yet.
- **Priority:** Low
- **Reason for deferral:** Building the full Phase-5 shell was out of scope for this milestone's brief; the minimal layout unblocks the four required admin sections without pre-building unrequested infrastructure.
- **Planned milestone:** Phase 5, when the admin layout should be reconciled with (likely absorbed into) the real web shell.

**DEBT-019 — No real per-cohort Mentor Huddle scheduling or attendance evidence**
- **Description:** `docs/database-design.md` documents a per-cohort `MentorHuddle` entity (scheduled
  session instances tied to a specific running Cohort) and an `Attendance` evidence table feeding
  certificate eligibility. Milestone 4 implements only curriculum-template-level metadata on
  `WeeklyModule` (`huddleScheduleMetadata`, `huddleMeetingLink`, `mentorHuddleNotes`,
  `huddleAttendanceRequired`) — a default/placeholder for what a huddle should look like, not an
  actual scheduled event a cohort's mentor and learners attend.
- **Priority:** Medium
- **Reason for deferral:** The milestone brief explicitly excludes attendance tracking ("Do NOT
  implement attendance tracking"); building the real per-cohort entity without attendance would be a
  half-feature. See `docs/adr/0006-curriculum-learning-engine.md` Decision 6.
- **Planned milestone:** Whichever milestone builds mentor workflows generally (roadmap Phase 8) or
  certificates (Phase 9, which needs attendance evidence for eligibility).
- **Status (2026-07-29):** Resolved in substance, narrowed in scope. Milestone 6 built real per-cohort
  `HuddleSession`/`HuddleAttendance` entities — a mentor now records what happened after the fact
  (notes, discussion topics, action items, per-student attendance) and it is stored against the actual
  running cohort, not just curriculum-template metadata. What remains deliberately unbuilt, per the
  brief's explicit "No scheduling system. No calendar. No Zoom integration": no scheduled
  start/end times or status lifecycle, no meeting/joining URL, no recording asset, no recurrence, and
  attendance is 3-value (`present/absent/excused`) rather than the documented 4-value
  (`present/late/absent/excused`). See `docs/adr/0008-mentor-experience.md` Decision 1.

**DEBT-020 — Full curriculum versioning/fork system not built**
- **Description:** `docs/database-design.md` documents `curriculum_version`/`completion_policy_version`
  fields, "published course immutable except through new version," a
  `POST /fellowships/:id/actions/create-version` fork endpoint, and a `cohort_week_release` join.
  Milestone 4 implements a lighter Cohort-level JSON snapshot with an explicit per-cohort sync action
  instead (see `docs/adr/0006-curriculum-learning-engine.md` Decision 1) — curriculum entities are
  always edited in place; there is no version history, no diffing, no way to see what a specific past
  cohort's curriculum literally looked like beyond its still-stored snapshot blob.
- **Priority:** Medium
- **Reason for deferral:** This was an explicit, disclosed product-owner decision (edit-in-place with
  a sync action), not an oversight. The documented design's main purpose — protecting certificate/
  assessment integrity against retroactive curriculum edits — doesn't apply yet since neither exists.
- **Planned milestone:** Whichever milestone builds certificates (roadmap Phase 9), if strict
  versioned immutability turns out to be required for certificate eligibility audits.

**DEBT-021 — `unlockRules`, `completionCriteria`, and `rubricMetadata` are stored but not
machine-interpreted**
- **Description:** `WeeklyModule.unlockRules`, `Course.completionCriteria`, and
  `PracticalTask.rubricMetadata`/`maxScore` are free-form `Json?`/text fields, editable and displayed
  in the admin UI, but the Progression Engine (`ProgressionService`) uses a fixed gate rule (all
  required lessons/resources/tasks) rather than actually reading `unlockRules`, and nothing enforces
  `completionCriteria` or scores against `rubricMetadata`/`maxScore`.
- **Priority:** Low
- **Reason for deferral:** Building a generic rules-interpreter or a grading system is explicitly out
  of scope this milestone ("Do NOT build grading yet"). These fields exist so the data model doesn't
  need a breaking migration once grading/custom unlock logic is actually built.
- **Planned milestone:** Whichever milestone adds real assessment/grading (roadmap Phase 9).

**DEBT-018 — Super Admin has no UI path into an organization they just provisioned but aren't a member of**
- **Description:** The admin UI's organization switcher lists only organizations the signed-in user has a `Membership` row in. A platform Super Admin can provision any organization (`POST /organizations`) without automatically becoming a member of it, so after creating one they have no way, in the UI, to switch into it and manage its Academies/Fellowships/Cohorts — only its Organizations-section profile/lifecycle, which don't require the org-switcher.
- **Priority:** Medium
- **Reason for deferral:** Found live during UI verification. Fixing it well requires a product decision (auto-grant the provisioning Super Admin a membership? add a separate "any organization" picker for platform admins?) rather than a mechanical patch.
- **Planned milestone:** Alongside Phase 4's fuller platform-governance UI, when Super Admin's day-to-day tenant-management workflow gets dedicated design attention.

**DEBT-022 — File uploads unsupported for Practical Task submissions**
- **Description:** The Student Experience milestone brief asked for file uploads as a submission
  type. No object-storage infrastructure exists anywhere in the codebase (no `FileAsset` model, no
  multer/S3/MinIO adapter) — `docs/system-architecture.md` §9 places it explicitly in Phase 2 kernel
  scope as security-sensitive work (malware scan-gate, retention policy, signed URLs). Practical Task
  submissions support a GitHub repository URL and a live demo URL only.
- **Priority:** Medium
- **Reason for deferral:** An explicit, disclosed product-owner decision before implementation began
  (see `docs/adr/0007-student-experience.md` Decision 1), not an oversight — building real file
  storage inside a student-UI milestone would mean improvising unreviewed security-sensitive
  infrastructure.
- **Planned milestone:** Whichever milestone builds the real `FileAsset`/object-storage system
  (Phase 2 kernel revisit).

**DEBT-023 — `under_review` submission status is unreachable**
- **Description:** `PracticalTaskSubmission.status` is a five-value enum (`draft, submitted,
  under_review, revision_requested, completed`). Prior to Milestone 6, only `draft` and `submitted`
  were reachable. The other three exist in the data model and render with distinct UI badges, but no
  code path can currently set them.
- **Priority:** Low
- **Reason for deferral:** Same pattern as the existing DEBT-021 — the field/value exists so the data
  model doesn't need a breaking migration if a "claimed for review" step is ever added.
- **Planned milestone:** Whichever milestone needs an explicit "a mentor has started reviewing this"
  state, if one is ever required.
- **Status (2026-07-29):** Narrowed by Milestone 6. `revision_requested` and `completed` are now fully
  reachable via `POST /practical-task-submissions/:id/actions/{request-revision,approve}` — see
  `docs/adr/0008-mentor-experience.md` Decision 2. Only `under_review` remains unreachable: the
  brief's review lifecycle has no "claimed for review" step, a mentor decides atomically (approve or
  request revision), so this state stays intentionally unreachable rather than being forced in.

**DEBT-024 — Learning Streak and "time spent learning" are estimates, not measured engagement**
- **Description:** No session/activity-tracking infrastructure exists. "Streak" is computed from
  existing lesson-completion/resource-acknowledgment/practical-task-submission timestamps (consecutive
  local calendar days with at least one event); "time spent learning" (`estimatedMinutesLearned`) is
  the sum of `estimatedDurationMinutes` across completed lessons and acknowledged resources — planning
  metadata, not measured actual usage time.
- **Priority:** Low
- **Reason for deferral:** Real engagement measurement needs an event-log/session-tracking system,
  which is Phase 11 analytics-sized work, not a student-UI-milestone addition. Both values are
  honestly named in the API (`estimatedMinutesLearned`) to avoid overstating precision.
- **Planned milestone:** Phase 11 (Analytics, reports, leaderboards), if real engagement measurement
  becomes a product requirement.

**DEBT-025 — Portfolio has no real public route, consent workflow, or versioning**
- **Description:** `docs/database-design.md` §6 documents a fuller `Portfolio`/`PortfolioItem`/
  `Project` system with `unlisted` visibility, timestamped explicit consent, custom theming, and SEO
  metadata, plus a public verification-style route. This milestone's `PortfolioProject` has only
  `private`/`public` visibility, stores a `publicSlug` on publish, but serves it through no real
  unauthenticated route — the frontend renders it as inert, copy-only text ("placeholder only," per
  the brief), verified live to not be a functioning link.
- **Priority:** Medium
- **Reason for deferral:** Same reconciliation pattern as ADR-0006 Decision 4 (Assignment ->
  PracticalTask) — a real public-facing portfolio needs the consent/security review the fuller
  documented design calls for, which is out of scope this milestone.
- **Planned milestone:** Whichever milestone builds Certificates/public verification generally
  (roadmap Phase 9).

**DEBT-027 — Submission Review has no rubric scoring or attempt-versioned resubmission history**
- **Description:** `docs/database-design.md` §4 documents a full Assignment/Submission/Review system
  with `attempt_number`-versioned resubmission (each resubmit is a new row) and rubric scoring.
  Milestone 6's `SubmissionReview` is append-only (every review decision is a permanent row, so the
  full feedback history is preserved), but the underlying `PracticalTaskSubmission` itself is
  upserted, not versioned — a resubmission overwrites the same row's `repositoryUrl`/`liveDemoUrl`,
  matching Milestone 5's existing "editing reverts to draft" precedent. There is no way to see what a
  specific past attempt's actual repo/demo links were, only that a revision was requested and when.
- **Priority:** Low
- **Reason for deferral:** Same reconciliation pattern as ADR-0006 Decision 4 (Assignment ->
  PracticalTask) and ADR-0007 Decision 3 (Portfolio) — the fuller documented design is Phase 9
  (Assessments) territory, which also needs rubric scoring infrastructure that doesn't exist.
- **Planned milestone:** Whichever milestone builds real graded Assignments (roadmap Phase 9).

**DEBT-028 — At-risk/inactive heuristics are placeholder, pending product-approved criteria**
- **Description:** `docs/development-roadmap.md` lists "approved risk/at-risk definitions" as an
  explicitly pending dependency. Milestone 6 ships simple, transparent heuristics computed on read
  (inactivity: no progression event in 7+ days; falling behind: 15+ percentage points below the
  cohort's median progress) rather than waiting on product-approved thresholds that don't exist yet.
- **Priority:** Low
- **Reason for deferral:** The roadmap itself frames this as a pending product decision, not an
  engineering gap — building the real thing requires input this milestone doesn't have. Every
  `atRisk: true` is paired with a plain-language reason string so the placeholder nature is visible
  to the mentor, never presented as an authoritative score.
- **Planned milestone:** Whenever product defines approved risk criteria — likely alongside roadmap
  Phase 11 (Analytics) or sooner if mentor feedback demands it.

**DEBT-029 — Mentor notes are team-visible within a cohort, not per-author-private**
- **Description:** `MentorNote` has no per-author read/write restriction — any mentor actively
  assigned to a cohort can read, edit, or delete any note written by any other mentor about a shared
  student. There is no concept of a private, author-only note.
- **Priority:** Low
- **Reason for deferral:** An explicit design choice (`docs/adr/0008-mentor-experience.md` Decision
  6), not an oversight — a shared "team notebook" was judged more useful than an ACL for co-mentored
  cohorts, and every mutation is audit-logged for accountability. Revisit only if a real product need
  for author-private notes emerges.
- **Planned milestone:** Not currently planned; revisit on product request.

**DEBT-026 — Notification Center and Notification Preferences are frontend-only placeholders — PARTIALLY CLOSED (2026-07-30)**
- **Description:** The header bell, the full `/portal/notifications` page, and Settings ->
  Notifications all render hardcoded placeholder data with local component/`localStorage` state only.
  Previously no `Notification` Prisma model, no `GET /notifications`, no
  `GET/PATCH /notification-preferences` existed at all.
- **Status (2026-07-30):** Milestone 7 built a real `Notification` model and
  `GET /me/notifications` / `POST /me/notifications/:id/actions/mark-read` (`PlatformModule`'s
  `NotificationsService`), populated by `Announcement.publish()`'s audience fan-out — see
  `docs/adr/0009-administration-platform.md` Decision 1. The frontend header bell,
  `/portal/notifications` page, and Settings -> Notifications tab were **not** rewired to this new
  backend this milestone (out of explicit scope — Milestone 7 is the Administration Platform, not a
  portal-UI pass) and still render placeholder data; no `GET/PATCH /notification-preferences` exists.
- **Priority:** Low
- **Reason for deferral:** The remaining frontend-wiring gap is a portal-UI task, not an
  Administration Platform one; `NotificationsService` is a ready-to-call primitive waiting for it.
- **Planned milestone:** Whichever milestone next touches the student/mentor portal notification UI.

**DEBT-027 — System Settings policy fields are stored/editable but not enforced**
- **Description:** `SystemSettings.passwordPolicy`/`sessionPolicy`/`mfaPolicy`/`featureFlags` are
  admin-readable and admin-editable via `GET/PATCH /admin/settings`, but nothing in the `identity`
  module reads them — password strength rules, session TTL, MFA requirements, and registration
  gating all still run on their existing hardcoded/config-driven behavior.
- **Priority:** Medium
- **Reason for deferral:** `SystemSettingsService` is deliberately exported from `PlatformModule`
  (reachable from `identity`, no chain inversion) so wiring is a clean follow-up, but actually
  rewiring already-tested authentication flows to branch on stored policy is a materially riskier
  change than this milestone's "build the Administration Platform" scope. See
  `docs/adr/0009-administration-platform.md` Decision 5.
- **Planned milestone:** Whichever milestone next revisits `identity`'s auth policy enforcement.

**DEBT-028 — `SystemSettings`/`featureFlags` are single global values, not per-organization**
- **Description:** `docs/database-design.md`'s System Settings design and `docs/api-specification.md`
  §5's `GET/PATCH /platform/feature-flags/:key` describe a 4-scope-level (platform/organization/
  academy/fellowship) versioned configuration/rollout system. This milestone implements one global
  singleton row and one platform-wide `featureFlags` JSON boolean map instead.
- **Priority:** Low
- **Reason for deferral:** Disclosed, deliberate narrowing — branding/maintenance mode aren't
  organization-scoped concepts anywhere else in this schema, and the brief's own flat field list has
  no per-scope override requirement. See ADR-0009 Decision 5.
- **Planned milestone:** Not currently planned; revisit if a real per-organization override need
  emerges.

**DEBT-029 — Certificate PDF generation has no server-side fallback**
- **Description:** Certificates render as `{{placeholder}}`-templated HTML the frontend prints via
  the browser's native `window.print()`. There is no server-side PDF rendering, so a certificate
  cannot be generated headlessly (e.g. for an automated email attachment) without a browser.
- **Priority:** Low
- **Reason for deferral:** Explicit brief instruction to avoid a new PDF-generation dependency. See
  ADR-0009 Decision 4.
- **Planned milestone:** If/when automated certificate delivery (email attachment) is built.

**DEBT-030 — Communication Center notifications are triggered by announcement publish only**
- **Description:** `NotificationsService.notify()`/`notifyMany()` are generic, ready-to-call
  primitives, but no existing domain event elsewhere in the codebase (submission approved, huddle
  recorded, mentor note added, certificate issued, etc.) calls them — only
  `AnnouncementsService.publish()` does.
- **Priority:** Low
- **Reason for deferral:** Retrofitting every existing service's domain events to also emit
  notifications is a materially larger, unscoped refactor than "Communication Center." See ADR-0009
  Decision 1.
- **Planned milestone:** Not currently planned; revisit on product request for specific event-driven
  notifications.

**DEBT-031 — Public fellowship landing page's catalog is cross-tenant, not scoped to Tech Impact Fellowship**
- **Description:** `GET /public/fellowships` (ADR-0010) is deliberately cross-tenant — its response
  has no organization identifier to filter on. The new public landing page (ADR-0011) presents
  itself specifically as Tech Impact Fellowship but consumes this same unscoped endpoint verbatim.
  In the platform's current single-tenant-in-practice state this shows the correct data; if a
  second organization ever also marks a fellowship public, this page would start listing their
  tracks/cohorts too.
- **Priority:** Low
- **Reason for deferral:** Fixing it means adding an organization filter to a deliberately
  cross-tenant, already-shipped public contract also used by the generic authenticated `/apply`
  picker — a real API-contract change, not something this scope item's landing page alone should
  force through.
- **Planned milestone:** Whenever a second organization's public-catalog visibility is a real
  product need.

**DEBT-032 — Public landing page's API base URL has no build-time environment injection**
- **Description:** `apps/web/public/fellowship/script.js` hardcodes `http://localhost:3000/api/v1`
  (matching the React app's own fallback) behind a `window.FELLOWSHIP_API_BASE_URL` override,
  since static assets under `public/` get none of Vite's `VITE_*` env handling the way `apps/web/src`
  does.
- **Priority:** Low
- **Reason for deferral:** No existing mechanism in this repo injects env values into `public/`
  assets; building one is a bigger, separately-scoped change than this one static page needs.
- **Planned milestone:** Before this page is deployed anywhere the API isn't reachable at that
  default origin — set `window.FELLOWSHIP_API_BASE_URL` (e.g. via a small inline script the actual
  deploy pipeline templates in) at that point.
