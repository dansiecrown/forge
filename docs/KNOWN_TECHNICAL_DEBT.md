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

**DEBT-003 — Per-endpoint rate limiting — CLOSED (2026-09-21, Milestone 8)**
- **Description:** Rate limiting is one flat global rule (300 req/min/IP) rather than the documented per-endpoint tiers (sign-in/reset 5/15 min, refresh 30/min, etc.) in `docs/system-architecture.md` §6.
- **Status (2026-09-21):** Closed. `@Throttle({ default: { limit, ttl } })` overrides added to login (5/min), refresh (20/min), forgot-password (3/min), reset-password (5/min), resend-verification (3/min), every MFA route (5/min), invitations (20/min), and chat/DM message-send and conversation-start (20-30/min) — all on top of the unchanged 300/min global default. Tracked per-IP, same as the global default; see DEBT-037 below for why per-authenticated-user tracking wasn't added in the same pass. Verified live (6 rapid login attempts: first 5 pass through to real auth logic, 6th returns `429 RATE_LIMITED`).
- **Priority:** N/A (closed)
- **Planned milestone:** N/A (closed).

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

**DEBT-026 — Notification Center and Notification Preferences are frontend-only placeholders — CLOSED for the Notification Center (2026-09-06); Preferences remains open**
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
- **Status (2026-09-06): Notification Center closed.** The bell and full Notification Center page
  (now mounted in all three role layouts — Admin/Mentor/Student, not just Student) are wired to real
  data. Added `POST /me/notifications/:id/actions/mark-unread` and
  `POST /me/notifications/actions/mark-all-read` (only `mark-read` existed before). Clicking a
  notification navigates to its source when one exists for the caller's role, or opens a popup with
  the full title/body when it doesn't (no recipient-facing announcement page, and no Admin chat
  surface, exist yet — see `resolveNotificationTarget`). **Still open:** Settings -> Notifications
  remains client-only `localStorage` toggles with no backend enforcement, and its preference keys
  don't correspond to any real notification `type` string — genuinely unrelated to what this closed
  (the flaw item that prompted this work was about the Notification Center display/interaction, not
  preference filtering).
- **Priority:** Low (Preferences only; Notification Center is closed)
- **Reason for deferral (Preferences only):** No `GET/PATCH /notification-preferences` endpoint or
  server-side filtering exists; building real preference enforcement is a separate, unscoped feature.
- **Planned milestone:** Not currently planned; revisit on product request for real notification
  preference enforcement.

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

**DEBT-033 — Academy/Fellowship/Cohort detail pages 404 for a Super Admin deep-linking directly,
without first visiting that organization's own detail page**
- **Description:** ADR-0012 fixed the primary hierarchy drill-down path (Organizations list → an
  org's own detail page → its academies/fellowships/cohorts) by having `OrganizationDetailPage` set
  the active-organization context to whatever `orgId` it's showing. A Super Admin who instead pastes
  a raw Academy/Fellowship/Cohort URL directly, without visiting that org's detail page first, keeps
  whatever organization their switcher last had selected — and `AcademiesService`/
  `FellowshipsService`/`CohortsService`'s `get()` all filter by `organizationId` in the same
  database query used to look the resource up (unlike `OrganizationsService.get()`, which looks up
  by id first and checks Super Admin status before enforcing an org match) — so a mismatch reads as
  "not found," even for a genuine Super Admin.
- **Priority:** Low — the primary navigation flow this task asked for works correctly; this is a
  deep-link edge case.
- **Reason for deferral:** Fixing it fully means giving `AcademiesService.get()`/
  `FellowshipsService.get()`/`CohortsService.get()` the same "look up by id first, then check Super
  Admin before enforcing the org-scope match" pattern `OrganizationsService.get()` already has — a
  change to three services' core lookup path, wider than this hierarchy/UX-focused task should carry
  as a side effect.
- **Planned milestone:** If direct deep-linking into another organization's hierarchy (rather than
  drilling down from its own Organizations entry) becomes a real Super Admin workflow.

**DEBT-034 — Fellowship chat has no `@mention` notifications — username blocker CLOSED (2026-09-06), `@mention` parsing itself still not built**
- **Description:** `ChatMessagesService.notifyReply()` (ADR-0014 Decision 5) notifies a message's
  author when someone replies to it, via `replyToMessageId` — an unambiguous, already-real relation.
  It does not implement `@mention` parsing/notification. `User` had no handle/username field to
  match a `@foo` token against (only `displayName`, which isn't unique, and `emailCanonical`, which
  isn't something you'd type in a message).
- **Status (2026-09-06):** `User.username` (unique, nullable) now exists — added for admin user
  creation and self-service Settings, see `docs/adr/0009-administration-platform.md`'s addendum —
  removing the schema blocker this entry originally cited. `@mention` parsing/notification itself
  (scanning message content for `@handle` tokens and matching them) is still not built; that
  remains a distinct, not-yet-requested feature on top of the field that now exists.
- **Priority:** Low
- **Reason for deferral:** Implementing message-content `@mention` parsing is its own scoped feature,
  not a side effect of any task that's added `username` so far.
- **Planned milestone:** Not currently planned; the schema is ready whenever it's requested.

**DEBT-035 — Fellowship chat channel management has no frontend UI — CLOSED (2026-09-06, fully 2026-09-07)**
- **Description:** `chat.channel.manage` (create, rename, describe, archive, restore, optionally
  private) is fully built and tested on the backend — REST endpoints, permissions, audit logging —
  but no admin screen calls any of it. `#general` is created automatically for every Fellowship, so
  every Fellowship has a working chat from day one; creating a *second* channel currently requires
  a direct API call.
- **Status (2026-09-06):** Closed. `FellowshipDetailPage` (Admin) now has a "Chat" section reusing
  the existing `ChatWorkspace` component, and `ChannelSidebar` gained a "Create channel" action
  (visible only to a caller who actually holds `chat.channel.manage` for that Fellowship) calling
  the `useCreateChatChannel` mutation that already existed, fully wired, but unused. Rename/archive/
  restore still have no dedicated UI (no product ask for them yet) — only creation was in scope.
- **Status (2026-09-07):** Fully closed. `ChannelInfoPanel` gained an edit (rename/describe) action
  and an archive/restore action with a confirm dialog, both `chat.channel.manage`-only;
  `ChannelSidebar` gained a manager-only "Show archived channels" toggle. See
  `docs/adr/0014-fellowship-chat.md`'s 2026-09-07 addendum.
- **Priority:** N/A (closed)
- **Planned milestone:** N/A (closed).

**DEBT-036 — Practical task submission form has only `repositoryUrl`/`liveDemoUrl`, doesn't fit non-code deliverables**
- **Description:** `PracticalTaskSubmission` (and the student submission form built on top of it,
  `practical-task-portal-detail-page.tsx`) has exactly two fields: "GitHub repository URL" and
  "Live demo URL." That shape fits a coding project well but has nothing for a design deliverable
  (a Canva/Figma file, an exported image, a Google Drive folder). The Tech Impact Fellowship Cohort 1
  seed (`apps/api/prisma/seeds/tech-impact-cohort1.seed.ts`) added a Graphics Design track whose
  tasks are exactly this kind of deliverable; rather than changing the model, its task instructions
  explicitly direct students to paste a Canva/Figma/Drive share link into "Live demo URL" and leave
  "GitHub repository URL" blank. `submissionMetadata` (a `Json` column on the same model) exists but
  is dead — explicitly commented as superseded and never read by the UI — so it isn't a ready escape
  hatch either.
- **Priority:** Low
- **Reason for deferral:** A real fix (a generic "deliverable link" field, or file upload, or
  per-track submission field sets) is a product/schema decision on the submission model, not a
  mechanical change; out of scope for a data-and-content milestone that was explicitly told not to
  redesign existing architecture.
- **Planned milestone:** Whichever milestone next revisits the practical task submission UX, or adds
  a second non-code track that makes the workaround recur.

**DEBT-037 — Per-route rate limits are tracked per-IP, never per-authenticated-user**
- **Description:** `AppModule` registers global guards in the order `ThrottlerGuard` -> `JwtAuthGuard` ->
  `PermissionsGuard`. `ThrottlerGuard` runs first, so `request.user` (set by `JwtAuthGuard`) does not
  exist yet when the throttler's tracker function would need it — a per-route `getTracker` keyed on
  the authenticated user id is therefore not viable without reordering these guards. Every rate limit
  added in Milestone 8 (see the closed DEBT-003 above) is IP-based, same as the pre-existing global
  default: coarser than per-account for a shared-IP scenario (office/campus NAT, mobile carrier CGNAT),
  though still a real improvement over one flat 300/min rule, and login itself has an independent,
  identity-scoped defense already (`AuthService.registerFailedAttempt`'s account lockout).
- **Priority:** Low
- **Reason for deferral:** Reordering global guard execution changes *when* authentication happens
  relative to throttling for every route in the app, not just the newly-throttled ones — a
  significant-enough behavior change that Milestone 8's own instructions required stopping to ask
  before making it, and it wasn't clearly justified for this pass alone.
- **Planned milestone:** Whenever guard ordering is revisited for its own reasons, or if IP-based
  limiting proves insufficient in production traffic.

**DEBT-038 — WebSocket rate limiting is in-memory, per-instance, not shared across a horizontally-scaled API**
- **Description:** `ChatGateway`'s connection-flood (30/min/IP) and event-flood (60/10s/socket)
  counters (Milestone 8) are plain in-memory `Map`s, reset on a `setInterval`. In a single-instance
  deployment this is a complete guarantee; across multiple API instances behind a load balancer, each
  instance enforces its own window independently, so a client distributed across N instances could in
  principle achieve roughly N times the intended limit.
- **Priority:** Low
- **Reason for deferral:** This repository runs one API instance today; a shared, cross-instance limit
  would need Redis-backed counters (Redis is already used for this gateway's cross-instance *event
  fan-out*, per docs/adr/0014-fellowship-chat.md Decision 2, but never yet as a rate-limit store) —
  introducing that store is exactly the kind of infrastructure decision Milestone 8's own instructions
  said to leave for explicit approval rather than add speculatively.
- **Planned milestone:** Whenever horizontal WebSocket scaling is actually load-tested/deployed.

**DEBT-039 — `apps/api/Dockerfile` is written but not build-verified**
- **Description:** No production Dockerfile existed before Milestone 8. The multi-stage pnpm-workspace
  Dockerfile added this milestone follows standard, documented conventions (`pnpm deploy` to extract
  `@forge/api`'s production-only `node_modules`, a distinct minimal runtime stage, a non-root user) but
  could not be validated with a real `docker build` — Docker was not available in the environment this
  was authored in (confirmed: no `docker` executable on PATH, no Docker Desktop installed).
- **Priority:** Medium
- **Reason for deferral:** Requires an environment with Docker actually installed to build and smoke-
  test (start the container, hit `/api/v1/health` and `/api/v1/health/ready`, confirm `prisma migrate
  deploy` runs cleanly against a real database from inside the image) before it should be trusted for
  a real deploy.
- **Planned milestone:** Before this Dockerfile is used for any real deployment — build and smoke-test
  it first.

**DEBT-040 — One ~863 KB (235 KB gzipped) JS chunk in the production web build**
- **Description:** `pnpm build` reports `assets/index-B13aRAYH.js` at 862.65 kB (234.80 kB gzip),
  well past Vite's 500 kB chunk-size warning. The router's own code comment already documents that
  `/portal` (student) and `/mentor` routes are lazy-loaded (`lazyNamed`), but `/admin` is explicitly
  "eager and untouched" — almost certainly the source of this chunk, since it alone covers dozens of
  routes across organizations, academies, fellowships, cohorts, curriculum authoring, users, roles,
  and settings.
- **Priority:** Low
- **Reason for deferral:** Converting the entire admin route tree to lazy imports is a mechanical but
  broad change (dozens of route entries) with real regression risk if done hastily, and Milestone 8's
  own instructions were explicit: "do not prematurely optimize... only make measurable or clearly
  justified improvements" and "do not perform a major redesign." The size is now measured and
  documented rather than guessed at, which is what makes this a clearly scoped, low-risk follow-up
  rather than a redesign.
- **Planned milestone:** Whenever `/admin`'s initial load time is actually a measured problem, or as a
  bundled part of any future admin-portal work.

**DEBT-041 — `apps/web/public/fellowship/index.html` fails `pnpm format` (pre-existing, unrelated to Milestone 8)**
- **Description:** Discovered while running the required `pnpm format` gate for Milestone 8: this one
  static public-marketing HTML file has formatting drift from the repo's Prettier config. Not
  introduced by this milestone — reverted a fix here specifically to keep this milestone's diff scoped
  to production hardening rather than bundle an unrelated ~144-line whitespace-only diff.
- **Priority:** Low
- **Reason for deferral:** Purely cosmetic (Prettier formatting only, no behavior change); safe to fix
  in an unrelated, dedicated pass.
- **Planned milestone:** Any future touch to that file, or a dedicated formatting cleanup pass.

**DEBT-042 — No "resend invitation" action for a bounced approval/invite email**
- **Description:** `CohortApplicationsService.approve()` and `UsersService.invite()` both send an
  invitation email as a side effect, but if it fails to deliver (bounced address, provider rejection),
  there is no dedicated action to resend it — confirmed live during Milestone 9 launch testing (a
  deliberately-fake test address bounced; the approval itself still succeeded, but the resulting
  account had no way to receive a fresh invite email specifically).
- **Priority:** Low
- **Reason for deferral:** `POST /auth/forgot-password` already serves as a working recovery path once
  the email address is corrected (same underlying reset-token/email mechanism) — a dedicated resend
  action would be a convenience, not a capability gap, and building new functionality was out of scope
  for a launch-readiness milestone.
- **Planned milestone:** If bounced invitations recur often enough post-launch to be operationally
  annoying.

**DEBT-043 — Production launch candidate database still holds development/test fixtures**
- **Description:** The shared development database used throughout this project's milestones holds
  roughly 300 auto-generated integration-test accounts (`*@chat-access-test.local`, from repeatedly
  running `*.integration.spec.ts` against it rather than an isolated test database) and three
  documented, intentional development fixtures (`student@test.local`, `student@techimpact.test`,
  `mentor@test.local`) that still hold real enrollment/mentor-assignment slots in the actual Cohort 1 —
  full inventory in `docs/runbooks/database-operations.md`'s Production Data Safety section.
- **Priority:** Medium
- **Reason for deferral:** The recommended, documented resolution is launching on a genuinely fresh
  database (migrations + `identity.seed.ts` only) rather than cleaning this one — see
  `docs/PRODUCTION_LAUNCH_CHECKLIST.md`. If this exact database is instead promoted to production
  directly, this item becomes a hard launch blocker, not deferrable debt.
- **Planned milestone:** Resolved automatically if launch uses a fresh database; otherwise must be
  resolved before real applicants populate Cohort 1.
