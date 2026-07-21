# ADR-0002: Separate environments, no infrastructure vendor lock-in yet

**Status:** Accepted
**Date:** 2026-07-21
**Owner:** Lead Engineering

## Context

`docs/system-architecture.md` Section 14 requires separate development, staging, and production environments with distinct accounts, databases, caches, buckets, secrets, and callback/webhook endpoints, with configuration validated at process startup and secrets never committed to source control. `docs/development-roadmap.md` Section 2 lists the production cloud, managed PostgreSQL/Redis/object-storage, email, and observability vendors as an open decision to be resolved as a Phase 1 architecture/infrastructure decision.

## Decision

Establish the environment-separation baseline now, without selecting a specific cloud vendor:

- Environment-specific configuration only, validated at startup (`apps/api/src/app.module.ts` uses `ConfigModule` with a Joi validation schema).
- `.env.example` documents required non-secret keys; `.env` files are git-ignored; no production secret is ever committed.
- `infra/` is reserved for infrastructure-as-code once a vendor is selected; it must not contain application business logic.

## Alternatives considered

- **Choosing a vendor now** — rejected; the roadmap explicitly defers this decision and choosing prematurely risks contradicting a future infrastructure ADR.

## Consequences

- No deployment pipeline exists yet beyond local development; CI in `.github/workflows/ci.yml` runs install/lint/typecheck/build only.
- A follow-up ADR is required before any production deployment, naming the selected cloud, database, cache, storage, and observability vendors.
