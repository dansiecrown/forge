# ADR-0001: pnpm workspace monorepo, no task runner yet

**Status:** Accepted
**Date:** 2026-07-21
**Owner:** Lead Engineering

## Context

`docs/system-architecture.md` Section 5 originally specified npm workspaces. `docs/project-structure.md` Section 1 supersedes that in favor of pnpm, per the project brief's explicit requirement, and documents this as an open reconciliation item (`docs/project-structure.md` Section 10, item 1).

## Decision

Use a pnpm workspace monorepo (`pnpm-workspace.yaml` covering `apps/*` and `packages/*`), with `workspace:*` protocol references for internal packages. Do not adopt Turborepo or another task runner until measured CI/local build-caching needs justify it; root scripts orchestrate workspace scripts via `pnpm --recursive --if-present`.

## Alternatives considered

- **npm workspaces** — rejected; contradicts the project brief and `docs/project-structure.md`.
- **Yarn workspaces** — not evaluated; no requirement favors it over pnpm's stricter dependency isolation.
- **Turborepo from day one** — deferred; adds orchestration complexity not yet justified by build/CI duration.

## Consequences

- All contributors and CI must use pnpm 9.15.4 (pinned via `packageManager` in the root `package.json`); npm/yarn lockfiles must not be committed.
- Strict, non-hoisted dependency resolution means every workspace package must declare the dependencies it actually imports (no phantom dependencies via hoisting).
- Revisit if parallel build/caching needs across `apps/*` and `packages/*` grow large enough to justify Turborepo.
