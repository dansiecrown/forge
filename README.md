# Project Forge

Project Forge is a multi-tenant fellowship management platform. This repository is a pnpm workspace containing the web application, API, and shared packages.

## Foundation commands

- `pnpm install` installs workspace dependencies.
- `pnpm dev:web` starts the Vite verification shell.
- `pnpm dev:api` starts the NestJS API at `http://localhost:3000/api/v1/health`.
- `pnpm build`, `pnpm lint`, `pnpm format`, and `pnpm typecheck` run the foundation checks.

Copy `.env.example` to `.env` before starting the API. The database URL is configured for Prisma; no application schema or business feature is implemented in this phase.
