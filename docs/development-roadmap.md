# Project Forge — Development Roadmap

**Status:** Master implementation guide — proposed for approval  
**Scope:** Delivery of the approved multi-tenant Fellowship Management Platform  
**Planning basis:** Architecture, database, API, product-design, and project-structure specifications in `docs/`  
**Estimation unit:** Two-week sprints; durations are indicative elapsed time for a cross-functional team and include integration, review, and remediation.

## 1. Product understanding and delivery principles

Project Forge is a multi-tenant fellowship operations platform, initially serving Tech Impact Fellowship. An organization is the non-negotiable tenant boundary, containing academies, fellowship programmes, courses, cohorts, memberships, learning delivery, assessments, operations, and outcomes. One identity can hold different membership roles across tenant scopes. The initial operating model requires policy-based authorization, mandatory MFA at the defined role/lifecycle points, a single active learner progression, versioned curriculum and assessment policy, and an auditable certificate process.

Version 1 is a modular monolith: React/TypeScript/Vite web app; NestJS REST/OpenAPI API and worker runtime; PostgreSQL/Prisma; Redis/BullMQ; object storage; and adapter-backed integrations. It must support multiple organizations, academies, fellowships, cohorts, thousands of learners, and hundreds of mentors without cross-tenant data exposure. The API is authoritative for validation, tenant scope, and authorization; the web client uses generated contracts and TanStack Query.

Delivery follows these rules:

- Build vertical slices only after their data ownership, API contract, authorization matrix, audit events, observability, retention implications, and rollout plan are defined.
- Enforce tenant scope in guards, policies, serializers, and scope-required repositories from the first migration. UI capability checks are affordances, not authorization.
- Release side effects through transactional outbox events and idempotent workers; an integration failure never rolls back a committed business action.
- Use backward-compatible, reviewed migrations and versioned OpenAPI contracts. No destructive schema change ships with code that still depends on the old shape.
- Treat accessibility (WCAG 2.2 AA), security, privacy/NDPA, responsive behavior, and observability as acceptance criteria in every feature phase—not final polish.

## 2. Requirements needing confirmation before or during delivery

The documents establish the core v1 decisions. The following details remain necessary to estimate, configure, or release specific work; they should be resolved as named backlog decisions, not silently assumed:

| Decision / missing requirement | Required by | Recommended resolution point |
| --- | --- | --- |
| Production cloud, managed PostgreSQL/Redis/object-storage, email, error-monitoring, and observability vendors | Infrastructure and deployment | Phase 1 architecture/infrastructure decision record |
| Final identity-provider tenant configuration, OIDC discovery details, domain allow-lists, and supervised MFA-recovery ownership | Authentication | Phase 3 before staging sign-in testing |
| Exact email provider, approved WhatsApp templates/opt-in copy, Slack and Google Meet integration scopes | Notifications and integrations | Phase 10 before external-channel launch |
| Curriculum content, rubrics, grading-guide templates, certificate template/signatories, and programme completion-policy exception workflow | Catalog, learning, outcomes | Phase 6–9 product/content readiness gates |
| Payment launch decision, Paystack merchant/legal configuration, receipt/refund policy, and tax/accounting ownership | Payments | Phase 9; keep checkout feature-flagged until approved |
| Data-protection lead, privacy notice, subject-request SLA, legal-hold process, and deletion/export approval workflow | Privacy/release | Phase 2 and Phase 12 gates |
| Initial tenant, academy, administrator roster, cohort capacity, mentor capacity, support/escalation rota, and seed/onboarding data | Pilot readiness | Phase 5 and Phase 13 readiness gates |
| Initial SLOs, RPO/RTO targets, on-call ownership, incident severity model, and support channels | Operations | Phase 2 and Phase 13 readiness gates |
| Browser/PWA support matrix, localization priority beyond English, and public marketing/SEO scope | Web release planning | Phase 1; marketing remains a separate future app unless approved |

The existing workspace-manager inconsistency is resolved in favor of **pnpm**. The prior concurrent-enrollment default is superseded by the approved one-active-progression rule. The roadmap uses the database/API distinction of a fellowship programme containing one or more courses.

## 3. Roadmap at a glance

| Phase | Primary outcome | Indicative duration | Target sprint(s) |
| --- | --- | ---: | --- |
| 0 | Delivery governance and backlog readiness | 1 week | 0 |
| 1 | Monorepo, environments, CI, design/system foundations | 2 weeks | 1 |
| 2 | Data platform, tenant kernel, security and observability baseline | 4 weeks | 2–3 |
| 3 | Authentication, MFA, memberships, RBAC and user administration | 4 weeks | 4–5 |
| 4 | Organization, academy, platform administration, and access control UI | 2 weeks | 6 |
| 5 | Application shell, shared UI, role-aware dashboards and profile utilities | 4 weeks | 7–8 |
| 6 | Fellowship catalogue, versioned curriculum, cohorts and enrolment | 4 weeks | 9–10 |
| 7 | Student learning experience, progress, releases and resources | 4 weeks | 11–12 |
| 8 | Mentor workflows: cohorts, learner support, reviews and attendance | 4 weeks | 13–14 |
| 9 | Assessments, projects, certificates, portfolios and payment foundation | 4 weeks | 15–16 |
| 10 | Announcements, notifications, messaging, calendar and integrations | 4 weeks | 17–18 |
| 11 | Analytics, reports, leaderboards, platform operations and moderation | 4 weeks | 19–20 |
| 12 | Performance, security, accessibility, privacy and resilience hardening | 4 weeks | 21–22 |
| 13 | Pilot, production launch, monitoring and transition to operations | 4 weeks | 23–24 |

The sequential critical path is approximately 49 weeks including phase gates. UI implementation, design-system maturation, contract generation, documentation, and test automation should overlap safely after their dependencies clear; do not overlap work that weakens the tenant/authentication/data foundations.

## 4. Implementation phases

### Phase 0 — Delivery governance and backlog readiness

| Item | Plan |
| --- | --- |
| Objective | Turn approved specifications into owned, estimable epics and establish decision, quality, and release governance. |
| Features | Epic/story decomposition; definition of ready/done; ownership map; ADR and risk registers; initial release backlog; vendor/decision log. |
| Dependencies | Approved documents in `docs/`; product, engineering, design, security, operations, and data-protection owners assigned. |
| Deliverables | Prioritized delivery backlog; RACI; architecture decision log; test strategy; release calendar; issue templates and acceptance-criteria template. |
| Acceptance criteria | Every v1 capability has an epic, owner, dependencies, acceptance criteria, and release target; unresolved items in Section 2 have an owner and deadline. |
| Testing requirements | Review traceability from product routes/API/database constraints to backlog epics; no application code. |
| Documentation requirements | ADR template, risk register, decision log, definition of ready/done, and sprint/release calendar. |
| Git branch recommendation | `chore/delivery-governance`; documentation PR reviewed by engineering, product, and security leads. |
| Complexity / duration | Medium / 1 week. |

### Phase 1 — Project initialization and engineering foundations

| Item | Plan |
| --- | --- |
| Objective | Establish the pnpm monorepo, repeatable local setup, shared engineering standards, and non-production environment skeleton. |
| Features | Workspace apps/packages; React/Vite and NestJS bootstraps; API-contract generation pipeline; Tailwind/shadcn UI base; lint/format/type/test tooling; CI quality gates; environment validation; infrastructure skeleton. |
| Dependencies | Phase 0 decisions; selected Node LTS and initial cloud/vendor direction. |
| Deliverables | `apps/web`, `apps/api`, `@forge/ui`, `@forge/api-contract`, `@forge/config`, and `@forge/domain-contracts`; local developer guide; CI for install, lint, typecheck, unit tests, OpenAPI compatibility, and dependency/security scans. |
| Acceptance criteria | Clean checkout is reproducibly installable with pnpm; both apps build; CI blocks failing quality/contract checks; secrets are absent from source control; standard PR preview/staging path is documented. |
| Testing requirements | Smoke tests for web/API/worker boot, config validation, contract-generation determinism, and CI workflow validation. |
| Documentation requirements | README setup/commands, environment-variable reference, repository contribution guide, initial ADRs for monorepo and deployment baseline. |
| Git branch recommendation | Short-lived `chore/foundation-*` branches merged through protected `main`. |
| Complexity / duration | High / 2 weeks. |

### Phase 2 — Data platform, tenant kernel, security and observability baseline

| Item | Plan |
| --- | --- |
| Objective | Build the safe operating substrate before domain features: PostgreSQL/Prisma, tenant context, audit/outbox, files, configuration, queues, and operational telemetry. |
| Features | Prisma schema/migration workflow; organization-scoped repository pattern; active organization/academy context; standard API error/request-ID envelope; audit logs; transactional outbox; BullMQ/Redis setup; `FileAsset` lifecycle; feature flags; health/readiness; logs, metrics, traces, backup/restore automation. |
| Dependencies | Phase 1; managed data-service credentials/networking; data classification and retention ownership. |
| Deliverables | Initial shared schema and migrations; tenant-scope utilities/guards; audit/outbox event framework; worker bootstrap; object-storage adapter and scan-gate interface; dashboards/alerts for core service health. |
| Acceptance criteria | No tenant-owned repository can be called without scope; negative cross-tenant tests pass; audited mutations emit correlation-linked events; failed worker delivery is retryable/idempotent; backup restore is demonstrated in a non-production environment. |
| Testing requirements | Migration tests; transaction/outbox tests; tenant-isolation integration tests; queue retry/DLQ tests; storage authorization/scan-state tests; health/telemetry smoke tests. |
| Documentation requirements | Data model mapping, migration/runbook, audit-event catalogue, outbox/queue guide, storage lifecycle policy, SLO/RPO/RTO draft, restore runbook. |
| Git branch recommendation | `feat/platform-kernel-*`; merge only after database and security review. |
| Complexity / duration | Very high / 4 weeks. |

### Phase 3 — Authentication, MFA, RBAC and user management

| Item | Plan |
| --- | --- |
| Objective | Deliver secure identity, session lifecycle, membership-scoped permissions, and safe user administration. |
| Features | Email/password, email verification/reset, Google/Microsoft/OIDC adapters, rotating sessions, TOTP/recovery codes, invitations, `/me`, membership roles, permission catalogue, user directory/status, re-authentication, rate limits, access audit events. |
| Dependencies | Phase 2; identity-provider configurations; MFA recovery ownership. |
| Deliverables | Identity and organizations authorization interfaces; OpenAPI operations; sign-in/onboarding/MFA/recovery screens; role/capability resolver; administrator membership tools. |
| Acceptance criteria | MFA policy is enforced for admins/mentors at first sign-in and learners at cohort start; token rotation/reuse detection, session revocation, invitation expiry, and policy-based scope denial work; UI never grants access without server authorization. |
| Testing requirements | Unit/state-machine tests; OIDC callback/PKCE tests; session rotation and CSRF tests; rate-limit tests; RBAC matrix and cross-tenant negative E2E tests; accessible keyboard-only auth journeys. |
| Documentation requirements | Authentication flow, role/permission matrix, session/MFA recovery runbook, identity-provider setup guide, threat model, API examples. |
| Git branch recommendation | `feat/identity-*`; isolate provider adapters into reviewable PRs. |
| Complexity / duration | Very high / 4 weeks. |

### Phase 4 — Tenant administration and platform governance

| Item | Plan |
| --- | --- |
| Objective | Enable controlled provisioning and governance of organizations, academies, access, settings, and support operations. |
| Features | Super-admin organization provisioning/suspension; academy management; platform/organization/academy settings; permissions inspector; audit-log search; support-session request/approval; feature-flag administration; integration connection metadata. |
| Dependencies | Phases 2–3; approved super-admin operating policy. |
| Deliverables | Organizations and platform modules/routes; platform home and organization/access/configuration/audit interfaces; settings schemas and audit rules. |
| Acceptance criteria | A super-admin can provision Tech Impact Fellowship and its academy/admin without bypassing audit or scope controls; organization suspension blocks applicable access; support access is time-boxed, approved, bannered, and auditable. |
| Testing requirements | Organization lifecycle, scope mismatch, settings concurrency, support-session, secret-redaction, and audit-immutability tests; platform UI accessibility tests. |
| Documentation requirements | Tenant-provisioning runbook, settings catalogue, break-glass/support-access policy, audit-search guide. |
| Git branch recommendation | `feat/platform-governance-*`. |
| Complexity / duration | High / 2 weeks. |

### Phase 5 — Web application shell and shared experience foundation

| Item | Plan |
| --- | --- |
| Objective | Create the responsive, accessible, role-aware application foundation used by every portal. |
| Features | `@forge/ui` primitives/tokens; authenticated/public layouts; navigation and tenant switcher; route guards/error boundaries; TanStack Query scope-safe cache; profile/privacy/preferences; notifications/messages placeholders; shared tables/forms/status/loading/error/empty states; public certificate verification route shell. |
| Dependencies | Phases 1–4; approved product design tokens/navigation labels. |
| Deliverables | Web providers, layout system, shared components, route registry/code splitting, generated client integration, baseline role dashboards and public routes. |
| Acceptance criteria | All documented breakpoints work for shell/navigation; route access responds safely to session/tenant changes; shared controls meet WCAG 2.2 AA baseline and preserve mobile/keyboard behavior; no feature duplicates generated contract types. |
| Testing requirements | Component/accessibility tests, visual/regression coverage for shell, route authorization E2E tests, cache-isolation tests, browser compatibility smoke suite. |
| Documentation requirements | UI contribution guide, design-token reference, query-key convention, routing and error-boundary guide. |
| Git branch recommendation | `feat/web-shell-*` and `feat/ui-*`, with package changes separately reviewable. |
| Complexity / duration | High / 4 weeks. |

### Phase 6 — Catalogue, curriculum, cohorts and enrolment operations

| Item | Plan |
| --- | --- |
| Objective | Enable administrators to model and run versioned fellowship delivery safely. |
| Features | Fellowships/programmes, courses, curriculum modules, weeks, lessons/resources authoring, draft/publish/retire/version flows, cohort creation/state transitions, curriculum snapshots/releases, mentor assignment, enrolment invitation/approval/progression rule, capacity controls. |
| Dependencies | Phases 2–5; initial programme/curriculum/content-owner input. |
| Deliverables | Catalog and cohorts modules; API contract; programme/curriculum builder, week/lesson/assignment editor foundations, cohort/enrolment/mentor interfaces; initial Tech Impact Fellowship seed plan. |
| Acceptance criteria | Published curriculum is immutable/versioned; an active cohort references an immutable snapshot; parent/tenant integrity, ordering, capacity, and one-active-progression constraints are enforced transactionally; audit records explain publish/enrolment/state changes. |
| Testing requirements | Migration/constraint tests; curriculum version/reorder/concurrency tests; cohort lifecycle and enrolment capacity/progression E2E tests; authoring/mobile/keyboard accessibility tests. |
| Documentation requirements | Content-authoring guide, curriculum versioning/release runbook, cohort setup and enrolment operations manual, data migration/rollback plan. |
| Git branch recommendation | `feat/catalog-*`, `feat/cohorts-*`; preserve module ownership in separate PR streams. |
| Complexity / duration | Very high / 4 weeks. |

### Phase 7 — Student portal and learning experience

| Item | Plan |
| --- | --- |
| Objective | Give active learners a clear, reliable weekly learning loop. |
| Features | Student dashboard/this week; programme/module/week/lesson navigation; release/locked states; resources; lesson completion and progress; learning notes/drafts where approved; assignment discovery; certificates/progress eligibility views; responsive student portal. |
| Dependencies | Phases 3, 5, and 6; released curriculum snapshot; asset storage scan flow. |
| Deliverables | Learning module APIs and student feature slices; student routes from home through lesson/resources/progress; scoped query keys, offline-safe completion retry behavior, and accessible media/link treatment. |
| Acceptance criteria | Learners see only their released cohort content; progress derives from `learning_progress`; context switch does not leak cached data; locked content explains availability; completion is idempotent and failure preserves/reconciles safe local intent. |
| Testing requirements | Learning-release and progress integration tests; student role/scope E2E tests; offline/retry tests; responsive, screen-reader, keyboard, captions/transcript and external-link accessibility coverage. |
| Documentation requirements | Learner help content, curriculum release support guide, progress calculation definition, accessibility-content checklist. |
| Git branch recommendation | `feat/learning-student-*`. |
| Complexity / duration | High / 4 weeks. |

### Phase 8 — Mentor portal, reviews and attendance

| Item | Plan |
| --- | --- |
| Objective | Equip mentors to coach assigned learners, manage review SLA, and accurately record cohort operations. |
| Features | Mentor dashboard/cohort overview; learner directory/profile; at-risk indicators with explainable reasons; review queue; submission review workspace; private audited mentor notes; huddle scheduling; attendance roster/corrections; cohort announcements foundation; mentor analytics preview. |
| Dependencies | Phases 3, 6, and 7; mentor-assignment data; approved risk/at-risk definitions. |
| Deliverables | Mentor feature slices and scoped APIs for reviews, huddles, attendance, and learner support; review-SLA logic and queues. |
| Acceptance criteria | Mentors only see assigned cohorts/learners/submissions; revision/rejection always requires actionable feedback/reason; review decisions and attendance corrections are auditable; attendance evidence supports certificate calculations. |
| Testing requirements | Assignment/reviewer policy tests; review transition/attempt tests; attendance bulk-upsert/concurrency tests; mentor scope denial E2E; accessibility tests for rubric scoring and roster controls. |
| Documentation requirements | Mentor handbook, review-SLA escalation process, attendance correction procedure, private-note data-handling policy. |
| Git branch recommendation | `feat/mentor-workflows-*`. |
| Complexity / duration | High / 4 weeks. |

### Phase 9 — Assessments, projects, certificates, portfolios and payment foundation

| Item | Plan |
| --- | --- |
| Objective | Complete the learner outcome loop with defensible assessment, evidence, recognition, and future-ready commercial foundations. |
| Features | Assignment authoring/publishing; draft/submission/upload/finalization; three-attempt policy; rubric/guide version snapshots; projects/milestones/evidence; certificate eligibility, mentor recommendation, admin approval, rendering, verification/revocation; portfolio consent/publication; badges/achievements/leaderboard foundation; pricing plans, cohort prices, immutable payment ledger and disabled Paystack adapter/checkout flag. |
| Dependencies | Phases 2, 6–8; certificate template/signatory; portfolio consent copy; payment decision/vendor configuration. |
| Deliverables | Learning/outcomes/payments modules and workers; assignment/submission/project/certificate/portfolio UI; public verification page; certificate rendering/storage workflow; payment ledger schema and adapter interface. |
| Acceptance criteria | Submission state/attempt limits and rubric history are enforced; certificates require recorded 90% learning, 75% attendance, approved required work, mentor recommendation, and administrator approval (or an audited exception); issued certificates are immutable/verifiable/revocable; public portfolios require explicit consent; checkout remains disabled unless explicitly enabled. |
| Testing requirements | State-machine/transaction/idempotency tests; signed-upload/scan authorization tests; certificate eligibility and public-data-minimization E2E tests; portfolio consent/unpublish tests; payment webhook/ledger idempotency tests; rendering/accessibility/security tests. |
| Documentation requirements | Assessment author/learner guides, grading/revision policy, certificate issuance/revocation runbook, portfolio consent guide, payment ledger/provider integration ADR. |
| Git branch recommendation | `feat/assessments-*`, `feat/outcomes-*`, `feat/payments-foundation-*`; keep financial changes isolated and security-reviewed. |
| Complexity / duration | Very high / 4 weeks. |

### Phase 10 — Communications, calendar and integration delivery

| Item | Plan |
| --- | --- |
| Objective | Deliver reliable, consent-aware fellowship communication and scheduling without coupling external providers to core transactions. |
| Features | Announcements/drafts/scheduling; in-app notifications and preferences; WebSocket notification/message fan-out; email adapter/delivery events; WhatsApp Business Cloud template flow/opt-in/out/moderated replies; conversations/messages/reporting/moderation queue; calendar/RSVP/ICS; Google Meet, Slack, and calendar integration adapters; webhook registration/delivery. |
| Dependencies | Phases 2–5 and 6–9; approved channels/template copy, provider accounts, privacy/moderation policy. |
| Deliverables | Operations/community modules; notification outbox processors, delivery attempt records, DLQ/replay UI/runbook; messaging/calendar/announcement interfaces; integrations settings and webhook API. |
| Acceptance criteria | Recipient scope, consent, quiet hours, deduplication, templates, retries, and delivery history are enforced; external failure preserves the business event and in-app record; direct messages are reportable/moderated with retention/audit controls; WebSocket reconnect recovers via REST. |
| Testing requirements | Outbox/idempotency/retry/DLQ tests; provider webhook signature/replay tests; consent/opt-out/scope tests; message moderation/retention tests; real-time reconnect and calendar timezone E2E tests. |
| Documentation requirements | Channel preference and consent policy, WhatsApp template/opt-out runbook, moderator playbook, provider integration setup guides, webhook contract and queue-replay runbook. |
| Git branch recommendation | `feat/communications-*`, `feat/integrations-*`; provider adapters are independently reviewable. |
| Complexity / duration | Very high / 4 weeks. |

### Phase 11 — Analytics, reports, leaderboards and operational insight

| Item | Plan |
| --- | --- |
| Objective | Provide trustworthy, scoped insight for students, mentors, administrators, and platform operators. |
| Features | Role dashboards; learning/engagement/outcomes analytics; aggregate/materialized metrics; report jobs/exports/signed downloads; leaderboard definitions/results with opt-out; platform health summaries; moderation and queue operational views. |
| Dependencies | Phases 2–10; approved metric definitions, report catalog, and export privacy policy. |
| Deliverables | Analytics/reporting modules and aggregate workers; dashboard feature slices; export lifecycle and freshness metadata; accessible tables/text alternatives for all visualizations. |
| Acceptance criteria | Analytics are tenant/role scoped, define freshness and source metrics, avoid expensive unbounded transactional queries, and do not expose cross-tenant or unapproved personal data; exports require appropriate authorization/re-auth and expire. |
| Testing requirements | Aggregate correctness/recompute tests; export authorization/data-minimization tests; dashboard permission and performance tests; accessible chart/table validation; load tests for representative dashboard/report queries. |
| Documentation requirements | Metric dictionary, report catalog, data freshness/SLA statement, export/privacy procedure, leaderboard privacy rules. |
| Git branch recommendation | `feat/analytics-*`, `feat/reporting-*`. |
| Complexity / duration | High / 4 weeks. |

### Phase 12 — Production hardening and release qualification

| Item | Plan |
| --- | --- |
| Objective | Prove the platform is secure, accessible, resilient, observable, and supportable for a real cohort. |
| Features | Threat modelling; security remediation; dependency/SAST/secret scanning gates; penetration test; load/soak/failure tests; performance profiling; database index/query tuning; accessibility audit; NDPA workflows; backup/restore and disaster exercises; feature-flag rollout/rollback; release candidate stabilization. |
| Dependencies | All intended v1 feature phases; staging environment representative enough for performance and restore testing. |
| Deliverables | Release candidate; risk-treatment log; test evidence; accessibility conformance report; security findings disposition; capacity plan; production readiness review. |
| Acceptance criteria | All P0/P1 security/privacy/accessibility defects are resolved or formally accepted by accountable owners; cross-tenant, authentication, destructive migration, queue failure, provider outage, and restore scenarios pass; performance meets approved SLOs; rollback is rehearsed. |
| Testing requirements | Full regression; API contract; E2E; negative authorization; load/soak; chaos/failure injection for queues/integrations; restore drill; vulnerability/SBOM scan; manual assistive-technology audit. |
| Documentation requirements | Threat model, security/privacy review, SLO/error-budget documentation, incident/rollback/restore runbooks, known-limitations and support guide. |
| Git branch recommendation | `release/1.0.0-rc.*` plus narrowly scoped `fix/*` branches; feature freeze except approved release blockers. |
| Complexity / duration | Very high / 4 weeks. |

### Phase 13 — Pilot, production launch and operational handover

| Item | Plan |
| --- | --- |
| Objective | Launch a controlled Tech Impact Fellowship pilot, verify production behavior, and transition to sustainable operations. |
| Features | Production tenant/academy provisioning; administrator and mentor onboarding; content/certificate/integration configuration; staged cohort enrolment; canary/feature-flag rollout; production monitoring and support triage; post-launch feedback loop. |
| Dependencies | Phase 12 sign-off; approved pilot cohort, operational team, production vendor contracts/secrets, support and incident ownership. |
| Deliverables | Production deployment; go-live checklist/evidence; launch communications; daily pilot health review; hypercare and retrospective; prioritized post-launch backlog. |
| Acceptance criteria | Pilot users complete sign-in/MFA, onboarding, learning, submission/review, attendance, notifications, and certificate verification paths in production; alerts and support escalation operate; no unresolved critical tenant/security defect; business/product/data-protection owners approve go-live. |
| Testing requirements | Production smoke/canary checks, synthetic monitoring, manual role journeys, webhook/provider verification, backup verification, and post-deploy regression. |
| Documentation requirements | Go-live and rollback checklist, on-call/support rota, operations handbook, administrator/mentor/learner guides, incident communications templates, launch retrospective. |
| Git branch recommendation | Tag `v1.0.0`; production hotfixes use `hotfix/*` with immediate back-merge to `main`. |
| Complexity / duration | High / 4 weeks. |

## 5. Sprint breakdown and milestones

| Sprint | Focus | Milestone checkpoint |
| --- | --- | --- |
| 0 | Governance, owners, decisions, backlog | Delivery plan approved |
| 1 | Workspace, CI, app/package bootstraps | Developer foundation usable |
| 2–3 | Data kernel, scope, audit/outbox, observability | Foundation readiness review |
| 4–5 | Identity, MFA, RBAC, memberships | Secure access review |
| 6 | Tenant/platform administration | Tech Impact tenant can be provisioned |
| 7–8 | Shell, UI system, route and profile foundation | Role-aware web foundation accepted |
| 9–10 | Catalogue, curriculum, cohorts, enrolment | Admin can configure a pilot cohort |
| 11–12 | Student learning loop | Learner alpha accepted |
| 13–14 | Mentor reviews and attendance | Mentor alpha accepted |
| 15–16 | Assessments, outcomes, payment foundation | End-to-end academic lifecycle beta |
| 17–18 | Communications and integrations | Operational communications beta |
| 19–20 | Analytics, reporting, moderation insight | Admin/platform beta |
| 21–22 | Hardening and release qualification | Release candidate sign-off |
| 23–24 | Pilot and go-live | Version 1.0 production release |

At each checkpoint, require product acceptance, architecture/security review for changed boundaries, contract and migration review, accessibility evidence, updated runbooks, and an explicit decision to proceed, remediate, or reduce scope.

## 6. Critical path and dependency map

```text
0 Governance
  → 1 Monorepo/CI
    → 2 Data + tenant + observability kernel
      → 3 Identity/RBAC
        ├→ 4 Tenant governance
        ├→ 5 Web shell
        │   → 6 Catalogue/cohorts/enrolment
        │     → 7 Student learning
        │       → 8 Mentor reviews/attendance
        │         → 9 Assessments/outcomes
        │           → 10 Communications/calendar/integrations
        │             → 11 Analytics/reporting
        └──────────────────────────────────────────────→ 12 Hardening
                                                           → 13 Pilot/launch
```

Critical-path protections:

- Do not begin tenant-owned domain migrations before Phase 2 scope, audit, migration, and outbox conventions are accepted.
- Do not expose role portals before Phase 3 authorization and Phase 5 route/cache conventions are proven.
- Do not activate a cohort before its published curriculum snapshot, access rules, roster, and release process are tested.
- Do not issue production certificates before attendance, progress, assignment approvals, eligibility snapshots, and approval audit trails are end-to-end tested.
- Do not activate external channels or checkout before consent, webhook verification, provider failure behavior, and responsible operational ownership exist.

## 7. Risk assessment

| Risk | Likelihood / impact | Mitigation and trigger |
| --- | --- | --- |
| Cross-tenant data exposure | Medium / Critical | Scope-required repositories, guards, serializers, negative tests, cache-key rules; release blocked by any isolation failure. |
| Identity/MFA or privilege compromise | Medium / Critical | OIDC/CSRF/rotation tests, mandatory MFA, re-auth, rate limits, audit/access review; security review before pilot. |
| Unbounded scope and portal-first duplication | High / High | Phase gates, contract-first vertical slices, backlog change control, feature-flagged deferred work; reassess every milestone. |
| Content, rubric, certificate, or policy readiness lags engineering | High / High | Assign content/operations owners in Phase 0; use explicit readiness gates and seeded representative content. |
| External provider delay/failure | Medium / High | Adapter interfaces, in-app fallback, sandbox early, DLQ/retry, feature flags; do not make launch dependent on nonessential channels. |
| Migration/data loss | Low / Critical | Expand/contract migrations, backup/PITR, restore rehearsals, reviewed migration ownership. |
| Deadline peak performance | Medium / High | Early realistic datasets/load tests, indexes, queues/back-pressure, asset CDN; remediate before pilot enrolment. |
| Privacy, moderation, or retention failure | Medium / Critical | Data classification, consent/retention workflows, restricted moderator access, audit, legal-hold process, data-protection review. |
| Inaccessible learning or authoring flow | Medium / High | Accessible component system, continuous automated/manual audits, content accessibility checklist, WCAG gate per phase. |
| Small team schedule pressure | High / High | Protect foundation/critical path, parallelize only independent modules, reduce optional v1 work via feature flags rather than weaken guarantees. |

## 8. Recommended Git and release workflow

Use trunk-based development with protected `main` and short-lived branches. Every branch is linked to a roadmap epic/story, keeps one bounded concern, and is merged behind a passing CI pipeline and required review.

- Branch names: `feat/<module>-<capability>`, `fix/<capability>`, `chore/<tooling>`, `docs/<topic>`, `release/<version>`, and `hotfix/<issue>`.
- Require at least one code review; require module-owner plus security/data review for identity, authorization, tenant scope, migration, payment, public verification, privacy, or integration changes.
- PR checks: lint, formatting, typecheck, unit/component tests, OpenAPI breaking-change checks, contract tests, migration validation, dependency/secret/SAST scans, and relevant E2E/accessibility coverage.
- Use feature flags for incomplete or risky tenant-visible capabilities. Flags are scoped, audited, have owners/expiry dates, and are removed after rollout.
- Cut `release/1.0.0-rc.n` only after the feature freeze. Allow only documented release-blocker fixes, then tag `v1.0.0`. Hotfixes branch from the current production tag and are back-merged immediately.
- Keep commit messages conventional and traceable to work items; do not combine schema changes, unrelated refactors, and new behavior in an unreviewably broad PR.

## 9. Release plan

| Release | Scope and gate |
| --- | --- |
| Internal foundation | Phases 1–4. Engineering-only: developer workflow, tenant kernel, identity and governed provisioning demonstrated. |
| Admin alpha | Phases 5–6. Admins configure academy, fellowship, curriculum, cohort, mentors, and enrolments in staging. |
| Learning/mentor alpha | Phases 7–8. Representative student and mentor journeys work against a seeded cohort. |
| Operational beta | Phases 9–11. Full academic loop, certificate path, communications, reports, and moderated operations tested with limited users. |
| Release candidate | Phase 12. Feature frozen, evidence-based performance/security/accessibility/privacy qualification complete. |
| Version 1.0 pilot/general production | Phase 13. Controlled Tech Impact Fellowship rollout, hypercare, post-launch acceptance. |

## 10. Future roadmap

### Version 1.0 — Fellowship operating platform

Deliver the roadmap's production scope: multi-organization/academy tenancy; identity/MFA/RBAC; curriculum and cohorts; student/mentor/admin/super-admin portals; learning, assignments, review, attendance; certificates and portfolios; announcements, notifications, moderated messaging, calendar; analytics/reporting; adapter foundations for payments and approved integrations; audited, observable, accessible, NDPA-aligned production operations.

Checkout remains disabled by default. SAML, native mobile, public marketing/SEO application work, tenant self-service signup/billing, and separate microservices are out of scope unless an ADR changes this plan.

### Version 2.0 — Scale, commercialisation, and enterprise refinement

- Enable paid cohorts/Paystack checkout only after commercial/legal readiness and a dedicated security review.
- Add SAML when a contracted organization requires it; improve enterprise identity lifecycle and SCIM only after an explicit decision.
- Expand organization branding, custom domains, tenant-scoped configuration and controlled self-service onboarding/billing if the commercial model changes.
- Add mature analytics warehouse/export integrations, read replicas, aggregate pipelines, and search where measured scale needs justify them.
- Extend mobile/PWA capabilities and opt-in push notifications; add localization based on validated user needs.
- Introduce elective/micro-credential/catalogue extensions, richer portfolio/employability workflows, and controlled AI-assisted assessment support with human approval and bias/privacy controls.

### Version 3.0 — Platform ecosystem and selective service extraction

- Offer partner/third-party integration ecosystem with governed OAuth scopes, webhooks, and developer documentation.
- Support enterprise tenant routing to dedicated database/region/key/deployment where contracted, while preserving organization-scoped API semantics.
- Extract independently owned/scaled services only when production metrics demonstrate a domain bottleneck or release/ownership need; mirror existing outbox events to a durable event bus first.
- Add advanced data governance, cross-region resilience where required, approved predictive insights, and broader federation/payment capabilities under new ADRs and privacy/security assessment.

## 11. Completion definition for every implementation phase

A phase is complete only when its planned deliverables and acceptance criteria are met; code is merged; API/database/UI changes are documented; test evidence passes in CI; observability and audit behavior exist; accessibility and security requirements are reviewed; operational runbooks are current; migrations have a rollback/compatibility plan; and product/engineering owners approve the milestone. A phase is not complete merely because its user interface is visible in staging.

No application code or feature implementation is created by this roadmap phase.
