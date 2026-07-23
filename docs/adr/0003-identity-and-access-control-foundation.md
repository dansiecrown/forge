# ADR-0003: Identity & Access Control foundation — scope and kernel decisions

**Status:** Accepted
**Date:** 2026-07-22
**Owner:** Lead Engineering

## Context

Milestone 2 asked for a complete authentication and RBAC foundation. Four points needed resolving before implementation, each confirmed with the product owner:

1. Roadmap Phase 2 (data platform: audit log, tenant-scope kernel, standard error envelope, outbox/BullMQ, observability) had not been built, but auth/RBAC (roadmap Phase 3) depends on those conventions per the roadmap's own critical-path rule.
2. `Membership` — the core RBAC join table — requires a mandatory `organization_id` per `docs/database-design.md`, but Organizations are explicitly out of scope for this milestone.
3. MFA is architecturally mandatory per `docs/architecture-plan.md` / `docs/system-architecture.md` but was absent from this milestone's written scope.
4. Google/Microsoft/OIDC login is modeled in the DB spec and listed under roadmap Phase 3, but also absent from this milestone's written scope.

## Decisions

1. **Right-sized kernel, not full Phase 2.** Built only what Milestone 2's own modules need: a standard error envelope (`code`, `message`, `details`, `requestId`) via a global exception filter, a request-ID middleware + response-wrapping interceptor, and a synchronous `AuditLog` table written in-transaction. No outbox table, no BullMQ/Redis, no observability dashboards — Milestone 2 has no async side effects to dispatch (email is a logging stub). Full Phase 2 remains necessary before any module with real async side effects (notifications, file processing) ships.
2. **Minimal `Organization` stub** (`id`, `name`, `slug`, `status` only, no endpoints, no admin UI) exists purely as the FK anchor `Membership` requires. Real Organization administration (provisioning, settings, academies) is future work.
3. **MFA built now**, matching the architecture docs: `mfa_factors`, `recovery_codes` tables, TOTP enrollment/verification, and a distinct short-lived "MFA challenge" JWT (separate `type` claim from full access tokens, so a challenge token can never be replayed as a general-purpose access token) issued by `POST /auth/login` when MFA is enabled and consumed by `POST /auth/mfa/verify`.
4. **OIDC/social login deferred.** `external_identities` models the `password | google | microsoft | oidc` provider shape now (so no schema change is needed later), but only the `password` provider is wired up. No Google/Microsoft/OIDC endpoints exist in this milestone.

## Other implementation notes worth recording

- **User invitation reuses the password-reset token flow.** No `/auth/register` or accept-invitation endpoint exists in the API spec's documented auth section, and none was in this milestone's frontend scope. `POST /users/invitations` creates the user and emails a set-password link through the same `password_reset_tokens` table and `/reset-password` page. A dedicated invitation-acceptance flow (with its own onboarding step) is likely needed once `/invite/:token` and `/onboarding` (named in `docs/product-design-specification.md`'s sitemap) are built.
- **`Membership.academy_id` is omitted**, not just nullable — there is no `Academy` table yet, so a dangling FK-shaped column would be unused. It will be added as a real, populated column when Academies are built.
- **CSRF mitigation is `SameSite=Lax` cookies only** for this milestone; no dedicated CSRF token. Revisit before the refresh-cookie flow carries higher-value actions.
- **The Prisma migration was generated offline** (`prisma migrate diff`, no shadow database) because no PostgreSQL instance was reachable in the build environment. It has not been applied or validated against a real database. Run `prisma migrate dev` (or `prisma migrate deploy` in CI) against a real database before trusting it in any environment.

## Consequences

- Identity/RBAC ships without the full async/observability kernel; any future module that needs outbox delivery must build that Phase 2 kernel first, per the roadmap's existing critical-path rule.
- The `Organization` stub's shape may need columns added (never removed) when real Organization administration is built — expand-only, matching `docs/system-architecture.md`'s migration discipline.
- MFA and password auth are both live; OIDC adapters can be added later by implementing the `IdentityProvider` abstraction and adding rows to `external_identities` without a schema change.

## Addendum — 2026-07-22: compliance-audit fixes

A documentation-compliance audit of Milestones 1–2 found several implementation bugs against the approved specs (not new scope decisions). All were fixed in the same, still-unapplied migration rather than layered as a second migration, since nothing had consumed the first one yet:

- **Timestamps now use `TIMESTAMPTZ(3)`**, not plain `TIMESTAMP(3)`, on every `DateTime` column, per `docs/database-design.md`'s explicit "all timestamps stored as `timestamptz` in UTC."
- **`Role.organizationId` now uses `onDelete: Restrict`** instead of Prisma's implicit `SetNull` default for optional relations, matching the documented "RESTRICT by default for parent records" policy.
- **Two hand-written partial unique indexes were added** (Prisma's schema DSL cannot express a `WHERE` clause on `@@unique`): `roles` enforces "unique system key globally" and "unique custom key per organization" as *two* separate partial indexes rather than one composite index, because a single `(organization_id, key)` index would not stop two system roles — both with `organization_id IS NULL` — from sharing a key (standard btree unique indexes treat every `NULL` as distinct). `membership_roles` gets a partial unique index preventing the same role from being actively granted twice to one membership.
- **`AuditLog` gained `sourceIpHash`**, a required field per `docs/database-design.md` §7 that was missing. It's populated on login audit events (which already carry a hashed IP via `DeviceContext`); other audit call sites don't currently have an IP in scope to pass and were left `null` — a narrower gap than before, not a new one.
- **`POST /auth/login`, `POST /auth/refresh`, and `POST /auth/mfa/verify` now return `200`**, not NestJS's default `201` for POST handlers, matching the documented success codes.
- **`422 WEAK_PASSWORD` is now real**, via a minimal length-independent strength check (letters + digits required, rejects single-repeated-character and a small common-password denylist) on `reset-password` and `change-password`. Full breach-corpus screening remains an explicit future decision, unchanged from the original ADR.
- **`GET /verify-email` now returns `410 GONE`** for an expired-but-otherwise-valid token, distinct from `400 INVALID_TOKEN` for a not-found/already-used one, matching the endpoint's documented error pair.
- **`GET /auth/sessions` is now cursor-paginated**, matching the `CollectionResult` shape already used by `GET /users`, instead of returning a bare array.
- **`PATCH /roles/:roleId` now takes its expected `version` from the `If-Match` header**, not the request body, matching the documented concurrency-control header. Missing/non-numeric `If-Match` is a `400 INVALID_REQUEST`.
- **`POST /users/invitations` now honors `Idempotency-Key`.** A new `idempotency_keys` table (key, route, request hash, stored response, expiry) backs a small `IdempotencyService` invoked directly from `UsersController` — scoped to this one endpoint, not a generic interceptor applied everywhere, consistent with this ADR's "right-sized kernel" principle. No cleanup job removes expired rows yet; add one if/when a real scheduler exists (see the deferred outbox/BullMQ decision above).

Not fixed, and still open (tracked here rather than silently dropped):

- No `created_by`/`updated_by` columns exist on any model, though `docs/database-design.md` §1 lists them as standard on every mutable tenant record. Deferred: attribution would need to be threaded through every write path, which is a larger change than a targeted bug fix.
- Rate limiting remains one flat global rule (300 req/min/IP) rather than the documented per-endpoint tiers (sign-in/reset 5/15 min, refresh 30/min, etc.).
- MFA still isn't *enforced* as mandatory for admins/mentors at first sign-in — the mechanism exists and works, but nothing yet triggers required enrollment.
- No breach-password screening (already noted as conditional/deferred in the original ADR).

## Addendum — 2026-07-23: first real-database validation, and bugs it found

The migration had never been applied to a live PostgreSQL instance until this checkpoint (local Docker Postgres/Redis via the new root `docker-compose.dev.yml`). Doing so surfaced defects no amount of offline schema review could have caught:

- **The migration SQL file carried a UTF-8 byte-order mark**, generated by an earlier `prisma migrate diff --script` run whose output was redirected through Windows PowerShell (which defaults to BOM-prefixed UTF-8). PostgreSQL's parser rejects a BOM as a syntax error at the very first character, so `prisma migrate deploy` failed immediately — a 100% reproducible failure that a schema-only review missed entirely. Fixed by rewriting the file without a BOM; no SQL content changed.
- **The Prisma CLI (`generate`/`validate`/`migrate deploy`) never loaded `DATABASE_URL`.** It only auto-loads `.env` from its own package directory or next to `schema.prisma`; this repo's `.env` is deliberately root-level (one file for the whole monorepo, per `docs/project-structure.md` §8), which only the NestJS runtime's explicit `envFilePath` knew how to find. Fixed by adding `dotenv-cli` as a dev dependency and wrapping the three `prisma:*` scripts in `apps/api/package.json` (`dotenv -e ../../.env -- prisma …`) — infrastructure correctness, not a schema or application change.
- **The documented invitation flow — "`POST /users/invitations` creates the user and emails a set-password link through the same `password_reset_tokens` table and `/reset-password` page" (see this ADR's original decisions) — was broken end-to-end**, confirmed only by actually inviting a user and completing the flow against a real database:
  1. `PasswordCredentialsRepository.updateHash` used a plain Prisma `update`, which requires an existing row. An invited user has no `password_credentials` row yet (only `UsersService.invite` runs, which never creates one), so completing `POST /auth/reset-password` for a fresh invite threw an unhandled `PrismaClientKnownRequestError` (500). Fixed by changing it to an `upsert`; `changePassword`'s call site is unaffected since that path always has an existing credential (it re-verifies the current password first).
  2. Even with a credential set, the user's `status` never left `invited`, and `login()` unconditionally rejects any non-`active` status — so the account could still never sign in. Fixed by having `resetPassword` transition `status → active` (and stamp `emailVerifiedAt` if unset) specifically when the target user's current status is `invited`; every other status (`active`, `suspended`, `deactivated`) is left untouched so a routine forgotten-password reset can never silently reinstate a suspended account.
- **Auth-page cards were inconsistently glass.** A `replace_all` edit in the prior design-system pass matched cards by exact leading whitespace and missed the success/error-state `<Card>` instances on `/forgot-password` and `/reset-password` (different indentation level than the main-form `<Card>`), leaving those states rendering as solid cards while the same page's form state rendered as glass. Fixed by adding `glass` to the remaining three instances — a consistency fix, not a design change; still no glass outside the auth card per the design system's documented boundary.

All four were verified fixed against the live database/API, not just by re-reading code: applied migration cleanly, confirmed `TIMESTAMPTZ`/unique-index/`RESTRICT` behavior with direct SQL queries, and ran the full login, refresh, session-listing, RBAC (positive/negative/tenant-scope), MFA enroll+verify+challenge, password-reset, and email-verification flows end-to-end with real HTTP requests.
