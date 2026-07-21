# Project Forge — System Architecture Specification

**Status:** Approved-design implementation blueprint (no implementation)  
**Scope:** Production-ready, multi-tenant SaaS for fellowship delivery  
**Primary deployment region/timezone:** Nigeria / Africa-Lagos display timezone; all persisted timestamps UTC

## 1. Architecture goals and principles

Project Forge is a fellowship-first LMS and operations platform: learning delivery, mentor accountability, assessments, cohort operations, employability outcomes, and governed administration. It must support Tech Impact Fellowship first and grow to multiple organizations, academies, programmes, and cohorts without tenant data leakage.

Architecture principles:

- Begin as a modular monolith: simple to ship and operate, with strict bounded contexts that may be extracted later.
- Treat organization scope and policy authorization as server-enforced invariants, never as UI filtering.
- Prefer managed, replaceable infrastructure behind adapters; avoid premature distributed systems.
- Make sensitive operations auditable, secure by default, observable, accessible, and failure-tolerant.
- Use asynchronous delivery for non-critical side effects; preserve the core transaction before sending notifications or generating artifacts.
- Keep a versioned API contract and a coherent shared UI/design system.

## 2. High-level architecture

```text
                       ┌────────────────────────────────────┐
                       │ Browser / PWA-capable web client    │
                       │ Vite React SPA                      │
                       └───────────────┬────────────────────┘
                                       HTTPS / WSS
                       ┌───────────────▼────────────────────┐
                       │ Edge / CDN / WAF                    │
                       │ static assets, TLS, rate controls   │
                       └───────────────┬────────────────────┘
                                       HTTPS
                       ┌───────────────▼────────────────────┐
                       │ NestJS API — modular monolith       │
                       │ REST/OpenAPI + WebSocket gateway    │
                       └───────┬──────────────┬─────────────┘
                               │              │
                 ┌─────────────▼───┐    ┌─────▼──────────────┐
                 │ PostgreSQL       │    │ Redis + BullMQ      │
                 │ source of truth  │    │ cache, jobs, limits │
                 └─────────────────┘    └─────┬──────────────┘
                                               │
             ┌─────────────────────────────────┼────────────────────────┐
             ▼                                 ▼                        ▼
     Object storage/CDN                Email / WhatsApp             Meet / Slack
     uploads, certificates             notification adapters        integration adapters
```

The API is stateless and horizontally scalable. PostgreSQL is the transactional source of truth. Redis supports caching, rate limiting, WebSocket fan-out, and durable asynchronous work queues; it must not be the sole source for business records. Object storage holds user and generated files; database records contain ownership, metadata, authorization state, and lifecycle.

## 3. Frontend architecture

### Application shape

Use a TypeScript React single-page application built with Vite. The web client is an authenticated application shell with route-level feature modules, role-aware navigation, responsive layouts, and a public certificate-verification route. A future server-rendered marketing site may remain a separate app; it is not a prerequisite for the product application.

### Frontend layers

| Layer | Responsibility | Rules |
| --- | --- | --- |
| App shell | routing, session bootstrap, error boundaries, themes, global layout | no domain business rules |
| Feature modules | screens, view components, route loaders, feature-local schemas | grouped by domain, not generic page type |
| Shared UI package | primitives, tokens, accessible composition patterns | no API access or product-specific assumptions |
| API client | generated OpenAPI types/client, auth-aware transport | do not hand-maintain duplicate request/response types |
| Server state | TanStack Query cache, invalidation, loading/error state | API remains source of truth |
| Local UI state | dialogs, filters, drafts, display preferences | small scoped stores only; never duplicate server data |
| Forms | React Hook Form plus Zod | client validation improves UX; server validation remains authoritative |

Routes use route-level code splitting and feature-level error boundaries. Server state queries use keys scoped by organization, academy, cohort and entity ID to prevent cache bleed after context switch. API responses never decide permissions client-side; the UI consumes capability metadata to present available actions while the server independently enforces policy.

### Frontend reliability and security

- Access tokens are short-lived and held in memory; rotated refresh tokens use Secure, HttpOnly, SameSite cookies.
- A request interceptor performs one controlled refresh/retry; concurrent refreshes are coalesced; invalid refresh redirects to sign-in without losing safe local drafts.
- Content Security Policy, Trusted Types where feasible, output encoding, and dependency scanning are part of release gates.
- Uploads use server-authorized short-lived direct-upload signatures. The client never receives storage-provider credentials.
- WebSocket use is narrowly limited to notifications and direct-message events. Every event carries scoped identity and sequence/version metadata; REST remains the recovery/read path.

## 4. Backend architecture

### Modular monolith boundaries

The NestJS application has independently testable modules with controller → application service/use case → domain policy/model → repository boundaries. Modules may share stable contracts and common infrastructure but must not query another module’s tables directly without an explicit application interface.

| Module | Owns |
| --- | --- |
| Identity | users, authentication, sessions, MFA, invitations, identity-provider links |
| Organizations | organizations, academies, memberships, roles, policy assignments |
| Catalog | programmes, curriculum versions, modules, weeks, lessons, resources |
| Cohorts | cohorts, mentor assignments, enrolments, schedules |
| Learning | releases, progress, assignments, submissions, reviews, grading guides |
| Community | announcements, conversations, messages, reports/moderation |
| Operations | huddles, attendance, calendar synchronization, notifications/preferences |
| Outcomes | certificates, eligibility, verification, portfolios, leaderboards |
| Payments | pricing plans, cohort prices, payment ledger and provider adapters; checkout disabled unless enabled |
| Platform | audit logs, file assets, feature flags, integrations, system configuration |

### Internal communication

Use synchronous application calls for a transaction that must succeed atomically (for example, submission creation and its status transition). Publish durable domain events through an outbox table for side effects such as notification delivery, search indexing, analytics aggregation, certificate rendering, and integration delivery. A worker consumes the outbox idempotently via BullMQ. Event handlers store delivery/idempotency records and are safe to retry.

Controllers remain thin. All externally visible operations have DTO validation, authorization, correlation/request IDs, structured error envelopes (`code`, `message`, `details`, `requestId`), and OpenAPI annotations. Apply idempotency keys to unsafe retriable endpoints (submission finalization, payment callbacks, certificate issuance, invitations) where duplicate execution would be harmful.

## 5. Monorepo and package organization

Use npm workspaces initially; adopt a task runner such as Turborepo only when parallel build/caching needs justify it.

```text
forge/
  apps/
    web/                  # React/Vite learner and operations application
    api/                  # NestJS API, gateways, worker entry points
  packages/
    ui/                   # design tokens and shared accessible components
    api-contract/         # OpenAPI specification, generated client and types
    config/               # shared TypeScript, lint, formatting and test configs
    domain-contracts/     # stable event/value contracts only, no database models
  docs/                   # product, architecture, ADRs, operations runbooks
  infra/                  # IaC, deployment manifests, environment templates
  scripts/                # safe developer/CI orchestration scripts
```

Package dependency direction is one-way: `apps/* → packages/*`; `ui` cannot import application domains; `api-contract` cannot import web or API runtime code; `domain-contracts` stays dependency-light. Prisma schema and migrations live in the API until there is a genuine shared database deployment concern. Avoid a shared “utils” dumping ground; create narrowly named packages only with a clear owner and consumer set.

## 6. Authentication architecture

### Identity and session model

Support email/password, Google, Microsoft, and enterprise OpenID Connect. Passwords use Argon2id with calibrated parameters. Verify email before full access. Store a short-lived signed access JWT in memory and a rotating refresh token in an HttpOnly Secure cookie. Persist refresh sessions as hashed token families, device metadata, expiry, revocation status, and last-used time.

```text
sign-in / OIDC callback → identity verified → MFA policy evaluated → session issued
API request → short-lived access token → authorization guard → scoped use case
token refresh → rotate refresh token family → revoke family on reuse/suspicion
logout / password reset / admin revoke → session family revoked → audit event
```

Require TOTP MFA at first sign-in for mentors and administrators, and when students begin a cohort. Provide single-use recovery codes, rate-limited recovery, and supervised recovery for high-risk roles. Use a provider abstraction (`IdentityProvider`) so each external IdP is an implementation, not a system-wide dependency. SAML is deferred until a contracted requirement warrants it.

Authentication security controls: rate limiting and progressive delay, generic credential-failure messages, breach-password screening where legally/operationally approved, reset token expiry and single use, re-authentication for sensitive actions, secure invitation expiry, session management page, anomaly alerts, CSRF controls on cookie-bearing refresh endpoints, and OIDC state/nonce/PKCE validation.

## 7. RBAC and authorization architecture

Roles are membership-scoped: `SUPER_ADMIN`, `ORG_ADMIN`, `ACADEMY_ADMIN`, `MENTOR`, `STUDENT`. A user can have different memberships across organizations and academies. Do not encode access with scattered role-name checks.

Authorization combines:

1. **Tenant scope** — organization is mandatory for all tenant-owned reads/writes; academy scope applies where relevant.
2. **Role permissions** — a versioned permission catalogue maps roles to capabilities, e.g. `cohort.read`, `submission.review`, `certificate.approve`.
3. **Resource policy** — ownership, mentor assignment, cohort membership, record state, and action-specific rules refine role permission.
4. **Field/data minimization policy** — serializers prevent exposure of private notes, unrelated learner data, secrets, or cross-tenant records.

The API resolves active organization/academy from an explicit, validated context selection; URL/resource scope must agree with the active membership. Repository methods require scope objects rather than optional organization arguments. Policy decisions are logged for privileged or sensitive actions. The frontend receives capabilities for affordance only; it is never the authority.

## 8. Database architecture

### Data platform

Use managed PostgreSQL with Prisma migrations, connection pooling, automated backups, point-in-time recovery, encryption at rest, and monitored replication lag. Use UUID primary keys, UTC timestamps, `created_at`/`updated_at`, foreign-key constraints, and transaction boundaries around state transitions. Use soft deletion only where recovery/audit policy requires it; otherwise retain an immutable audit event and delete according to retention rules.

### Multi-tenant schema strategy

Start with a shared database and shared tables, with mandatory `organization_id` on every tenant-owned table. Academy, programme, cohort, and membership scoping follows the hierarchy below:

```text
Organization → Academy → Programme → Cohort → Enrollment
                        └→ Curriculum → Week → Lesson/Assignment
User ↔ Membership (organization + optional academy + role)
```

Application repositories enforce scoped predicates. Add database foreign keys and composite indexes beginning with `organization_id` for tenant-scoped query patterns. Consider PostgreSQL row-level security only after the application’s scope model and migration tooling are mature; it is defense-in-depth, not a substitute for policy design. Do not use separate databases per tenant at launch; create a tenant-routing abstraction so enterprise isolation can be introduced later.

### Key integrity rules

- unique slugs within parent scope; unique `(cohort_id, student_id)` enrolment; unique `(enrollment_id, lesson_id)` progress;
- only one active/pending/awaiting-completion cohort per learner under the v1 progression policy;
- version grading guides/rubrics, programme curricula, certificate templates, permissions and published content;
- assignment submissions follow draft/submitted/revision-required/approved/rejected transitions, maximum three attempts by default;
- certificate issuance requires recorded eligibility evidence, mentor recommendation and admin approval; revocation retains reason and audit trail;
- immutable audit records for role, grade, enrolment, certificate, configuration, export, moderation and support-access actions.

Operational data is partitioned by time when necessary (audit events, notifications, message/report records) only after measured growth. Use read replicas for reporting before splitting transactional modules. Analytical aggregation tables/jobs should serve dashboards rather than expensive live joins over high-volume records.

## 9. Storage architecture

Use an S3-compatible managed object store fronted by a CDN for student evidence, avatars, exported reports, rendered certificates, and permitted course assets. Keep an `FileAsset` metadata record: tenant owner, uploader, MIME type, size, checksum, storage key, scan status, lifecycle status, visibility, and retention deadline.

- Generate tenant-prefixed opaque object keys; never expose guessable paths or a public bucket listing.
- Direct uploads use narrowly scoped, short-lived signed URLs with content type/size constraints. The API finalizes ownership only after object metadata verification.
- Scan uploads for malware before making them available; quarantine failures and notify the uploader safely.
- Serve private assets through short-lived signed download URLs after API authorization. Public portfolio media uses an explicit public visibility flag and separate delivery policy.
- Apply lifecycle rules: expire abandoned uploads, archive/delete raw submissions and messages after policy period, retain certificate/audit artifacts seven years, and honour holds/approved data-subject requests.
- Encrypt at rest with provider-managed keys initially; introduce customer-managed keys only if contractual requirements justify the operational burden.

## 10. Notification architecture

Notifications are event-driven and preference-controlled. Business events write an outbox record within the source transaction. A worker evaluates recipient scope, consent/channel preference, quiet hours, deduplication, templates, and escalation before dispatching through adapter interfaces.

| Channel | Use | Delivery pattern |
| --- | --- | --- |
| In-app | all actionable product events | persisted notification plus WebSocket fan-out |
| Email | transactional/security and opted-in fellowship events | provider adapter, webhook delivery/bounce processing |
| WhatsApp Business Cloud API | approved template reminders and opt-in communications | template-only outbound; replies routed to moderated queue |
| Slack | organization-configured operational/community notices | scoped integration adapter |
| Push | future opt-in web/mobile alerts | add only after explicit consent/lifecycle policy |

Every delivery uses a stable event ID, idempotency key, channel attempt history, status, provider message ID, and retry policy with exponential backoff and a dead-letter queue. A failed external channel never rolls back the core product transaction. Notifications have deep links, human-readable time, accessible copy, and localized template variables when localization is introduced.

## 11. API communication flow

REST JSON under `/api/v1` is the primary contract. OpenAPI is generated and versioned with the API; the typed web client is generated in CI and checked for compatibility. Use cursor pagination, explicit filtering/sorting allow-lists, ISO-8601 timestamps, RFC-style status codes, and a stable error envelope.

```text
Web route → typed API client → access-token request
  → edge/WAF → Nest guard (identity + scope) → DTO validation
  → policy authorization → application use case → transaction/repository
  → response DTO + request ID
  → outbox event → worker → notification/integration/aggregate side effect
```

Use `ETag`/version fields or optimistic concurrency for high-contention mutable resources (curriculum editor, settings, attendance batch, role configuration). Require idempotency keys for payment webhooks and other retry-prone mutation paths. WebSocket authentication uses the same session identity, short-lived authorization, origin validation and per-event authorization. Clients re-fetch by REST after reconnect or sequence gap.

## 12. Security architecture

### Defence in depth

| Area | Controls |
| --- | --- |
| Network | TLS 1.2+, HSTS, WAF/CDN, private database/cache networking, strict ingress, DDoS provider controls |
| Application | DTO validation, parameterized ORM access, output encoding, CSP, CORS allow-list, CSRF protection, rate limits, secure headers |
| Identity | Argon2id, MFA, rotated sessions, OIDC PKCE/state/nonce, session revocation, re-auth for critical actions |
| Authorization | mandatory tenant scope, policy guard, field-level serializers, audit logs, tests for cross-tenant denial |
| Data | encryption at rest/in transit, least-privilege service roles, backup encryption, secret manager, retention/deletion workflow |
| Files/integrations | signed upload/download URLs, malware scan, webhook signature validation, OAuth secret rotation, outbound allow-list where possible |
| Operations | dependency/SAST/secret scanning, patch SLAs, immutable logs, incident runbooks, access reviews, production break-glass controls |

Align privacy operations with the Nigeria Data Protection Act: data inventory, lawful basis/consent capture where appropriate, minimal collection, privacy notice, access/correction/deletion workflow, retention schedule, processor agreements, breach-response process, and named data-protection responsibility. Direct messages are reportable/moderated with restricted moderator access and documented retention.

## 13. Scalability and resilience strategy

Launch with independently scalable web, API, worker, PostgreSQL, Redis, and object storage services. Scale based on observed saturation and service-level objectives, not expected user count alone.

- **Stateless API:** horizontal replicas behind a load balancer; graceful shutdown; readiness/liveness endpoints; websocket adapter/fan-out through Redis.
- **Database:** indexed scoped queries; pooled connections; slow-query monitoring; read replicas for reports; aggregate tables; partition high-volume append-only data when thresholds demand it.
- **Workers:** separate queues/concurrency per notification, file, reporting, and certificate workload; isolate costly rendering from user requests; dead-letter/replay with idempotency.
- **Cache:** cache only safe, scoped, short-lived reads (catalogues, capability/config metadata); invalidate on mutation; never cache private response without user/tenant-aware keying.
- **Degradation:** if integrations fail, retain in-app event and surface delivery status; if reporting lags, show freshness; if storage scan is delayed, block file availability but not unrelated work.
- **Availability:** define initial SLOs before launch (e.g., 99.9% API monthly availability, p95 read API under 400ms excluding external providers); monitor against error budget. Backups, restore drills, multi-AZ database, and tested RPO/RTO targets are release requirements.

## 14. Deployment architecture and operations

Use separate development, staging, and production environments with distinct accounts/projects, databases, caches, buckets, secrets, OAuth callbacks and webhook endpoints. Production data never enters lower environments. Configuration is environment-specific and validated at startup; secrets reside in a managed secret store, never source control.

```text
Git pull request → CI (lint, type, unit, API contract, security, migration checks)
  → deploy preview (web where appropriate) → staging integration/E2E/accessibility checks
  → approved production deploy → migrate safely → canary/health verification → monitor/rollback
```

Recommended initial topology: React static assets on a global CDN host (e.g. Vercel); containerized Nest API and workers on a managed container platform; managed PostgreSQL and Redis in private networking; managed S3-compatible storage; managed observability, email, and error tracking. The exact cloud vendor is deliberately abstracted behind infrastructure-as-code modules and adapter interfaces.

Schema changes follow expand → deploy compatible code → backfill asynchronously → switch reads/writes → contract later. Never couple a destructive migration to the first deploy that stops reading the old structure. Feature flags provide controlled rollout and kill switches, with tenant scope and audit history. CI requires migration review, build artifacts/SBOM, vulnerability scanning, test gates, and a rollback plan. Monitor structured logs, metrics, traces, queue depth, job failures, database health, authentication failures, authorization denials, integration failures, and user-facing web errors; alert on actionable symptoms with runbooks.

## 15. Technology decisions and trade-offs

| Decision | Choice | Why | Trade-off / revisit trigger |
| --- | --- | --- | --- |
| Architecture | NestJS modular monolith | fastest coherent delivery; transactional consistency; low operations burden | extract only a measured bottleneck or independently scaling domain |
| Web | React + TypeScript + Vite | mature ecosystem; fast SPA workflows; good component/design-system fit | SSR/SEO needs may justify separate Next.js marketing/public app |
| API | REST + OpenAPI, limited WebSockets | inspectable, typed contract; resilient request recovery | add GraphQL only for proven aggregation/client-composition pain |
| Database | PostgreSQL + Prisma | relational integrity and transactions suit cohorts/assessment/access | evaluate query layer if ORM cannot express performance-critical queries |
| Queue/cache | Redis + BullMQ | reliable async jobs, common Nest tooling | move to managed durable event broker only at high throughput/independent services |
| Storage | S3-compatible object storage | durable, scalable, signed-access pattern | abstraction permits vendor migration; egress cost must be monitored |
| Identity | internal session service + OIDC adapters | control membership/RBAC/MFA; supports required providers | use managed IdP if compliance/enterprise SSO operations dominate |
| Multitenancy | shared DB/tables with enforced tenant scope | efficient v1 operations and analytics | dedicated tenant DB only for contractual isolation/performance needs |
| Deploy | managed CDN + containers + managed data services | operational leverage and portability | vendor features must remain behind IaC/adapters |

## 16. Architectural Decision Records (ADRs)

| ADR | Decision | Status | Consequence |
| --- | --- | --- | --- |
| ADR-001 | Adopt a modular monolith for v1 | Accepted | strict modules now; no microservice network/operational overhead |
| ADR-002 | Use shared-schema multitenancy with mandatory organization scope | Accepted | efficient launch; every query/policy must be tenant-tested |
| ADR-003 | Use PostgreSQL as transactional source of truth | Accepted | supports integrity; analytics requires intentional aggregates/replicas |
| ADR-004 | Use REST/OpenAPI as primary external/client contract | Accepted | typed clients and compatibility discipline; limited real-time needs use WebSockets |
| ADR-005 | Use outbox + worker queue for side effects | Accepted | reliable async notifications/artifacts; requires idempotency and queue operations |
| ADR-006 | Use rotating cookie refresh sessions and in-memory access JWTs | Accepted | reduces token exposure; adds refresh/CSRF/session lifecycle complexity |
| ADR-007 | Enforce policy-based scoped RBAC | Accepted | safer than role checks; requires permission catalogue and policy tests |
| ADR-008 | Use direct signed object uploads plus scan gate | Accepted | efficient large files; adds scan/finalization workflow |
| ADR-009 | Version published curriculum, rubrics and certificates | Accepted | historical decisions remain reproducible; editing needs clear version UX |
| ADR-010 | Make certificate eligibility evidence immutable | Accepted | defensible verification; exception/revocation processes must be auditable |
| ADR-011 | Support OIDC in v1 and defer SAML | Accepted | meets current federation needs; SAML adapter is future work |
| ADR-012 | Keep payment ledger/provider adapter from outset, checkout disabled by default | Accepted | future monetization without rework; additional data/security scope now |

Each ADR must have its own dated file in `docs/adr/` before a decision changes, recording context, decision, alternatives, consequences, owner, and review trigger.

## 17. Principal risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Cross-tenant data exposure | scope-required repositories, policy guards, serializer tests, automated negative authorization tests, audit/alert review |
| Privilege escalation or compromised admin account | mandatory MFA, least privilege, re-authentication, session anomaly controls, immutable audit logs, access reviews |
| Scope creep into a generic LMS | preserve bounded product model and milestone gates; validate new work against fellowship outcomes |
| Worker/integration delivery failures | transactional outbox, idempotency, DLQ, delivery dashboard, fallback in-app notification |
| File malware or unauthorized access | signed URLs, scan/quarantine, MIME/size validation, private buckets, asset authorization tests |
| Data loss or unrecoverable migration | PITR backups, restore drills, backwards-compatible migrations, migration ownership/review |
| Poor performance during cohort deadlines | load tests around submission/review peaks, separate worker resources, DB indexes, queue back-pressure, CDN delivery |
| Vendor outage/lock-in | adapter boundaries, exported data, IaC, provider webhook retry, documented recovery mode |
| Reporting harms privacy or misleads | role-scoped aggregates, metric definitions/freshness, no cross-tenant personal data, accessible raw-data alternatives |
| Regulatory/retention failure | documented schedule, automated lifecycle jobs, legal holds, access/deletion workflow, periodic policy review |
| Moderation and WhatsApp compliance failure | explicit opt-in/out, approved templates, report queue, restricted moderator roles, immutable decision records |

## 18. Future extensibility

### Multi-organization SaaS

The organization is the tenant boundary from the first release; academy is an internal subdivision. Memberships are scoped so one identity can participate across organizations without data sharing. Tenant-aware configuration, branding, feature flags, integration credentials, retention policies, and custom domains should be modeled as organization settings behind audited administration. Enterprise requirements can later introduce tenant routing to a dedicated database, region, encryption key, or deployment without changing domain-facing APIs.

### Multiple fellowship programmes

Programmes are reusable curriculum definitions owned by one academy in v1; cohorts are time-bounded programme runs. Copy/version programmes across academies rather than co-editing a multi-owner curriculum. Curriculum, rubric, completion policy and certificate template versioning make each cohort reproducible. Future catalogue, elective, micro-credential, payment, and partner-delivered programme features belong behind the Catalog, Cohorts, Outcomes, and Payments module contracts, not as bespoke tables on the learner dashboard.

### Deliberate extension seams

- Identity providers, payment processors, storage, email, WhatsApp, Slack, meeting/calendar, analytics and search are adapter interfaces.
- Domain events can be mirrored to an event bus when service extraction becomes justified.
- Feature flags support staged organization-level rollout and experimentation with audit visibility.
- Reporting evolves through aggregates/warehouse exports before a separate analytics platform.
- A native mobile client can use the same versioned REST API, scoped authorization, push notification adapter, and signed upload flow.

## 19. Implementation governance

No implementation may bypass this blueprint without an ADR. Before a module is built, its owner must define: API contract, authorization matrix, data ownership/migrations, events/outbox behavior, audit events, failure modes, observability signals, accessibility implications, retention impact, test strategy, and rollout/rollback plan. Production readiness requires threat modeling for high-risk flows, load testing for cohort deadlines, restore verification, incident runbooks, dependency/security review, and approval by product, engineering, and data-protection owners.
