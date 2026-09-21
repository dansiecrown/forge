# Environment Configuration Guide

Canonical reference for every environment variable Project Forge reads. `.env.example` (repo root)
carries the same list with placeholders — this document explains what each one is *for* and what
changes between development, test, and production. See also README's "Production hardening
(Milestone 8)" section for the short version.

## How configuration is loaded and validated

`apps/api/src/config/env.validation.ts` (a Joi schema) validates every variable at process startup —
a missing required variable or a value that fails validation (wrong shape, too short, or literally
equal to the `.env.example` placeholder) **fails the boot immediately** with a clear error, rather
than starting in a broken or insecure state. Optional variables (SMTP, `API_PORT`) have safe defaults
and never block startup.

`apps/api/prisma/seeds/identity.seed.ts` and `tech-impact-cohort1.seed.ts` read a few additional
`SEED_*` variables directly (not through the Joi schema, since they're one-off scripts, not the
running API) — documented in their own section below.

## Variables

| Variable | Required | Dev default | Production requirement |
| --- | --- | --- | --- |
| `NODE_ENV` | No (defaults `development`) | `development` | Set to `production`. Governs the refresh-cookie `Secure` flag and triggers boot-time warnings for missing SMTP / a non-HTTPS `WEB_ORIGIN`. |
| `DATABASE_URL` | Yes | local Postgres | The **production** database's connection string. Never the same database as development/staging — see `docs/system-architecture.md` §14 ("Production data never enters lower environments"). |
| `API_PORT` | No (default `3000`) | `3000` | Whatever port your process manager/reverse proxy expects. |
| `WEB_ORIGIN` | Yes | `http://localhost:5173` | The real `https://` origin the web app is served from. Used for CORS (the *only* origin the API will answer preflight/credentialed requests from) and for the WebSocket gateway's own CORS check (`ChatGateway`, which reads it directly from `process.env`, not `AppConfigService` — see that file's own comment on why). A non-HTTPS value in production logs a boot warning but does not block startup. |
| `REDIS_URL` | No (default `redis://localhost:6379`) | local Redis | Real production Redis instance. Used only for Fellowship Chat's cross-instance WebSocket event fan-out (`docs/adr/0014-fellowship-chat.md` Decision 2) — the API degrades gracefully (chat's REST read/write keeps working, only live delivery is affected) if Redis is unreachable, and it is deliberately **not** part of `GET /health/ready`. |
| `JWT_ACCESS_SECRET` | Yes, ≥32 chars | placeholder (rejected) | Generate a real random secret (`openssl rand -base64 32` or equivalent). The literal `.env.example` placeholder is rejected at boot in every environment, not only production. |
| `JWT_ACCESS_TTL_SECONDS` | No (default `900`) | 15 min | Leave as-is unless a specific session-length decision changes it. |
| `JWT_REFRESH_TTL_SECONDS` | No (default `2592000`) | 30 days | Leave as-is unless a specific decision changes it. |
| `ARGON2_MEMORY_COST` / `ARGON2_TIME_COST` / `ARGON2_PARALLELISM` | No | `19456` / `2` / `1` | These are already calibrated production-safe defaults (OWASP-recommended range for Argon2id). Do not lower them for "performance" — that directly weakens password-hash resistance to offline cracking. |
| `MFA_ENCRYPTION_KEY` | Yes, exactly 64 hex chars | placeholder (rejected — fails the hex check on its own) | Generate with `openssl rand -hex 32`. Encrypts TOTP secrets at rest; losing/rotating this key invalidates every enrolled user's MFA factor (they would need to re-enroll). |
| `PASSWORD_RESET_TOKEN_TTL_MINUTES` | No (default `60`) | 60 | Leave as-is unless policy requires change. |
| `EMAIL_VERIFICATION_TOKEN_TTL_HOURS` | No (default `48`) | 48 | Leave as-is unless policy requires change. |
| `COOKIE_SECRET` | Yes, ≥32 chars | placeholder (rejected) | Signs the refresh-token cookie. Generate a real random secret, distinct from `JWT_ACCESS_SECRET`. |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASSWORD` / `SMTP_FROM` | No — all optional | unset (console-log stub) | **Must be set for production.** Leaving `SMTP_HOST` unset means password reset, email verification, and invitation emails are only logged to the console, never delivered — `main.ts` logs an explicit warning at boot if `NODE_ENV=production` with no SMTP configured. See the Email section of the Incident/Recovery guide for what happens when a configured SMTP relay itself fails or rejects a message. |
| `SEED_SUPER_ADMIN_EMAIL` / `SEED_SUPER_ADMIN_PASSWORD` | No (seed-script only) | example values | Read only by `prisma/seeds/identity.seed.ts` at seed time, not by the running API. See "First Super Admin" below — **never** commit real values, and rotate/change the password immediately after first login. |
| `SEED_ORGANIZATION_NAME` / `SEED_ORGANIZATION_SLUG` | No (seed-script only) | `Tech Impact Fellowship` / `tech-impact-fellowship` | The organization `identity.seed.ts` creates (or finds) if none exists yet. |

## Development vs. test vs. production

- **Development**: `.env` at the repo root, `docker-compose.dev.yml` for local Postgres/Redis
  (`pnpm docker:up`). SMTP is typically left unset (console-log stub) unless actually testing email
  delivery. `NODE_ENV` defaults to `development` (unset is fine).
- **Test** (CI): `.github/workflows/ci.yml` sets every required variable as job-level `env:` —
  CI-only throwaway values, a real Postgres/Redis service container per run, never a shared/persistent
  database. See `docs/runbooks/release-checklist.md`.
- **Production**: every value above marked "production requirement" must be a freshly generated,
  real, non-shared secret; `DATABASE_URL`/`REDIS_URL` must point at the production database/cache,
  never a development or staging instance; SMTP must be configured with a real, delivering provider;
  `WEB_ORIGIN` must be the real `https://` production web origin.

## The one static-asset exception: the public landing page

`apps/web/public/fellowship/script.js` is a plain static asset (not part of the Vite-built React app)
and receives **no environment variable injection** — see `docs/adr/0011-public-fellowship-experience.md`
Decision 5. It hardcodes `http://localhost:3000/api/v1` as a fallback, with a `window.FELLOWSHIP_API_BASE_URL`
global as the override point. **If the production API is served from a different origin than the web
app**, this must be set — either by editing that one line before deploying the static asset, or by
injecting `<script>window.FELLOWSHIP_API_BASE_URL = "https://api.yourdomain.com/api/v1";</script>`
before `script.js` loads. This is disclosed, pre-existing, deliberate scope from ADR-0011 — not new
in this milestone.

## First Super Admin

There is no hardcoded administrator account anywhere in the codebase. The **only** way a Super Admin
is created is:

1. Set `SEED_SUPER_ADMIN_EMAIL` and `SEED_SUPER_ADMIN_PASSWORD` in the production environment's real
   (never committed) `.env` — a strong, freshly generated password, not example text.
2. Run `pnpm --filter @forge/api prisma:seed` (`identity.seed.ts`) once against the production
   database. It loads the permission catalogue and system roles unconditionally, and additionally
   creates a Super Admin account **only if** both `SEED_SUPER_ADMIN_EMAIL`/`SEED_SUPER_ADMIN_PASSWORD`
   are present — omit them and this step just loads permissions/roles with no admin created.
3. Log in as that account, then immediately change its password from Settings and enable MFA (MFA is
   not yet enforced automatically at first admin sign-in — see `docs/KNOWN_TECHNICAL_DEBT.md` DEBT-004 —
   so this is a manual step, not optional).
4. Remove or rotate `SEED_SUPER_ADMIN_PASSWORD` from the production environment configuration after
   first login — it has no further purpose once the account exists (re-running the seed with the same
   variables is a safe no-op against an existing account, but there is no reason to keep the plaintext
   password sitting in environment configuration indefinitely).

This process is environment-driven and idempotent by design — it never hardcodes a credential in
source, and re-running it is always safe.
