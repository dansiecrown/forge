# Project Forge

Project Forge is a multi-tenant fellowship management platform. This repository is a pnpm workspace containing the web application, API, and shared packages.

## Foundation commands

- `pnpm install` installs workspace dependencies.
- `pnpm dev:web` starts the Vite web app at `http://localhost:5173`.
- `pnpm dev:api` starts the NestJS API at `http://localhost:3000/api/v1/health`.
- `pnpm build`, `pnpm lint`, `pnpm format`, and `pnpm typecheck` run the foundation checks.
- `pnpm test` runs unit tests across the workspace.

Copy `.env.example` to `.env` at the repo root before starting the API — it needs a running PostgreSQL instance (`DATABASE_URL`) plus generated auth secrets (`JWT_ACCESS_SECRET`, `COOKIE_SECRET`, `MFA_ENCRYPTION_KEY`; see comments in `.env.example` for how to generate them). Copy `apps/web/.env.example` to `apps/web/.env` if the API isn't running on the default `http://localhost:3000/api/v1`.

## Local development infrastructure (Docker)

`docker-compose.dev.yml` runs local-only PostgreSQL and Redis containers on a dedicated `forge-dev` network with persistent named volumes. It is never used for staging/production, which use managed services (see `docs/system-architecture.md` §14).

- `pnpm docker:up` starts PostgreSQL (`localhost:5432`) and Redis (`localhost:6379`) in the background.
- `pnpm docker:logs` tails both services; `pnpm docker:down` stops them (data persists in the named volumes until you `docker volume rm`).
- The default `.env.example` credentials (`forge`/`forge`/`forge`) already match the compose Postgres service, so `DATABASE_URL` needs no edits for local use.
- Redis is provisioned for future milestones (queues/caching) only — `REDIS_URL` is documented in `.env.example` but the API does not read it yet; see `docs/adr/0003-identity-and-access-control-foundation.md`.

With Postgres running, apply the schema:

```sh
pnpm --filter @forge/api prisma:migrate:deploy   # applies apps/api/prisma/migrations/
pnpm --filter @forge/api prisma:generate         # regenerates the Prisma Client
pnpm --filter @forge/api prisma:seed             # loads permissions, system roles, and an optional bootstrap super-admin
```

## Identity & Access Control (Milestone 2)

- Run `pnpm --filter @forge/api prisma:seed` to load the permission catalogue, the five system roles, and (if `SEED_SUPER_ADMIN_EMAIL`/`SEED_SUPER_ADMIN_PASSWORD` are set) a bootstrap platform super-admin.
- Sign in at `/sign-in`; `/forgot-password` and `/reset-password` complete the password-recovery loop. User invitations (`POST /users/invitations`) reuse the reset-password flow to set an initial password — see the ADR for why.
