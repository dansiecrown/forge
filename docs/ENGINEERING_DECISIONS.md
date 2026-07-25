# Engineering Decisions

This document is Project Forge's permanent engineering constitution — the standing decisions every future milestone builds on. It does not duplicate implementation detail already recorded in `docs/adr/`; it states *what is decided and why*, and points to the ADR or spec that carries the deeper reasoning. Changing anything here is an architectural decision in its own right and needs a new dated entry (or a superseding ADR), never a silent edit.

Established: 2026-07-24, Architecture Lock milestone. Carries forward decisions already made in Milestones 1–2 and the two prior readiness/infrastructure checkpoints.

---

## Source of truth and process

- **Documentation is the source of truth.** `docs/` governs implementation, not the other way around. When implementation and documentation disagree, the conflict is reported and resolved explicitly — either the code is fixed to match the doc, or the doc is updated to match an implementation that has become the approved standard (as happened with plural table naming, 2026-07-24 — see `docs/database-design.md` and this file's Database section below). Docs are never silently left stale.
- **Milestone-first development.** Work proceeds in the approved sequence in `docs/development-roadmap.md`. A milestone's stated scope is a hard boundary — later-milestone functionality (Organizations, Academies, Fellowships, Cohorts, Courses, dashboards, etc.) is not started early, even opportunistically, even when it would be convenient.
- **Architecture before features.** When technical debt or architectural drift is found, it is evaluated and either fixed (if small and safe) or formally deferred with a reason and a planned milestone (`docs/KNOWN_TECHNICAL_DEBT.md`) — never silently carried forward unrecorded, and never fixed via a large speculative refactor bundled into unrelated work.
- **Security-first engineering.** Authentication, authorization, and tenant-scope correctness are treated as release blockers, not polish. A cross-tenant authorization gap (found and fixed 2026-07-23) is the standing example of the bar: any confirmed cross-tenant or privilege-escalation defect is fixed immediately, verified live against a real database, and documented — not merely noted for later.
- **No new technologies without explicit approval.** The approved stack (below) is closed by default. Adding a framework, database, queue, or major library requires an explicit decision and an ADR, not an incidental choice made while implementing something else.
- **AI-assisted development workflow.** Project Forge is built with an AI coding agent operating under `.claude/CLAUDE.md`'s repository instructions: doc-first (read `/docs` before implementing), scope-disciplined (implement only the requested milestone), and required to stop and report — not guess — when documentation conflicts with implementation or a requirement is ambiguous. Every milestone's changes are verified (lint/format/typecheck/test/build, and live database verification where behavior touches persistence or auth) before being reported complete.

## Platform and infrastructure

- **Docker is the development environment.** `docker-compose.dev.yml` provisions local-only PostgreSQL and Redis on a dedicated network with persistent volumes. It is developer tooling only — staging and production use managed services (`docs/system-architecture.md` §14), never this compose file.
- **PostgreSQL is the primary database**, managed, with UUID primary keys and all timestamps stored as `timestamptz` in UTC. It is the sole transactional source of truth (`docs/adr/` ADR-003 in `system-architecture.md` §16).
- **Redis is reserved for caching, queues, and future asynchronous processing** — provisioned in local dev infrastructure from 2026-07-23 onward, but deliberately not integrated into the application yet. It becomes load-bearing only when a module has a real asynchronous workload (notifications, background jobs); until then it stays present-but-unused rather than wired in speculatively.
- **Prisma is the ORM**, schema-first, with reviewed, checked-in migrations under `apps/api/prisma/migrations/`. Migrations are additive/expand-first by default; a destructive migration is never coupled to the same deploy as code that still depends on the old shape (`docs/system-architecture.md` §14).
- **Modular monolith architecture.** One deployable NestJS API with strict module boundaries (`docs/project-structure.md` §4, §6) — controllers thin, services own use cases, repositories are the only layer touching Prisma, and one module may only use another through its exported service interface, never its repositories or Prisma delegates directly. Service extraction happens only after a measured, real scaling or ownership need, never speculatively.
- **pnpm workspace monorepo.** `apps/*` for deployable applications, `packages/*` for reusable, dependency-light code, one lockfile, one root toolchain. Package manager and workspace layout are fixed; see `docs/project-structure.md` §1–3 for the resolved pnpm-vs-npm-workspaces discrepancy across earlier docs.
- **Shared packages strategy.** A new `packages/*` package is created only once it has a named owner, a stable public API, and at least two independent consumers — not preemptively. `@forge/ui`, `@forge/api-contract`, `@forge/config`, and `@forge/domain-contracts` are pre-scaffolded for their eventual, documented purpose (`docs/project-structure.md` §5); colocating code in `apps/web`/`apps/api` until a package earns its existence is correct, not technical debt.

## Database naming (superseded 2026-07-24)

- **Table names are plural, `snake_case`** (`users`, `roles`, `memberships`, `role_permissions`, …). This supersedes `docs/database-design.md`'s original "singular" rule, which the Identity & Access Control implementation never actually followed (including, inconsistently, in that same document's own FK-reference prose). Renaming 15 live, migrated tables for a cosmetic convention with no functional impact was rejected in favor of updating the documentation to match the standard the implementation had already established. See `docs/database-design.md` §1 and `docs/adr/0003-identity-and-access-control-foundation.md`'s 2026-07-24 addendum.
- **Identity is global; membership is per-organization.** A `User` is one platform-wide identity; a `Membership` is that identity's relationship to exactly one organization. A person can hold memberships in multiple organizations without their identity being duplicated. This was always the schema's design intent (`docs/database-design.md`) but was not correctly implemented in the invitation flow until 2026-07-24 — see ADR-0003's addendum of that date. Any future feature touching "does this person have access" must query membership, never assume a 1:1 user-to-organization relationship.

## Design system

- **Dark mode is the primary brand experience.** The application defaults to a near-black, high-contrast dark theme (`docs/adr/0004-premium-dark-design-system.md`).
- **Light mode is fully supported**, following the OS `prefers-color-scheme` setting — not a manual toggle (adding one is a UI feature decision for a future milestone, not assumed now).
- **Glassmorphism is used sparingly**, restricted by design-token convention (the `Card` component's opt-in `glass` prop) to a small, explicit set of floating/overlay surfaces (auth card, and — when built — modals, dropdowns, popovers, toasts). It is never the default for page backgrounds, generic content cards, tables, forms, or dashboards.
- **Primary actions are monochrome, not brand-colored.** Accent color (brand blue) is reserved for links, focus states, and semantic status (success/warning/danger) — not decorative use on primary CTAs (`docs/adr/0004-premium-dark-design-system.md` addendum, 2026-07-22).

## Multi-tenant foundation (2026-07-25, Milestone 3)

- **Roadmap sequencing was explicitly overridden for Milestone 3, with the conflict disclosed and a
  decision recorded before implementation — see `docs/adr/0005-multi-tenant-foundation.md`.**
  `docs/development-roadmap.md` splits Organizations/Academies (Phase 4) from Fellowships/Cohorts/
  Enrollment (Phase 6), gated on a transactional-outbox convention that was never built. The product
  owner chose to build all five entities together as briefed rather than defer to that sequencing.
  This is a one-time, disclosed exception — not a precedent that later milestones may skip ahead of
  the roadmap without the same disclosure-and-decision step.
- **Organization stays status-driven (no `deleted_at`); Academy/Fellowship/Cohort get real soft
  delete.** Matches `docs/database-design.md`'s original, differing lifecycle designs for these
  entities — see ADR-0005 Decision 2.
- **A platform Super Admin's own active-organization header must never cause a false "not found" on a
  different organization.** Found via a live browser walkthrough of the new admin UI (not just API
  testing), fixed in `OrganizationsService.get`, and covered by a regression test. This is the kind of
  cross-tenant-adjacent defect this document's security-first principle treats as a release blocker —
  see ADR-0005 Decision 9.
- **The domain-entity layer DEBT-005 named (`docs/KNOWN_TECHNICAL_DEBT.md`) is now established**, for
  the three new modules only (`organizations`'s Academy/Organization additions, `catalog`, `cohorts`).
  Existing identity/roles modules are unchanged.

## Amendment process

A new permanent decision is added here, dated, when a milestone establishes one. A decision is only ever *superseded* (with the change dated and the reason recorded, as in the Database Naming section above) — never silently deleted, so the history of why the constitution reads the way it does stays intact.
