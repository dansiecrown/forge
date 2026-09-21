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
- Sign in at `/sign-in`; `/forgot-password` and `/reset-password` complete the password-recovery loop. User invitations (`POST /users/invitations`) reuse the reset-password flow to set an initial password for a brand-new identity — see the ADR for why. Inviting an email that already has an account elsewhere on the platform reuses that identity and just adds a membership in the target organization, since identity is global and membership is per-organization (see the ADR's 2026-07-24 addendum).

## Tech Impact Fellowship — Cohort 1 seed data (DEVELOPMENT ONLY)

A realistic, ready-to-use "Cohort 1" of the Tech Impact Fellowship — 3 learning tracks (Web Development, WordPress Website Design, Graphics Design), 3 weeks each, with real lessons, resources, and practical tasks/assignments — plus a test student account already enrolled, so the learning experience can be exercised end-to-end without hand-building data.

```sh
pnpm --filter @forge/api seed:cohort1   # ts-node --transpile-only prisma/seeds/tech-impact-cohort1.seed.ts
```

- Safe to re-run any time — every write is an idempotent upsert/lookup, so re-running never creates duplicate organizations, tracks, weeks, lessons, resources, tasks, or users. Re-running is also how you "reset" the environment after manually editing seeded rows: it restores them to the seed's definitions and rebuilds `Cohort.curriculumSnapshot` (the frozen read-model students actually load from) from the live catalog.
- Requires the same `.env` / running Postgres as any other API command; run `prisma:migrate:deploy` and `prisma:generate` first if this is a fresh database, and `prisma:seed` at least once (for permissions/roles) before this script.
- **Test student login — development only, never set these as real credentials in any deployed environment:**
  - Email: `student@techimpact.test`
  - Password: `TestPass123!` (the same convention `dev-test-users.seed.ts` already uses)
  - The student is enrolled in Cohort 1 with no track pre-selected — pick one from `/dashboard` to start, the same first step a real student takes.
- See `docs/ENGINEERING_DECISIONS.md`'s "Tech Impact Fellowship — Cohort 1 realistic learning data" entry for the assumptions this seed makes, and `docs/KNOWN_TECHNICAL_DEBT.md`'s DEBT-036 for a submission-form limitation it works around rather than fixes.
