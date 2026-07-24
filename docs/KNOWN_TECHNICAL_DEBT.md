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
