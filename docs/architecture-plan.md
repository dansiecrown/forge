# Project Forge — Architecture & Delivery Plan

## Product boundary

Project Forge is a multi-tenant, fellowship-first learning platform. An **organization** owns one or more academies; academies operate programmes/courses and cohorts. A user can have different roles in different organizations or academies. Organizations are provisioned by a platform super-admin in v1. The initial release should serve Tech Impact Fellowship, while tenancy and authorization must be first-class from day one.

### Core terms

| Term | Meaning |
| --- | --- |
| Organization | A customer/fellowship operator and tenant boundary. |
| Academy | A division or learning brand inside an organization. |
| Programme | A reusable curriculum, e.g. Frontend Development. |
| Cohort | A time-bounded run of a programme with enrolled students and mentors. |
| Module / Week | Curriculum grouping; weekly content is released according to schedule. |
| Enrollment | A student's membership and state in a cohort. |

## Recommended architecture

Start as a **modular monolith**: a Vite React SPA and a NestJS API, with PostgreSQL/Prisma. It is simpler to ship and operate than microservices, while Nest modules keep bounded contexts separable for future extraction.

```text
Browser → Vercel React SPA → NestJS API → PostgreSQL
                             ├─ Cloudinary (uploads)
                             ├─ Redis + BullMQ (jobs, queues, cache)
                             └─ Email/push provider
```

Use REST with OpenAPI as the public contract. Use WebSockets only for real-time notifications and direct-message delivery. Background jobs send notifications, generate certificates, calculate aggregates, and process file uploads.

### Backend modules

- `identity`: authentication, sessions, password reset, invitations.
- `organizations`: organizations, academies, memberships, roles and policies.
- `catalog`: programmes, curricula, modules, weeks, lessons and resources.
- `cohorts`: cohorts, enrollment, mentor assignment, schedules.
- `learning`: releases, progress, assignments, submissions, reviews and grades.
- `community`: announcements, discussions, conversations and messages.
- `operations`: attendance, huddles, calendar and notifications.
- `outcomes`: certificates, portfolios, leaderboards and reporting.
- `platform`: audit log, files, feature flags and system settings.

Keep controllers thin; each module has DTOs, application services/use-cases, domain types/policies, and Prisma repositories. Enforce tenant scope in guards/repositories—not merely in the UI.

## Repository layout

```text
forge/
  apps/
    web/                    # Vite + React + TypeScript
    api/                    # NestJS application
  packages/
    ui/                     # shared shadcn-based components
    api-contract/           # generated OpenAPI client/types
    config/                 # eslint, tsconfig, tailwind presets
  docs/
    architecture-plan.md
  infra/                    # Docker, deployment and database assets
```

Frontend features should be grouped by domain (`features/learning`, `features/cohorts`) with routes, API hooks, components and schemas colocated. Use TanStack Query for server state, React Hook Form + Zod for forms, and a small client store only for transient UI/session state. Build accessible, mobile-first primitives with shadcn/ui and Tailwind.

## Data model

All tenant-owned tables include `organization_id`; records additionally constrained to an academy where applicable. IDs use UUIDs, timestamps are UTC, and mutable critical records carry `updated_at`. Soft-delete only when legally and operationally justified; audit destructive administrative actions.

```text
Organization 1─* Academy 1─* Programme 1─* CurriculumModule 1─* Week 1─* Lesson
       │              │             │                         ├─* Resource
       │              │             └─* Cohort ─* MentorAssignment
       │              │                   └─* Enrollment *─1 User
       │              └─* Membership *─1 User
       └─* Announcement

Week 1─* Assignment 1─* Submission *─1 Enrollment
Submission 1─* Review
Enrollment 1─* Progress
Cohort 1─* Huddle 1─* Attendance
User 1─* ConversationParticipant *─1 Conversation 1─* Message
Enrollment 1─* Certificate / PortfolioProject
```

Essential entities and notable fields:

- `User(id, email, name, avatar_url, status, last_login_at)`.
- `Organization(id, name, slug, status, settings)` and `Academy(id, organization_id, name, slug)`.
- `Membership(id, user_id, organization_id, academy_id?, role, status)`. Roles: `SUPER_ADMIN`, `ORG_ADMIN`, `ACADEMY_ADMIN`, `MENTOR`, `STUDENT`; permissions are policy-based, not checks scattered through code.
- `Programme(id, academy_id, title, slug, description, duration_weeks, status)`; `CurriculumModule`, `Week(week_number, release_at)`, `Lesson(content_type, content)`, `Resource(url, provider, estimated_minutes)`.
- `Cohort(id, programme_id, name, starts_at, ends_at, timezone, status)` and `Enrollment(id, cohort_id, student_id, status, joined_at, completed_at)`. A student cannot have an active enrollment while another enrollment is pending, active, or awaiting completion review; enforce this in a transaction and with a partial unique database index where supported.
- `Assignment(id, week_id, title, instructions, due_at, rubric, max_score)`; `Submission(id, assignment_id, enrollment_id, content, submitted_at, status)`; `Review(id, submission_id, reviewer_id, score, feedback, rubric_scores)`.
- `LearningProgress(id, enrollment_id, lesson_id, status, completed_at)`; calculate cohort/course progress from this source of truth.
- `Huddle`, `Attendance`, `Announcement`, `Notification`, `Conversation`, `Message`, `Certificate`, `PortfolioProject`, `DiscussionThread`, `DiscussionPost`, `AuditLog`, and `FileAsset`.

Add unique constraints for slugs within their parent scope, `(cohort_id, student_id)` enrollment, `(enrollment_id, lesson_id)` progress, and `(assignment_id, enrollment_id)` submission policy as appropriate. Index every foreign key plus common scoped dashboard queries.

## API shape

Prefix endpoints with `/api/v1`; authenticate with short-lived access JWTs and rotated refresh tokens stored in secure, HttpOnly cookies. Example resource groups:

- `/auth`, `/me`, `/organizations`, `/academies`, `/memberships`
- `/programmes`, `/modules`, `/weeks`, `/lessons`, `/resources`
- `/cohorts`, `/enrollments`, `/mentor-assignments`, `/huddles`, `/attendance`
- `/assignments`, `/submissions`, `/reviews`, `/progress`
- `/announcements`, `/discussions`, `/conversations`, `/notifications`
- `/certificates`, `/portfolio`, `/analytics`, `/reports`

Use cursor pagination, consistent error envelopes (`code`, `message`, `details`, `requestId`), Zod/class-validator request validation, and OpenAPI-generated client types. Make publish, grade, certificate issue, and enrollment approval operations auditable.

## Security and operations

- Argon2 password hashing; email verification, reset-token expiry, session revocation, rate limiting, and mandatory MFA for every administrator and mentor. Support email/password, Google, Microsoft, and SSO through an identity-provider abstraction; define SSO protocol and enterprise setup policy before enabling it.
- Server-side authorization for every resource; tenant filters are mandatory. Validate Cloudinary upload signatures, file type/size, and virus-scan if direct uploads are allowed.
- CSP, CORS allowlist, CSRF protection for cookie refresh endpoints, structured logs with request IDs, error monitoring, encrypted secrets, daily backups, and migration rollback policy.
- WCAG 2.2 AA target, keyboard support, semantic forms, visible focus states, reduced motion and responsive layouts.

## MVP milestones

1. **Foundation** — monorepo, CI, environments, API contract, PostgreSQL/Prisma, identity, tenant-aware RBAC, audit log.
2. **Learning operations** — academies, programmes, curriculum builder, cohorts, enrollment approval, mentor assignment, weekly release scheduling.
3. **Student learning loop** — dashboard, lessons/resources, progress, assignments/submissions, mentor review and feedback.
4. **Fellowship delivery** — huddles, attendance, announcements, calendar, in-app/email notifications.
5. **Outcomes and administration** — role dashboards, core analytics, certificate generation/verification, portfolio publishing.
6. **Community and optimisation** — discussions, messaging, leaderboard, reporting exports, feature flags, performance and security hardening.

Each milestone requires schema migrations, authorization tests, API integration tests, accessible UI coverage, observability, and acceptance criteria before the next begins.

## Decisions required before implementation

1. Is an organization self-service (tenant signup/billing) in v1, or are organizations provisioned only by a platform super-admin?
2. What is the definitive academic model: can a student join multiple concurrent cohorts, and can a programme have multiple academy owners?
3. Which identity providers are required (email/password only, Google, Microsoft, SSO), and is MFA mandatory for administrators?
4. How are grades calculated and released—points, rubric-only, pass/fail, mentor approval, and resubmission limits?
5. Which communication channels and vendors are required (email, WhatsApp, SMS, Zoom/Google Meet, Slack), and are direct messages moderated/retained?
6. What are the certificate completion rules, verification URL requirements, and legal/privacy retention requirements?
7. What regional requirements apply to data residency, currency/payment, timezone, privacy law, and accessibility?

Until these are answered, the proposed defaults are: platform-provisioned tenants, concurrent enrollments allowed, email/password plus Google sign-in, rubric + numeric grading, in-app/email notifications, and public certificate verification by opaque code.

## Decisions resolved — v1 baseline

The questions above are now superseded by the following confirmed direction:

- **Tenant operations:** platform super-admins provision organizations; there is no public organization signup or billing portal in v1.
- **Academic progression:** a student must complete their current cohort before beginning another. Programmes belong to one academy in v1; reuse across academies is done by copying/versioning a programme, not multi-owner editing.
- **Identity:** email/password, Google, Microsoft, and enterprise SSO are supported. MFA is mandatory for administrators and mentors. Recommend making it mandatory for all enrolled learners in a later release, using TOTP authenticator apps with recovery codes.
- **Assessment:** mentor approval is the v1 assessment workflow. Store a versioned grading guide and rubric with each assignment, and use statuses `submitted`, `revision_required`, `approved`, and `rejected`. This is the foundation for future AI-assisted comparisons against mentor-provided guides.
- **Communication:** email, WhatsApp, Google Meet, and Slack integrations are in scope. Direct messages must be reportable and moderated, with a review queue, moderator actions, retention policy, and immutable audit records.
- **Commercial model:** courses are free by default. Add `PricingPlan`, `CohortPrice`, and `Payment` ledger entities from the outset, with NGN as the only v1 currency and a payment-provider adapter. Paystack is the recommended initial provider; checkout remains disabled unless a cohort is explicitly paid.
- **Regional defaults:** use `Africa/Lagos` as the organization and cohort timezone, store timestamps in UTC, display WAT to users, target WCAG 2.2 AA, and apply the Nigeria Data Protection Act (NDPA): privacy notice, lawful/clear consent where needed, data minimisation, access/correction/deletion workflow, retention schedule, and a responsible data-protection lead.

## Recommended certificate policy

1. Certificates require an approved enrollment, at least 90% of required lessons completed, attendance at 75% or more of huddles, and mentor approval of every required assignment/project.
2. A mentor recommends issuance and an administrator approves it. Certificates are immutable and have a unique opaque verification code, issue date, programme, cohort, learner name, and signatory.
3. Publish a public verification page at `/verify/:code` with the minimum information needed to validate authenticity. Certificates can be revoked, with a visible status and an audited reason.
4. Retain certificate, enrollment, assessment decision, and audit records for seven years after issue. Retain raw submissions and direct messages for two years after cohort completion, then anonymize or delete them unless a legal hold, active dispute, or separate consent requires longer retention.
5. Portfolio publishing requires separate consent; a learner can retain a verifiable certificate without maintaining a public portfolio.

## Final v1 operating decisions

- **Certificates:** adopt the certificate eligibility and retention policy above: 90% lesson completion, 75% huddle attendance, all required work mentor-approved, and a seven-year certificate/audit retention period.
- **WhatsApp:** use the WhatsApp Business Cloud API directly. Send approved template notifications and accept replies only into the moderated message queue; configure opt-in/opt-out, escalation, and retention rules before launch.
- **SSO:** support OpenID Connect (OIDC) in v1. Defer SAML until a contracted organization requires it.
- **Assessment service level:** permit two revisions after the first submission (three submissions total) and require mentor review within 72 hours on business days. An administrator may grant a documented exception.
- **MFA:** require TOTP MFA for administrators and mentors at first sign-in; require it for students when they begin a cohort, with recovery codes and a supervised recovery workflow.
