# Production Deployment Guide

## Current state: no hosting provider has been selected

`docs/system-architecture.md` §14 names a *recommended* topology (CDN-hosted static web, containerized
API on a managed container platform, managed PostgreSQL/Redis) but **no ADR has accepted a specific
vendor**. This guide documents infrastructure *requirements* so the system can be deployed to whichever
provider is chosen, without hardcoding provider-specific steps. Do not select a provider as part of
routine engineering work — that is a business/infrastructure decision requiring its own approval.

## What actually needs to run

Project Forge is two deployable things and no background workers or cron jobs (none exist in this
codebase today — the outbox/queue architecture some planning docs describe was never built; see
`docs/KNOWN_TECHNICAL_DEBT.md`):

1. **The API** (`apps/api`) — a stateless NestJS process serving REST + a WebSocket gateway (Socket.IO,
   namespace `/chat`) on one port. Horizontally scalable behind a load balancer as long as every
   instance shares the same PostgreSQL and Redis.
2. **The web app** (`apps/web`) — a static single-page app (`vite build` output, `apps/web/dist/`) plus
   one additional static asset tree, the public Tech Impact Fellowship landing page
   (`apps/web/public/fellowship/`), copied verbatim into `dist/fellowship/` by the same build. Both are
   served by any static host/CDN capable of SPA history-fallback routing (route everything that isn't a
   static file to `index.html`, **except** `/fellowship/*`, which must resolve to real files —
   `docs/adr/0011-public-fellowship-experience.md` Decision 2).

## Infrastructure requirements checklist

| Requirement | Detail |
| --- | --- |
| **Application hosting** | A process host/container platform capable of running the Node 22 API long-lived, with WebSocket support (see below) and a way to inject environment variables/secrets. `apps/api/Dockerfile` exists for a container-based host but is **not yet build-verified** (no Docker available in the environment it was written in) — build and smoke-test it first; see `docs/KNOWN_TECHNICAL_DEBT.md` DEBT-039. |
| **PostgreSQL** | Managed PostgreSQL 16+ (matching `docker-compose.dev.yml`'s image), with automated backups (see Database Operations Guide), connection pooling appropriate to expected concurrency, and network access restricted to the API's hosting environment. |
| **Redis** | Required only for Fellowship Chat's cross-instance WebSocket fan-out. A single-API-instance deployment can run without Redis (chat degrades to REST-only delivery with a logged warning); a multi-instance deployment needs it for real-time delivery to work across instances. Not a hard requirement for launch if starting with one API instance. |
| **Domain / DNS** | One domain (or subdomain) for the web app, one for the API if served separately (e.g. `app.techimpact.org` and `api.techimpact.org`), each pointed at the respective host. |
| **HTTPS/SSL** | Required in production — `WEB_ORIGIN` must be `https://`, and the refresh-token cookie's `Secure` flag is enforced whenever `NODE_ENV=production` (`apps/api/src/shared/http/refresh-cookie.ts`). Terminate TLS at the load balancer/CDN or the host itself; either is fine as long as the API sees requests as HTTPS-originated for cookie purposes (a reverse proxy setting `X-Forwarded-Proto` correctly, if TLS terminates upstream of the Node process). |
| **Environment variables** | See `docs/runbooks/environment-configuration.md` for the full, canonical list. |
| **Email provider** | SMTP credentials for a real provider — see the Email section below and `docs/runbooks/environment-configuration.md`. |
| **Database backups** | See `docs/runbooks/database-operations.md`. |
| **Storage** | None required at launch — no file-upload feature exists yet (`FileAsset`/object-storage is planned, not built; see `docs/KNOWN_TECHNICAL_DEBT.md`). Nothing to provision. |
| **Logging** | The API logs to stdout/stderr via Nest's built-in `Logger` (structured-ish, with per-request IDs from `RequestIdMiddleware`). Point your host's log aggregation at stdout/stderr — no separate logging agent/config is built into the app. |
| **Monitoring** | No external monitoring/APM integration exists in the codebase. At minimum, monitor `GET /health` (liveness) and `GET /health/ready` (readiness) — see below. |
| **Health checks** | `GET /api/v1/health` (liveness — always OK if the process is up) and `GET /api/v1/health/ready` (readiness — pings PostgreSQL, `503` if unreachable). Configure your host/orchestrator to use liveness for restart decisions and readiness for traffic-routing decisions — never the same check for both (a real DB outage would otherwise cause a restart storm of otherwise-healthy instances). |
| **WebSocket support** | The hosting platform/load balancer must support persistent WebSocket connections (Socket.IO) on the API's port/path (`/chat`), including sticky sessions **if** running multiple API instances without a WebSocket-aware load balancer (Redis fan-out handles cross-instance message delivery, but a client's own socket connection must stay routed to one instance for its lifetime). |
| **Cron / background processes** | None exist. Nothing to schedule. |

## Deploy

```sh
# 1. Install dependencies (deterministic, from the committed lockfile)
pnpm install --frozen-lockfile

# 2. Apply database migrations — safe to run repeatedly, only applies pending ones
pnpm --filter @forge/api exec prisma migrate deploy

# 3. Build both apps
pnpm build

# 4. Seed permissions/roles (and, only on true first deploy with
#    SEED_SUPER_ADMIN_EMAIL/PASSWORD set, the bootstrap Super Admin) — safe to
#    re-run, upserts rather than duplicates
pnpm --filter @forge/api prisma:seed

# 5. Start the API (from apps/api/dist after `pnpm build`, or via the Dockerfile)
node apps/api/dist/main.js

# 6. Serve apps/web/dist/ as static files behind your CDN/static host
```

Do this in a fresh, deploy-only environment context — never against a shared development database. The
migration step (2) must run **before** the new API code starts serving traffic if the migration is not
backward-compatible with the previous code version; follow the expand → deploy → backfill → contract
pattern from `docs/system-architecture.md` §14 for any schema change that isn't purely additive.

## Verify

After deploying, confirm in order:

1. `curl https://<api-domain>/api/v1/health` → `{"data":{"status":"ok", ...}}`.
2. `curl https://<api-domain>/api/v1/health/ready` → same, `200` (confirms the database connection).
3. Load the web app in a browser; confirm sign-in works for a known account.
4. Load the public Tech Impact Fellowship landing page (`/fellowship/index.html`); confirm the cohort
   catalog loads (`GET /public/fellowships` returns data) and the application form submits successfully.
5. Confirm a WebSocket connects (open the browser dev tools Network tab on a chat-enabled page; a
   `socket.io` connection should upgrade successfully).
6. Check application logs for unexpected errors during startup and the first few real requests.

## Roll back

There is no automated rollback pipeline (see the CI/CD section below) — rollback is a deliberate,
human-triggered action:

1. Redeploy the previous known-good application version (previous container image / previous build
   artifact) to the hosting platform.
2. **Do not roll back a migration automatically.** If the failed deploy included a schema migration,
   assess whether the previous application version is still compatible with the *new* schema (expand
   migrations should be) before deciding whether a down-migration is actually needed. Prisma does not
   auto-generate down-migrations; a schema rollback requires a new, forward migration that reverses the
   change, reviewed like any other migration — never hand-edit an already-applied migration file (see
   `docs/runbooks/database-operations.md`).
   15 migrations exist in this schema so far, all additive/non-destructive; if a future migration IS
   destructive, that is exactly the case the expand/contract pattern exists to avoid needing a true
   rollback for.
3. Re-run the Verify steps above against the rolled-back deployment.
4. Record the incident per `docs/runbooks/incident-recovery.md`.

## CI/CD

`.github/workflows/ci.yml` runs on every pull request and push to `main`: install → lint → format →
typecheck → `prisma validate` → `prisma migrate deploy` (against a fresh CI-only Postgres service
container) → test (with real Postgres + Redis service containers) → build → an informational dependency
audit. **No step is configured to continue on failure** except the final audit step (deliberately
informational — see `docs/ENGINEERING_DECISIONS.md`'s Milestone 8 entry for why) — a failing lint,
typecheck, test, or build genuinely fails the CI run; nothing silently skips a failing test.

There is no automated deployment pipeline — CI validates the code; an actual deploy to any real
environment is a separate, deliberate, human-triggered action (running the Deploy steps above), per
Milestone 9's explicit instruction that production deployment stay a controlled action, not an
automatic consequence of merging code.
