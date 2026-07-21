# Project Forge — Project Structure Specification

**Status:** Proposed structure for approval; documentation only  
**Scope:** pnpm workspace monorepo for the approved modular-monolith architecture

## 1. Purpose and governing decisions

Project Forge is a multi-tenant fellowship-management platform. An organization is the tenant boundary; it can contain academies, fellowships/programmes, courses, cohorts, and their learning and operational records. The first tenant is Tech Impact Fellowship, but all code must preserve organization scope and support multiple organizations from the first release.

The repository is a **pnpm workspace monorepo** containing a React/Vite web application, a NestJS API and worker entry point, and deliberately small shared packages. It implements the approved modular monolith: module boundaries are strict inside `apps/api`, while deployment can independently scale the API and workers without making them separate domain services.

This document resolves the workspace-manager discrepancy in `system-architecture.md` (which says npm workspaces) in favour of the project brief's explicit **pnpm** requirement. The structure otherwise follows the approved architecture, API, database, and product specifications.

## 2. Monorepo strategy

- Use `pnpm-workspace.yaml` to include `apps/*` and `packages/*`. Use workspace protocol dependencies (`workspace:*`) for internal packages.
- Keep deployable applications in `apps/`; keep reusable, dependency-light code in `packages/`.
- The API owns Prisma schema, migrations, database access, and domain implementations. Database models never move into a shared package.
- The OpenAPI source and generated typed client live in `packages/api-contract`. The web application imports that package; it does not duplicate API DTOs.
- Start without a task-runner dependency. Introduce Turborepo only when measured CI/local build caching and task orchestration justify it.
- Root scripts orchestrate workspace scripts; each app/package owns its build, test, lint, and typecheck configuration.

## 3. Root directory structure

```text
forge/
├── apps/
│   ├── web/                         # React + Vite product application
│   └── api/                         # NestJS API and worker runtime
├── packages/
│   ├── api-contract/                # OpenAPI source/generated typed client
│   ├── config/                      # Shared tool configuration presets
│   ├── domain-contracts/            # Stable events and value contracts only
│   └── ui/                          # Shared shadcn-based design system
├── docs/
│   ├── adr/                         # Dated architecture-decision records
│   ├── runbooks/                    # Operational and incident runbooks
│   └── project-structure.md
├── infra/                           # IaC, deployment manifests, environment templates
├── scripts/                         # Safe local-development and CI orchestration
├── .github/
│   └── workflows/                   # CI/CD workflows and reusable actions
├── .env.example                     # Documented, non-secret environment variables
├── .gitignore
├── .npmrc                           # pnpm/node install policy
├── .prettierignore
├── .prettierrc.json
├── eslint.config.js                 # Root composition of shared lint rules
├── package.json                     # Workspace scripts and pinned package manager
├── pnpm-lock.yaml                   # Committed deterministic dependency lock
├── pnpm-workspace.yaml              # Workspace membership
├── tsconfig.json                    # Root project references/base compiler options
└── README.md                        # Setup, architecture entry points and commands
```

`docs/` is the architecture and product source of truth. `infra/` owns deployable infrastructure definitions and must not contain application business logic. Generated outputs such as `dist/`, coverage, Prisma generated client output (when not generated at install), reports, and local secrets are ignored unless a generated API contract artifact is intentionally versioned.

## 4. Applications

### `apps/web/` — React application

```text
apps/web/
├── public/                          # Static files served unchanged by Vite
├── src/
│   ├── api/                         # Transport setup and generated-client adapters
│   ├── app/                         # Router, application bootstrap and route registry
│   ├── assets/                      # App-owned static imports: fonts, illustrations, icons
│   ├── components/                  # Product-wide composed UI, not feature-specific UI
│   ├── constants/                   # Stable client constants and route/query-key helpers
│   ├── contexts/                    # Narrow React contexts (session, tenant, theme)
│   ├── features/                    # Domain-oriented vertical slices
│   ├── hooks/                       # Reusable React hooks independent of one feature
│   ├── layouts/                     # Application-shell and route layout components
│   ├── pages/                       # Route composition only; no domain logic
│   ├── providers/                   # Query, router, theme, auth and error-boundary providers
│   ├── services/                    # Browser-facing adapters: auth refresh, sockets, uploads
│   ├── styles/                      # Tailwind entrypoint, global CSS, token extensions
│   ├── types/                       # Web-only types; API models remain in api-contract
│   └── utils/                       # Small pure helpers with a clear cross-feature purpose
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

Folder responsibilities:

- `features/` is the default home for product work. Each feature owns its screens, feature components, query hooks, forms/schemas, local types, and route registration metadata. Initial feature names map to approved bounded contexts: `identity`, `organizations`, `catalog`, `cohorts`, `learning`, `community`, `operations`, `outcomes`, `payments`, and `platform`.
- `pages/` assembles a URL route from feature exports and layouts. It may perform route-level loading and code splitting, but must not become a second feature layer.
- `components/` holds reusable product compositions such as `data-table`, `empty-state`, `page-header`, and capability-aware action wrappers. Generic primitives belong in `@forge/ui`; feature-only components stay colocated.
- `layouts/` owns the authenticated shell, public shell, role navigation, and contextual panels. It has no data-access or authorization decisions.
- `providers/` wires global runtime providers once. `contexts/` defines their narrow values; avoid a catch-all global context.
- `api/` configures the auth-aware generated OpenAPI client, request IDs, tenant-context headers, and query-key factories. `services/` encapsulates browser integrations and side effects, including controlled token refresh, WebSocket lifecycle, direct-upload orchestration, and local draft persistence.
- `hooks/`, `utils/`, `constants/`, and `types/` may contain only clearly reusable client concerns. A feature-specific item remains in that feature.
- `styles/` contains global Tailwind layers and token application only. Components should use Tailwind and `@forge/ui`, not ad-hoc page CSS.
- `assets/` contains source-controlled, app-owned raster/static media imported by code. User uploads, certificates, and content assets belong in object storage and are represented by API `FileAsset` records, never committed here.

Feature shape:

```text
features/learning/
├── api/                             # Feature-level client functions using api-contract
├── components/                      # Learning-only presentational/composed UI
├── hooks/                           # Queries, mutations and feature orchestration
├── routes/                          # Lazy route components/route metadata
├── schemas/                         # React Hook Form/Zod UX schemas
├── types/                           # View-model and local state types
└── index.ts                         # Deliberate public feature exports
```

TanStack Query is the sole server-state cache. Query keys must include all authorization-relevant scope (`organizationId`, then academy/cohort/entity as applicable) to prevent cache bleed after context switching. React Hook Form and Zod improve client UX, but server DTO validation remains authoritative. Local stores are reserved for transient UI state, never copies of server resources.

### `apps/api/` — NestJS API and worker runtime

```text
apps/api/
├── prisma/
│   ├── schema.prisma                # Authoritative Prisma schema
│   ├── migrations/                  # Reviewed, ordered database migrations
│   └── seeds/                       # Controlled development/test seed inputs
├── src/
│   ├── config/                      # Typed, validated environment configuration
│   ├── database/                    # Prisma client, transactions, migrations support
│   ├── decorators/                  # Reusable Nest parameter/metadata decorators
│   ├── filters/                     # Exception-to-standard-error-envelope filters
│   ├── guards/                      # Identity, tenant scope, capability and policy guards
│   ├── interceptors/                # Request IDs, response mapping, logging/metrics hooks
│   ├── jobs/                        # Scheduled orchestration; delegates to modules/queues
│   ├── middlewares/                 # HTTP concerns such as correlation/context parsing
│   ├── modules/                     # Bounded-context implementations
│   ├── queues/                      # BullMQ registration, workers, retry/DLQ policy
│   ├── events/                      # Outbox infrastructure, event dispatch and handlers
│   ├── shared/                      # Cross-cutting server kernel, not domain ownership
│   ├── utils/                       # Small pure server utilities; no dumping ground
│   ├── app.module.ts                # HTTP application composition root
│   ├── main.ts                      # API bootstrap
│   └── worker.main.ts               # Worker-only bootstrap
├── test/
│   ├── contract/                    # OpenAPI/API contract tests
│   ├── e2e/                         # Cross-module and authorization journeys
│   └── support/                     # Factories, fixtures and isolated test infrastructure
├── nest-cli.json
├── tsconfig.json
└── package.json
```

Backend folder responsibilities:

- `modules/` owns all business capabilities and persistence boundaries. The initial modules are `identity`, `organizations`, `catalog`, `cohorts`, `learning`, `community`, `operations`, `outcomes`, `payments`, and `platform`. `catalog` owns fellowships, courses, curriculum modules, weeks, lessons, and resources; the naming honors the data model's distinction between a fellowship programme and a pedagogical course.
- Every module exposes a narrow public application interface. Its internal shape is `controllers/`, `services/` (application use cases), `repositories/`, `entities/` (domain models/policies, not ORM leakage), `dtos/`, and optional `events/`, `jobs/`, `queues/`, `mappers/`, and `policies/`. Tests live beside the unit they exercise where practical.
- `controllers/` are thin HTTP adapters: DTO binding, OpenAPI metadata, and delegation. `services/` coordinate a use case and transaction. `repositories/` are the only module layer that directly queries its Prisma-owned records and require a non-optional scope object for tenant records. `entities/` holds domain types, state machines, and policy rules; it must not import Nest HTTP classes.
- `dtos/` contains request/response transport schemas and validation decorators. API response contracts correspond to OpenAPI; database entities are never returned directly.
- `guards/` enforce authentication, active organization/academy scope, capabilities, and resource policies before protected use cases. `middlewares/`, `filters/`, and `interceptors/` centralize HTTP cross-cutting behavior and the documented error/request-ID envelope.
- `config/` validates environment variables at startup and exposes typed configuration. `database/` owns Prisma lifecycle, scoped transaction helpers, and database health—not domain repositories.
- `jobs/` defines schedules such as retention, release, and aggregate orchestration. `queues/` owns named BullMQ queues, processors, retry/backoff, concurrency, and DLQ/replay mechanics. `events/` persists and consumes transactional outbox events idempotently.
- `shared/` is limited to cross-cutting kernel concerns such as scope context, authorization abstractions, pagination, result/error primitives, observability, storage/integration interfaces, and testable provider ports. It cannot become a home for a module's domain logic. `utils/` contains dependency-light pure helpers only.

Example module boundary:

```text
modules/learning/
├── controllers/
├── dtos/
├── entities/
├── events/
├── repositories/
├── services/
├── policies/
└── learning.module.ts
```

## 5. Shared packages and reusable-code strategy

| Package | Owns | Must not own |
| --- | --- | --- |
| `@forge/ui` | shadcn-derived primitives, design tokens, accessible composition patterns, icons and UI tests | API calls, authentication, tenant state, feature/business rules |
| `@forge/api-contract` | OpenAPI document, generated TypeScript client/types, shared contract tooling | Nest runtime code, Prisma models, hand-maintained duplicate DTOs |
| `@forge/config` | ESLint, TypeScript, Prettier, Tailwind and test configuration presets | application runtime configuration/secrets |
| `@forge/domain-contracts` | versioned domain-event payloads and small value contracts shared across boundaries | entities, repositories, Prisma types, use cases, UI components |

Create a new shared package only when it has a named owner, a stable public API, and at least two independent consumers. Prefer an explicit module interface or colocated code before extracting. Do not create a generic `shared`, `common`, or `utils` workspace package.

Shared components follow the same rule: primitives and reusable accessible patterns live in `@forge/ui`; cross-feature product compositions live in `apps/web/src/components`; feature-specific components remain under their feature. UI packages never fetch data or infer permissions.

## 6. Dependency and import conventions

Dependency direction is intentionally one-way:

```text
apps/web ─┐
apps/api ─┼──> packages/*
          └──> external infrastructure through server-side ports/adapters
```

- Applications may depend on packages. Packages may not import applications. `@forge/ui` is independent of all product domains; `api-contract` is runtime-light and independent of both apps.
- A Nest module may use another module only through that module's exported application interface or versioned event contract. It must not import another module's repositories, Prisma delegates, or private entity files.
- Only `apps/api` accesses PostgreSQL, Prisma, queues, provider credentials, and server integration adapters. The web app reaches data only through `@forge/api-contract` via its transport adapter.
- Use `@forge/*` workspace aliases for packages and configured `@/` aliases only within an app. Use relative imports inside a feature/module for close neighbors; import another feature/module only through its public `index.ts` or exported module interface.
- Avoid barrel files that accidentally expose internals. Each package, feature, and backend module has an explicit public export surface.
- Type-only imports use `import type`. Do not use deep relative traversal across module boundaries or import from generated/private build paths.

## 7. Naming conventions

- Directories and non-component files: `kebab-case` (`tenant-scope.guard.ts`, `submission-review.service.ts`).
- React components and classes: `PascalCase` (`SubmissionReviewPanel.tsx`, `TenantScopeGuard`).
- React hooks: `use` prefix and camel case (`useSubmissionReview`).
- Nest roles: `<subject>.<layer>.ts` and `<Subject><Layer>` (`certificate-issue.service.ts`, `CertificateIssueService`). Standard suffixes are `.controller`, `.service`, `.repository`, `.dto`, `.guard`, `.filter`, `.interceptor`, `.decorator`, `.module`, `.spec`.
- Tests: colocated `*.spec.ts(x)` for unit/component tests; `apps/api/test/**/*.e2e-spec.ts` for end-to-end tests.
- Database names remain singular `snake_case`, UUID `id`, foreign key `<entity>_id`, in accordance with the database specification. Prisma mappings may translate TypeScript naming without changing database conventions.
- API/OpenAPI properties use the established JSON contract convention (camelCase); database naming does not leak into responses.

## 8. Configuration, assets, documentation and scripts

Configuration files are layered: root tool policies (`package.json`, pnpm workspace/lock, root TS/lint/format configuration); shared presets in `packages/config`; application-specific Vite/Nest/Tailwind configuration inside the relevant app; and `infra/` deployment configuration. `.env.example` documents required keys with safe placeholders. Environment files and all provider credentials are untracked; production secrets live in the managed secret store and configuration is validated at process startup.

`docs/adr/` contains one dated ADR per architecture change, as required by the system architecture. `docs/runbooks/` contains operational procedures such as queue replay, restore, incident handling, and retention execution. Keep generated OpenAPI documentation colocated with `packages/api-contract`, with a discoverable link from `docs/`.

`scripts/` contains reviewed, idempotent developer/CI tasks only: contract generation/verification, migration checks, seed/reset helpers for non-production, and repository validation. Scripts must not embed credentials, silently mutate production, or replace the owning application's business code.

Static branding, source illustrations, and public favicons use `apps/web/src/assets` or `apps/web/public` depending on whether Vite must process them. Runtime uploads, evidence, report exports, and certificates are object-storage assets managed by `FileAsset` metadata and signed URLs. Infrastructure assets and templates remain in `infra/`.

## 9. Scalability and governance recommendations

- Keep API and worker entry points separate from day one; deploy and scale them independently while keeping a single module codebase.
- Use the transactional outbox and idempotent queue processors for notifications, files, reports, certificates, integrations, and aggregates. Do not make external delivery part of the core transaction.
- Enforce organization scope in guards, service policy, and scope-required repositories. Tests must cover cross-tenant denial and scoped cache/query behavior.
- Version published curriculum, rubrics, certificate evidence, API contracts, event payloads, and configuration. Schema changes use expand → compatible deploy → backfill → switch → contract.
- Keep query and cache keys tenant/authorization-aware; use Redis as a cache/queue layer only and PostgreSQL as the transactional source of truth.
- Extract a service or new workspace only after a measured deployment, ownership, or scaling need. Until then, preserve modular-monolith boundaries and document structural exceptions with an ADR.

## 10. Document reconciliation notes

The source documents agree on the key design: modular monolith, shared-schema organization-scoped tenancy, PostgreSQL/Prisma, REST/OpenAPI, Redis/BullMQ, object storage, strict policy authorization, and domain-oriented frontend features.

The following differences are resolved or require continued care:

1. The system architecture says **npm workspaces**, while the task brief mandates **pnpm**. This specification adopts pnpm; the system-architecture wording should be amended in a future documentation-only reconciliation.
2. The early architecture-plan default allowed concurrent enrollments, but its later “Decisions resolved” section and the database/API specifications require one active progression at a time. The later resolved decision is authoritative.
3. Earlier summaries use `Programme`, while the database/API specifications distinguish a `Fellowship` programme from one or more `Course` units. The structure retains the `catalog` module and uses fellowship/course terminology internally to avoid flattening this model.
4. The architecture-plan repository sketch lists only `ui`, `api-contract`, and `config`; the approved system architecture adds `domain-contracts`. This specification includes all four, with strict limits on `domain-contracts`.

No application code, feature implementation, React pages, NestJS modules, or configuration migration is created by this phase.
