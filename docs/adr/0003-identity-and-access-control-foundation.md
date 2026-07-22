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
