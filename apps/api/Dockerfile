# Milestone 8 production hardening: no production Dockerfile existed before
# this — see docs/system-architecture.md §14 ("containerized Nest API and
# workers on a managed container platform"). Standard multi-stage pnpm
# monorepo build; does not select or assume any hosting/cloud provider.
#
# NOT validated with a real `docker build` in this environment (Docker was
# unavailable in the sandbox this was written in) — build and smoke-test it
# before relying on it for a real deploy. See docs/KNOWN_TECHNICAL_DEBT.md.
#
# Build from the repository root, not this directory, since it needs the
# workspace's lockfile/other packages:
#   docker build -f apps/api/Dockerfile -t forge-api .

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /repo

# --- deps: install with only the manifests + Prisma schema present, so this
# layer is cached across source-only changes. ---
FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/config/package.json packages/config/
COPY packages/api-contract/package.json packages/api-contract/
COPY packages/domain-contracts/package.json packages/domain-contracts/
COPY packages/ui/package.json packages/ui/
COPY apps/api/package.json apps/api/
COPY apps/api/prisma apps/api/prisma
RUN pnpm install --frozen-lockfile

# --- build: full source, compile, then extract @forge/api's own
# production-only node_modules via `pnpm deploy` (the pnpm-native way to
# turn one workspace project into a standalone, publishable directory —
# see https://pnpm.io/cli/deploy). ---
FROM deps AS build
COPY . .
RUN pnpm --filter @forge/api build
RUN pnpm --filter @forge/api deploy --prod --legacy /out/api

# --- runtime: nothing but the compiled output, production node_modules,
# and the Prisma schema/migrations a deploy step needs to run
# `prisma migrate deploy` against. No pnpm, no source, no devDependencies. ---
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S forge && adduser -S forge -G forge
COPY --from=build --chown=forge:forge /out/api/node_modules ./node_modules
COPY --from=build --chown=forge:forge /out/api/package.json ./package.json
COPY --from=build --chown=forge:forge /repo/apps/api/dist ./dist
COPY --from=build --chown=forge:forge /repo/apps/api/prisma ./prisma
USER forge
EXPOSE 3000
CMD ["node", "dist/main.js"]
