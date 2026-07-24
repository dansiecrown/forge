# Project Forge — Database Design Specification

**Status:** Schema-design source of truth; implementation intentionally deferred  
**Database:** PostgreSQL (managed, multi-AZ in production)  
**Identifier policy:** UUID primary keys; all timestamps stored as `timestamptz` in UTC

## 1. Data architecture principles

Project Forge is a multi-tenant fellowship platform. An **organization** is the hard tenant boundary; an **academy** is a division within an organization; a **fellowship** is a reusable learning programme; a **cohort** is a time-bounded delivery of a fellowship. All tenant-owned records carry `organization_id`, even when it can be inferred through a parent. This deliberate redundancy enables safe scope enforcement, indexing, partitioning, and auditability.

Use plural, `snake_case` PostgreSQL table names (`users`, `roles`, `memberships`, …); UUID primary keys named `id`; foreign keys named `<entity>_id`; enum/check-constrained workflow states; `jsonb` only for genuinely flexible, versioned or provider-specific data—not core relational facts. The application must set an approved tenant scope before every data access. Database constraints defend invariants; application policy supplies contextual authorization.

> **Naming convention note (2026-07-24):** this was originally written as "singular" table names, but the Identity & Access Control implementation used plural names throughout (`users`, `roles`, `memberships`, `permissions`, …) — including, inconsistently, in this very document's own `created_by`/`updated_by` FK reference below (`users.id`). Per the Architecture Lock milestone's review, plural is adopted as the approved standard rather than renaming 15 live, migrated tables for a cosmetic convention with no functional impact — see `docs/adr/0003-identity-and-access-control-foundation.md`.

### Standard columns

Every mutable tenant record has: `id`, `organization_id`, `created_at`, `updated_at`, `created_by`, `updated_by`, and `deleted_at` where soft delete is permitted. `created_by`/`updated_by` reference `users.id`, nullable only for data migration, automated jobs, or system provisioning; those writes also use a `source`/audit event. Foreign-key timestamps are not edited in place. `deleted_at` is nullable and means logically deleted; default queries exclude it.

Use an integer `version` column on concurrently edited or legally meaningful mutable entities (configuration, curriculum, fellowship/course, assignment, review policy, certificate template, portfolio, role/permission mappings). It is incremented by optimistic-concurrency writes. Immutable records (audit logs, message delivery attempts, certificate issue evidence) do not need a mutable version.

All user-entered text is normalized and size-limited before storage; unique identity fields use case-insensitive canonical values (PostgreSQL `citext` or canonical lower-cased column). Timezone identifiers are IANA strings; display defaults to `Africa/Lagos` but timestamps remain UTC.

## 2. Tenant and identity model

### Organization

- **Purpose:** top-level SaaS tenant, data-isolation and billing/governance boundary.
- **Primary key / foreign keys:** `id`; creator/updater user references. No tenant parent.
- **Required fields:** `name`, `slug`, `status` (`provisioning|active|suspended|archived`), `default_timezone`, `data_region`, `settings_version`.
- **Optional fields:** legal name, logo asset ID, support contact, custom domain, subscription/plan reference, retention-policy override, metadata.
- **Relationships:** one-to-many academies, memberships, fellowship courses, notifications, audit logs, settings and integrations.
- **Constraints/validation:** globally unique normalized slug and custom domain; active status required before end-user access; timezone must be valid IANA; no hard delete after provisioning.
- **Indexes:** unique `(slug)`; unique nullable `(custom_domain)`; `(status, created_at)`.
- **Cascade / soft delete / lifecycle:** no cascading deletion of tenant data. Suspend blocks sessions/writes by policy; archive is read-only; retain then delete/anonymize only through an approved tenant offboarding workflow. `deleted_at` is normally unused; use status.

### Academy

- **Purpose:** organization-owned learning brand/division that owns fellowship programmes and operational settings.
- **Primary key / foreign keys:** `id`; required `organization_id`; optional logo asset; audit user references.
- **Required fields:** `name`, `slug`, `status`, `timezone`.
- **Optional fields:** description, branding JSON, contact details, settings override.
- **Relationships:** belongs to one organization; one-to-many fellowships, cohorts (indirectly through fellowship), academy-scoped memberships and settings.
- **Constraints/validation:** unique active slug within organization; academy organization must equal parent data organization; valid timezone.
- **Indexes:** unique `(organization_id, slug) WHERE deleted_at IS NULL`; `(organization_id, status)`.
- **Cascade / soft delete / lifecycle:** cannot delete while active fellowship/cohort records exist; archive then remove from selectors; retain history. No parent cascade.

### User

- **Purpose:** global human identity shared across organizations.
- **Primary key / foreign keys:** `id`; optional avatar `file_asset_id`; audit self-references allowed only for automated provenance.
- **Required fields:** `email_canonical`, `display_name`, `status` (`invited|active|suspended|deactivated`), `email_verified_at` state, `locale`, `timezone`.
- **Optional fields:** given/family name, avatar, phone (encrypted/minimized), bio, last_login_at, privacy preferences, deletion-request metadata.
- **Relationships:** one-to-many memberships, sessions, external identities, MFA credentials, submissions, messages, audit actions; one-to-one optional student and mentor profile; optional admin profile only when operational attributes are needed.
- **Constraints/validation:** globally unique email canonical; email format/length validation; display-name length and Unicode normalization; do not use email as primary key; a deactivated identity cannot authenticate.
- **Indexes:** unique `(email_canonical)`; `(status, last_login_at)`; optional trigram index on normalized display name for directory search.
- **Cascade / soft delete / lifecycle:** never cascade delete authored history. Deactivate/revoke sessions first; pseudonymize/anonymize subject to retention/legal hold. `deleted_at` means personal profile unavailable, not that required audit/certificate evidence vanished.

### Identity and session support tables

`external_identities` maps user to provider (`password|google|microsoft|oidc`), provider subject, encrypted provider metadata and verified time; unique `(provider, provider_subject)`. `password_credentials` holds only Argon2id hash, changed timestamp, failed-attempt/rate-control state—never plaintext or reversible passwords. `auth_sessions` stores hashed refresh-token family, device metadata, issued/expiry/revoked timestamps and rotation lineage. `mfa_factors` stores encrypted TOTP secret or public credential metadata, verified/disabled times; `recovery_codes` store one-way hashes and use timestamps. These tables are identity-global, audited, and deleted/retained under security policy rather than normal tenant soft deletion.

## 3. Authorization and role inheritance

### Role

- **Purpose:** named bundle of permissions. System roles: `SUPER_ADMIN`, `ORG_ADMIN`, `ACADEMY_ADMIN`, `MENTOR`, `STUDENT`; custom roles are organization-scoped future capability.
- **Primary key / foreign keys:** `id`; nullable `organization_id` for platform/system role, otherwise tenant role; creator/updater references.
- **Required fields:** `key`, `name`, `scope_type` (`platform|organization|academy`), `is_system`, `status`, `version`.
- **Optional fields:** description, hierarchy_rank, metadata.
- **Relationships:** many-to-many permissions through `role_permissions`; many-to-many users/roles through `memberships` or `membership_roles`.
- **Constraints/validation:** unique system key globally; unique custom key per organization; system role definitions cannot be silently edited; hierarchy rank does not grant permissions by itself.
- **Indexes:** unique `(organization_id, key) WHERE deleted_at IS NULL`; `(scope_type, status)`.
- **Cascade / lifecycle:** no hard deletion when assigned; deactivate/replace role, preserve historical membership/audit snapshots.

### Permission

- **Purpose:** atomic authorization capability, e.g. `submission.review`, `certificate.approve`.
- **Primary key / foreign keys:** `id`; no tenant parent in v1; audit references.
- **Required fields:** `key`, `resource`, `action`, `scope_capability`, `status`.
- **Optional fields:** description, risk level, deprecation date.
- **Relationships:** many-to-many roles through `role_permissions`.
- **Constraints/validation:** globally unique stable key; resource/action combination unique; deletion prohibited when assigned.
- **Indexes:** unique `(key)` and `(resource, action)`.
- **Lifecycle:** permissions are versioned catalogue entries; deprecate and migrate assignments rather than reuse meaning.

### Membership and role join tables

`memberships` is the tenant access anchor: `id`, `organization_id`, `user_id`, optional `academy_id`, `status`, invited/joined/ended timestamps, and audit columns. Enforce unique active membership per `(organization_id, user_id, academy_id)` with a normalized sentinel or partial unique index. `membership_roles` joins membership and role with grant/revoke timestamps and granter; unique active `(membership_id, role_id)`. `role_permissions` joins role and permission and records grant provenance; unique `(role_id, permission_id)`. Every joined role must be compatible with membership/role scope. Do not store a comma-separated role list on users.

### Student, Mentor and Admin profiles

These are **one-to-one optional role profiles**, not subclasses of `users` and not the authority for permissions. A user becomes a student/mentor/admin through membership roles; profiles hold domain attributes only.

| Entity | Purpose and fields | Relationships, constraints, lifecycle/indexes |
| --- | --- | --- |
| Student | learner-specific record: `user_id`, `organization_id`, learner number, onboarding status, employment goals, accessibility/accommodation flag/reference, consent timestamps, emergency-contact reference encrypted if collected | unique active `(organization_id, user_id)`; one user can be a student in several organizations; links to enrolments, portfolio and achievements. Index `(organization_id, learner_number)` unique nullable, onboarding status. Never expose accommodation/contact details in general serializers; soft delete with user/retention workflow. |
| Mentor | coaching-specific record: `user_id`, `organization_id`, specialization/tags, capacity, availability profile, verification status, bio, contact preference | unique active `(organization_id, user_id)`; joins cohort mentor assignments and reviews. Capacity is advisory, not an authorization source. Index `(organization_id, verification_status)` and searchable specialties. Deactivate, retain historical reviews. |
| Admin | optional operational profile: `user_id`, `organization_id`, department, support/escalation contact, verified_at | unique active `(organization_id, user_id)`; role remains membership-based. Index `(organization_id, verified_at)`. Used only when real operational data is required; otherwise omit record. |

## 4. Programme, cohort and learning entities

The requested term **Fellowship** is the programme-level business entity. The architecture’s existing `Programme` maps to `fellowships`; a `courses` table is a pedagogical course/unit within a fellowship. This separates a 6–9 month fellowship from an individual course and permits future multi-course programmes.

### Fellowship

- **Purpose:** reusable academy-owned fellowship programme (e.g. Tech Impact Frontend Development), its progression and completion policy.
- **Primary key / foreign keys:** `id`; required `organization_id`, `academy_id`; optional owner/admin user.
- **Required fields:** `title`, `slug`, `status` (`draft|published|retired`), `duration_weeks`, `curriculum_version`, `completion_policy_version`.
- **Optional fields:** summary, description, cover asset, outcomes, catalogue visibility, default capacity, pricing policy reference.
- **Relationships:** one academy to many fellowships; one fellowship to many courses and cohorts; one-to-many version records.
- **Constraints/validation:** unique slug per academy; published fellowship has a valid published curriculum and completion policy; duration within product policy; its academy belongs to same organization.
- **Indexes:** unique `(organization_id, academy_id, slug) WHERE deleted_at IS NULL`; `(academy_id, status)`; full-text/trigram title search.
- **Cascade / lifecycle:** never delete with cohorts; retire prevents new cohort creation; curriculum version snapshots preserve historical delivery.

### Course

- **Purpose:** ordered learning unit within a fellowship; permits one or multiple courses per programme.
- **Primary key / foreign keys:** `id`; required organization, academy, fellowship IDs; optional cover asset.
- **Required fields:** `title`, `slug`, `sequence`, `status`, `version`.
- **Optional fields:** description, estimated_hours, outcomes, prerequisite course ID.
- **Relationships:** belongs to fellowship; one-to-many modules; cohort curriculum snapshots reference published version.
- **Constraints/validation:** unique sequence and slug within fellowship/version; prerequisite must share fellowship and cannot form cycle; published course immutable except through new version.
- **Indexes:** unique `(fellowship_id, sequence) WHERE deleted_at IS NULL`; unique `(fellowship_id, slug) WHERE deleted_at IS NULL`; `(organization_id, status)`.
- **Lifecycle:** draft → published → retired; archive/soft delete only if not included in delivered snapshots.

### Module

- **Purpose:** ordered course grouping of weeks/learning outcomes.
- **Primary key / foreign keys:** `id`; required organization, fellowship, course IDs.
- **Required fields:** `title`, `sequence`, `status`, `version`.
- **Optional fields:** description, outcomes, estimated_hours.
- **Relationships:** belongs to course; one-to-many weeks.
- **Constraints/validation:** unique sequence per course/version; parent integrity and same tenant.
- **Indexes:** unique `(course_id, sequence) WHERE deleted_at IS NULL`; `(organization_id, course_id)`.
- **Lifecycle:** published modules version with their parent curriculum; soft-delete drafts only.

### Week

- **Purpose:** release/scheduling unit for a module and cohort delivery.
- **Primary key / foreign keys:** `id`; organization, fellowship, course, module; optional cohort snapshot ID.
- **Required fields:** `week_number`, `title`, `sequence`, `release_rule`, `status`, `version`.
- **Optional fields:** description, outcomes, estimated_hours, release_at, due-window configuration.
- **Relationships:** belongs to module; one-to-many lessons, resources and assignments; cohort-specific release records may override availability without mutating curriculum.
- **Constraints/validation:** unique week number and sequence within course curriculum version; release date/time must be timezone-aware; no content edit of released snapshot.
- **Indexes:** unique `(course_id, week_number) WHERE deleted_at IS NULL`; `(organization_id, release_at)`; `(module_id, sequence)`.
- **Lifecycle:** draft/published; a `cohort_week_release` join records actual cohort release, lock/release/override metadata and preserves history.

### Lesson

- **Purpose:** one completable learning activity/content item.
- **Primary key / foreign keys:** `id`; organization, week; optional author, asset.
- **Required fields:** `title`, `sequence`, `content_type`, `status`, `version`.
- **Optional fields:** rich content, external URL, estimated_minutes, transcript, captions asset, content metadata.
- **Relationships:** belongs to week; one-to-many learning resources; many-to-many enrolments via `learning_progress`.
- **Constraints/validation:** content type controls allowed payload; external URL must be validated/allowlisted; published media lesson requires captions/transcript policy where applicable; unique sequence per week.
- **Indexes:** unique `(week_id, sequence) WHERE deleted_at IS NULL`; `(organization_id, week_id, status)`.
- **Lifecycle:** versioned published content; old version remains available to delivered cohorts via snapshot mapping.

### Learning Resource

- **Purpose:** curated supporting material (Udemy, YouTube, document, article, exercise, file).
- **Primary key / foreign keys:** `id`; organization, week; optional lesson, file asset, author.
- **Required fields:** `title`, `resource_type`, `sequence`, `status`.
- **Optional fields:** URL, provider, estimated_minutes, author/source, access notes, accessibility notes, metadata.
- **Relationships:** belongs to week and optionally lesson; references optional private asset.
- **Constraints/validation:** exactly one valid delivery source appropriate to type (URL or asset/content); validated URL and provider; unique sequence in parent context.
- **Indexes:** `(week_id, sequence)`; `(organization_id, resource_type, status)`; full-text title/provider search.
- **Lifecycle:** soft delete hides from future navigation; snapshot/release record keeps resource history for delivered cohort.

### Assignment

- **Purpose:** assessable unit of work with a versioned brief, rubric and policy.
- **Primary key / foreign keys:** `id`; organization, fellowship/course/week; optional author and grading-guide asset.
- **Required fields:** `title`, `instructions`, `status`, `due_at`, `max_attempts`, `rubric_version`, `version`.
- **Optional fields:** max_score, pass criteria, submission types, late policy, feedback SLA, example links, required flag.
- **Relationships:** belongs to week; one-to-many assignment versions and submissions; links to projects when work is project-based.
- **Constraints/validation:** max attempts defaults to 3 and is positive; due date after cohort release; rubric must have weighted/validated criterion set; published assignment changes create version; same tenant chain required.
- **Indexes:** `(organization_id, status, due_at)`; `(week_id, status)`; `(cohort_id, due_at)` for cohort assignment availability; full-text title.
- **Lifecycle:** draft → published → closed/retired; assignment version/snapshot is attached to each submission so later edits never change past assessment meaning.

### Submission

- **Purpose:** learner attempt and evidence for an assignment.
- **Primary key / foreign keys:** `id`; organization, assignment, cohort, enrollment, student user; optional current reviewer/mentor.
- **Required fields:** `attempt_number`, `status` (`draft|submitted|revision_required|approved|rejected|withdrawn`), `content_version`, `created_by`.
- **Optional fields:** text response, repository URL, demo URL, submitted_at, withdrawn_at, revision_due_at, checksum, reviewer notes reference.
- **Relationships:** belongs to assignment and enrolment; one-to-many `submission_files`, `reviews`, status-history events; optional project association.
- **Constraints/validation:** unique `(assignment_id, enrollment_id, attempt_number)`; attempt ≤ assignment max; final submission must include permitted evidence; transition rules enforced transactionally; enrollment must belong to assignment cohort; reviewer must be assigned/authorized mentor.
- **Indexes:** unique above; `(organization_id, status, submitted_at)` for review queues; `(reviewer_id, status, submitted_at)`; `(enrollment_id, assignment_id)`.
- **Cascade / lifecycle:** never cascade delete submitted evidence; withdrawal is state, not deletion; drafts may be purged by policy after abandonment; approved/rejected records retained with audit history.

### Project

- **Purpose:** substantial practical portfolio work, optionally connected to assignments and milestones.
- **Primary key / foreign keys:** `id`; organization, fellowship/cohort, enrollment/student; optional assignment and mentor.
- **Required fields:** `title`, `status`, `visibility`, `version`.
- **Optional fields:** description, repository/demo URLs, cover asset, start/due/completed dates, skills/tags, milestone configuration.
- **Relationships:** one project belongs to a learner enrolment; one-to-many milestones/evidence; optional one-to-many related submissions; may be published through portfolio items.
- **Constraints/validation:** project cohort must match enrolment; visibility defaults private; public visibility requires portfolio consent; URLs validated.
- **Indexes:** `(organization_id, cohort_id, status)`; `(enrollment_id, status)`; public `(visibility, published_at)` where non-deleted.
- **Lifecycle:** draft → active → submitted/approved/archived; soft deletion only before approval/publishing; otherwise unpublish/archive with historic links retained.

### Learning progress and enrollment support tables

`enrollments` joins student profile/user to cohort with status (`invited|active|paused|completed|withdrawn|awaiting_completion_review`), joined/completed dates, completion decision and version. Enforce unique `(cohort_id, student_user_id)`, and the v1 one-active-progression rule with a partial unique constraint across active/pending cohort states. `learning_progress` joins enrollment and lesson, storing status, first/last engagement, completed timestamp, version; unique `(enrollment_id, lesson_id)`. `reviews` are append-only mentor assessment decisions: submission, reviewer, rubric-score snapshot, feedback, decision, decided time, version/revision of prior review; enforce authorized reviewer and one active final decision per submission. `submission_files`, `project_milestones`, and `project_evidence` are explicit child tables, never JSON lists, and inherit organization scope.

## 5. Fellowship operations and communications

### Cohort

- **Purpose:** time-bounded delivery run of a fellowship with its own people, schedule and curriculum snapshot.
- **Primary key / foreign keys:** `id`; organization, academy, fellowship; optional primary admin.
- **Required fields:** `name`, `slug`, `status` (`draft|enrolling|active|paused|completed|archived`), `starts_at`, `ends_at`, `timezone`, `capacity`, `curriculum_version`.
- **Optional fields:** description, enrollment deadline, meeting policy, price policy, completion rules override.
- **Relationships:** belongs to fellowship; one-to-many enrollments, mentor assignments, huddles, attendance, cohort releases, announcements, calendar events.
- **Constraints/validation:** end after start; timezone valid; capacity nonnegative; unique slug within academy; published/active cohort points to immutable curriculum version; active cohort accepts only valid enrolled learner status.
- **Indexes:** unique `(academy_id, slug) WHERE deleted_at IS NULL`; `(organization_id, status, starts_at)`; `(fellowship_id, status)`.
- **Cascade / lifecycle:** never hard delete after enrollment; pause/complete/archived states preserve historic learning; no cascade to people/work.

### Mentor Huddle

- **Purpose:** scheduled mentor-led meeting/session for a cohort.
- **Primary key / foreign keys:** `id`; organization, cohort, primary mentor, optional calendar event.
- **Required fields:** `title`, `starts_at`, `ends_at`, `status`, `meeting_type`.
- **Optional fields:** agenda, joining URL/provider reference, recording asset, notes, recurrence rule, capacity.
- **Relationships:** belongs to cohort; one-to-many attendance records; linked one-to-one/one-to-many calendar events through canonical event reference.
- **Constraints/validation:** end after start; mentor must be authorized/assigned to cohort; joining URL encrypted/protected if private; recurrence expansion avoids duplicate conflicts.
- **Indexes:** `(cohort_id, starts_at)`; `(organization_id, starts_at, status)`; `(mentor_id, starts_at)`.
- **Lifecycle:** scheduled → live → completed/cancelled; cancellation retains attendance/history; soft delete only unannounced drafts.

### Attendance

- **Purpose:** per-enrolment attendance evidence for a huddle and certificate eligibility.
- **Primary key / foreign keys:** `id`; organization, huddle, cohort, enrollment, recorded_by mentor/admin.
- **Required fields:** `status` (`present|late|absent|excused`), `recorded_at`.
- **Optional fields:** arrival/departure, excused reason (restricted), notes, source (`manual|integration`).
- **Relationships:** belongs to huddle and enrollment; cohort IDs must agree.
- **Constraints/validation:** unique `(huddle_id, enrollment_id)`; cannot record before membership valid; status transitions/version records required after session completion.
- **Indexes:** unique above; `(organization_id, enrollment_id, status)`; `(cohort_id, status)`.
- **Lifecycle:** attendance is retained/adjusted with history, not soft-deleted; corrections produce audit event and prior-value snapshot.

### Announcement

- **Purpose:** audited broadcast to a selected tenant/academy/cohort audience.
- **Primary key / foreign keys:** `id`; organization, optional academy/cohort, author; optional scheduled calendar event.
- **Required fields:** `title`, `body`, `status` (`draft|scheduled|published|cancelled|archived`), `audience_type`, `version`.
- **Optional fields:** publish_at, expiry_at, attachments, channel preferences, pinned flag.
- **Relationships:** belongs to scope; one-to-many recipients/delivery records and notification events.
- **Constraints/validation:** selected scope must be a descendant of organization; publish timestamp required when scheduled; author authorized for scope; sanitize rich content.
- **Indexes:** `(organization_id, status, publish_at)`; `(cohort_id, published_at)`; full-text title/body search restricted by scope.
- **Lifecycle:** drafts soft-deletable; published content archived/cancelled with immutable delivery history.

### Notification

- **Purpose:** persisted user-visible event and delivery state, not the business event itself.
- **Primary key / foreign keys:** `id`; organization, recipient user/membership, optional actor, source entity polymorphic reference, notification event/outbox ID.
- **Required fields:** `type`, `title`, `body`, `channel`, `status`, `created_at`.
- **Optional fields:** deep link, read_at, delivered_at, provider message ID, failure reason, payload JSON, priority.
- **Relationships:** belongs to recipient and organization; many notifications can derive from one domain event; channel attempts child table.
- **Constraints/validation:** dedupe unique `(recipient_user_id, event_id, channel)`; payload contains no secrets; recipient must have valid scope/consent.
- **Indexes:** `(recipient_user_id, read_at, created_at DESC)`; `(organization_id, status, created_at)`; `(event_id)`.
- **Lifecycle:** unread → read/archived; retain according to communication policy, then delete/aggregate; delivery attempts retained longer for operations/audit.

### Conversation

- **Purpose:** moderated direct/group conversation container.
- **Primary key / foreign keys:** `id`; organization; optional cohort/context entity; created_by user.
- **Required fields:** `conversation_type` (`direct|group|cohort_support`), `status` (`active|archived|restricted`), `created_at`.
- **Optional fields:** title, last_message_at, moderation state, retention category.
- **Relationships:** many-to-many users through `conversation_participants`; one-to-many messages and reports/moderation cases.
- **Constraints/validation:** all participants have organization membership; direct conversation canonical participant pair unique among active conversations; restricted conversations block unauthorized sends.
- **Indexes:** `(organization_id, last_message_at DESC)`; participant join `(user_id, conversation_id)`; `(context_type, context_id)`.
- **Lifecycle:** archive/restrict rather than delete; subject to two-year raw-message retention unless hold/dispute/consent dictates otherwise.

### Message

- **Purpose:** immutable content entry in a conversation.
- **Primary key / foreign keys:** `id`; organization, conversation, sender user/membership; optional reply message and file assets via join table.
- **Required fields:** `body` or approved attachment, `sent_at`, `content_type`.
- **Optional fields:** edited_at, deleted_for_sender_at, moderation status, provider ingress metadata, reply reference.
- **Relationships:** belongs to conversation; one-to-many reactions/read receipts/reports; many-to-many files through `message_assets`.
- **Constraints/validation:** sender must be active participant and authorized; body length and sanitized rich text; edit window policy; moderator removal preserves tombstone/reason.
- **Indexes:** `(conversation_id, sent_at DESC, id DESC)` cursor pagination; `(sender_id, sent_at)`; moderation `(organization_id, moderation_status, sent_at)`.
- **Lifecycle:** append-only original/version history; user deletion may hide locally but does not defeat retention/legal hold; purge/anonymize at policy expiry.

### Calendar Event

- **Purpose:** canonical schedule item shown in calendars and linked to huddles, deadlines, announcements or external meetings.
- **Primary key / foreign keys:** `id`; organization, optional academy/cohort, creator; optional huddle/assignment/announcement source.
- **Required fields:** `title`, `starts_at`, `ends_at`, `timezone`, `event_type`, `status`.
- **Optional fields:** description, location, conference URL/provider ID, recurrence rule, external calendar reference, visibility.
- **Relationships:** belongs to scope; attendee/RSVP join table; optional one-to-one huddle reference.
- **Constraints/validation:** end after start; exactly one logical source type where generated; valid recurrence/timezone; scoped attendees only.
- **Indexes:** `(organization_id, starts_at, ends_at)`; `(cohort_id, starts_at)`; attendee `(user_id, starts_at)` materialized/denormalized view if needed.
- **Lifecycle:** scheduled → updated/cancelled/completed; external sync records and immutable change log; past events retained for attendance/audit.

## 6. Outcomes, recognition and reporting

### Certificate

- **Purpose:** immutable, verifiable award after completion criteria and approval.
- **Primary key / foreign keys:** `id`; organization, academy, fellowship, cohort, enrollment/student; mentor recommender, admin approver; certificate template/version; asset.
- **Required fields:** `verification_code`, `status` (`pending|issued|revoked|expired`), `eligibility_snapshot`, `issued_at` once issued.
- **Optional fields:** revoke reason/time/actor, public display name, signed artifact metadata, expiry if policy permits.
- **Relationships:** one certificate per enrollment/fellowship completion; references immutable eligibility/check evidence and audit events.
- **Constraints/validation:** globally unique opaque high-entropy verification code; issuance requires 90% required lesson completion, 75% attendance, all required work approved, mentor recommendation and admin approval unless documented exception; after issue, award fields immutable.
- **Indexes:** unique `(verification_code)`; unique `(enrollment_id, fellowship_id)` for issued/pending according to policy; `(organization_id, status, issued_at)`.
- **Cascade / lifecycle:** no deletion; revocation is state with reason/audit; retain certificate and audit evidence seven years after issue; public verification reveals minimum necessary information.

### Portfolio

- **Purpose:** learner-controlled portfolio publication container.
- **Primary key / foreign keys:** `id`; organization, student/user; optional academy; audit user fields.
- **Required fields:** `slug`, `visibility` (`private|unlisted|public`), `version`, `consent_state`.
- **Optional fields:** headline, bio, custom theme/config, public URL, published_at, SEO metadata.
- **Relationships:** one active portfolio per student per organization; one-to-many portfolio items which reference projects/certificates/assets.
- **Constraints/validation:** unique `(organization_id, slug)`; public/unlisted requires explicit, timestamped consent; only learner or authorized support policy may change content; public links revoke promptly on unpublish.
- **Indexes:** unique `(organization_id, slug) WHERE deleted_at IS NULL`; public `(visibility, published_at)`.
- **Lifecycle:** private draft → published/unpublished; soft delete only when no retention need; consent withdrawal unpublishes but retains private draft unless deletion requested.

### Badge

- **Purpose:** organization/fellowship-defined reusable recognition definition.
- **Primary key / foreign keys:** `id`; organization; optional academy/fellowship; creator; optional image asset.
- **Required fields:** `name`, `key`, `criteria_version`, `status`.
- **Optional fields:** description, visual metadata, criteria JSON, expiry policy.
- **Relationships:** one-to-many achievements; can be system or scoped.
- **Constraints/validation:** key unique in definition scope; criteria must be machine-evaluable or explicitly manual; no semantic modification after awards—create version.
- **Indexes:** unique `(organization_id, academy_id, fellowship_id, key) WHERE deleted_at IS NULL`; `(organization_id, status)`.
- **Lifecycle:** draft → active → retired; retire blocks new awards but preserves existing ones.

### Achievement

- **Purpose:** immutable award of a badge or recorded accomplishment to a learner.
- **Primary key / foreign keys:** `id`; organization, student/user, optional enrollment/cohort, badge, awarded_by.
- **Required fields:** `status`, `awarded_at`, `criteria_snapshot`.
- **Optional fields:** revoked_at/reason/actor, evidence reference, public visibility.
- **Relationships:** belongs to badge and learner; may contribute to portfolio/leaderboard points.
- **Constraints/validation:** unique active `(student_id, badge_id, cohort_id)` where repeat award not allowed; award criteria evidence recorded; revoke rather than delete.
- **Indexes:** `(student_id, awarded_at DESC)`; `(organization_id, badge_id, status)`; `(cohort_id, status)`.
- **Lifecycle:** awarded → revoked; permanent historical evidence subject to privacy policy.

### Leaderboard

- **Purpose:** a scoped, privacy-aware materialized ranking definition/result, not an unbounded live query.
- **Primary key / foreign keys:** `id`; organization, optional academy/fellowship/cohort; created_by.
- **Required fields:** `name`, `scope_type`, `period_type`, `metric_definition_version`, `status`.
- **Optional fields:** starts/ends, opt-in requirement, display rules, cached/computed_at.
- **Relationships:** one-to-many `leaderboard_entries` (student/enrollment, rank, score, metric snapshot); may derive from achievements/progress but never replace source records.
- **Constraints/validation:** scope must resolve under organization; metrics approved and documented; exclude opted-out/private learners.
- **Indexes:** `(organization_id, scope_type, status)`; entries unique `(leaderboard_id, enrollment_id)`, `(leaderboard_id, rank)`; rank/score ordering index.
- **Lifecycle:** draft → published → closed/archived; results are versioned snapshot per period and recomputed asynchronously.

## 7. Platform governance entities

### Audit Log

- **Purpose:** immutable security/operational record of important activity.
- **Primary key / foreign keys:** `id`; nullable organization/academy, actor user/membership/session, target entity references.
- **Required fields:** `occurred_at`, `action`, `entity_type`, `entity_id` where applicable, `outcome`, request/correlation ID, source IP hash/prefix policy.
- **Optional fields:** before/after redacted JSON, reason, user agent, impersonation/support-session ID, metadata.
- **Relationships:** many logs per actor/entity; no cascade from target/user.
- **Constraints/validation:** append-only; redact/no sensitive secrets, password data, MFA seeds or message content; standardized action catalogue; event-time immutable.
- **Indexes:** `(organization_id, occurred_at DESC)`; `(actor_user_id, occurred_at DESC)`; `(entity_type, entity_id, occurred_at DESC)`; `(request_id)`; consider monthly partitioning at scale.
- **Lifecycle:** no soft delete; retain seven years for certificate/critical governance events and per policy for other categories; legal hold overrides purge.

### System Settings

- **Purpose:** typed, versioned configuration at platform, organization, academy or fellowship scope.
- **Primary key / foreign keys:** `id`; nullable organization/academy/fellowship based on `scope_type`; updater/creator.
- **Required fields:** `scope_type`, `scope_id`, `key`, `value_json`, `value_schema_version`, `version`, `status`.
- **Optional fields:** encrypted secret reference (never raw secret in JSON), effective_from/to, description.
- **Relationships:** belongs to exactly one permitted scope; setting changes generate audit logs and may emit configuration events.
- **Constraints/validation:** unique active `(scope_type, scope_id, key)`; JSON validated against key-specific schema; hierarchy resolution is platform → organization → academy → fellowship with explicit override rules; sensitive keys require elevated permission/re-auth.
- **Indexes:** unique active scope/key; `(organization_id, key)`; `(scope_type, scope_id)`.
- **Lifecycle:** versioned values, not in-place opaque updates; deactivate/revert by creating a new version; preserve critical configuration history.

### Supporting platform tables

`file_assets` (owner scope, object key, MIME, checksum, scan/visibility/retention states), `outbox_events` (durable domain side effects), `webhook_deliveries`, `integration_connections` (encrypted token reference, scope, health), `feature_flags` and `feature_flag_assignments`, `data_subject_requests`, `retention_holds`, `report_exports`, `payment_ledger`, and `pricing_plans/cohort_prices` are required supporting entities. Each has tenant scope where relevant, audit fields, provider/idempotency unique keys, and no hard deletion while financial/security/legal records require retention.

## 8. Relationship and ERD description

```text
Organization 1─* Academy 1─* Fellowship 1─* Course 1─* Module 1─* Week 1─* Lesson
      │                    │                │                       └─* LearningResource
      │                    │                └─* Cohort
      │                    │                     ├─* Enrollment *─1 Student *─1 User
      │                    │                     ├─* MentorAssignment *─1 Mentor *─1 User
      │                    │                     ├─* MentorHuddle 1─* Attendance *─1 Enrollment
      │                    │                     ├─* CohortWeekRelease
      │                    │                     └─* CalendarEvent / Announcement
      │                    └─* Certificate (via cohort/enrollment)
      ├─* Membership *─* Role *─* Permission
      ├─* Conversation *─* ConversationParticipant *─1 User
      │                   └─* Message
      ├─* Notification *─1 User
      ├─* AuditLog
      └─* SystemSetting

Week 1─* Assignment 1─* Submission *─1 Enrollment
Submission 1─* Review / SubmissionFile
Enrollment 1─* LearningProgress *─1 Lesson
Enrollment 1─* Project 1─* ProjectMilestone / ProjectEvidence
Student 1─1 Portfolio 1─* PortfolioItem → Project / Certificate
Badge 1─* Achievement *─1 Student
Leaderboard 1─* LeaderboardEntry *─1 Enrollment
```

### Cardinality conventions

- **One-to-one:** User ↔ Student/Mentor/Admin profile is optional one-to-one per organization; Student ↔ active Portfolio is one-to-one per organization; Mentor Huddle ↔ canonical Calendar Event is optional one-to-one.
- **One-to-many:** Organization → academies/memberships/audit logs; fellowship → cohorts/courses; cohort → enrollments/huddles; assignment → submissions; conversation → messages.
- **Many-to-many:** users ↔ organizations through memberships; memberships ↔ roles through membership_roles; roles ↔ permissions through role_permissions; conversations ↔ users through conversation_participants; huddles ↔ learners through attendance; portfolio ↔ eligible artifacts through portfolio_items.
- **Join tables:** all many-to-many relationships use explicit tables with UUID PK, organization scope, timestamps/audit actor, lifecycle state and unique pair constraints. Avoid implicit ORM many-to-many tables because role grants, attendance and participants require provenance.
- **Inheritance strategy:** use composition, not a single-table `user_type` hierarchy. `users` stores identity; membership roles convey authorization; Student/Mentor/Admin profiles add only domain attributes. This supports multiple roles per user and per tenant without nullable subtype columns or brittle polymorphic constraints.

## 9. Referential actions, deletion and lifecycle rules

Use `RESTRICT` by default for parent records with historical or governed children (organization, academy, fellowship, cohort, user, assignment, certificate). Use `CASCADE` only for disposable private drafts or strictly dependent join rows where no independent history exists (for example, unaccepted invitation auxiliary tokens, draft resource ordering rows). Use `SET NULL` for optional attribution when retaining a historical record after an authorized user pseudonymization; preserve an actor pseudonym/audit reference.

Soft deletion is allowed for editable catalog drafts, unused resources, inactive profile material and portfolio drafts. It is not used for financial ledger, audit logs, issued/revoked certificates, attendance corrections, submitted assessments, message moderation evidence, or security records; these use status/tombstone/revocation and retention processes. Every soft-delete query needs a standard default scope, and unique indexes must exclude deleted rows where reuse of a slug/key is permissible.

Lifecycle state changes are controlled by application state machines and recorded in audit/event history. Database checks enforce valid field combinations (e.g., `issued_at` required when certificate status is issued); transition authorization belongs to policies/services.

## 10. Security and privacy design

### Sensitive fields and handling

| Category | Examples | Handling |
| --- | --- | --- |
| Credentials | password hashes, refresh-token hashes, TOTP secrets, recovery codes | Argon2id/one-way hash where possible; TOTP/provider tokens encrypted; never log, return, or include in backups exposed to lower environments |
| Personal data | email, phone, emergency contact, date/profile information | minimize; field-level serializer controls; encrypt particularly sensitive optional fields; access audited |
| Education/assessment | submissions, feedback, attendance, risk/support notes | tenant/role/resource policy; immutable review/decision history; controlled retention |
| Security/operations | IP, device, audit data, webhook signatures, API secrets | hash/redact IP where possible; secret-manager references rather than plaintext; restricted operations access |
| Public outcomes | portfolio, certificate verification | explicit consent/visibility; verification exposes minimal data; revocation respected immediately |

Passwords are never stored outside `password_credentials` and are always Argon2id hashes with per-secret salt. Role permission storage is normalized (`roles`, `permissions`, join tables) and evaluated with tenant/resource scope; hierarchy is an administrative convenience, never implicit privilege inheritance. Audit logs are append-only, redacted, correlation-ID linked and protected from normal administrator modification.

## 11. Performance, querying and caching

### Index policy

Every foreign key gets an index unless a reviewed query plan demonstrates otherwise. Most tenant tables need composite indexes beginning with `organization_id`, then the principal list/filter/sort fields. Partial indexes target active rows (`WHERE deleted_at IS NULL`) and state-specific queues (submitted reviews, unread notifications). Use descending time indexes for activity feeds. Add GIN full-text/trigram indexes only for bounded, permission-scoped search fields (programme/resource/title, user directory); never global-search unscoped tenant text.

Use `EXPLAIN (ANALYZE, BUFFERS)` on representative production-like data before adding expensive indexes. Maintain index size/bloat, vacuum/analyze, slow query logs, connection-pool saturation, and query time by tenant as operational metrics. Partition only high-volume append-only tables—initially audit logs, notifications, messages/delivery attempts—by month or quarter after volume warrants it.

### Pagination and search

Use keyset/cursor pagination for time-ordered or large lists: `(created_at, id)` or `(sent_at, id)` cursor, stable sort and bounded page size. Offset pagination is acceptable only for small static administration lists. API search is tenant-scoped and permission-filtered before relevance ranking; PostgreSQL full text plus trigram matching is sufficient initially. Introduce a dedicated search index only when query volume, ranking or cross-entity indexing demands it; index updates flow through outbox events.

### Caching opportunities

Cache read-mostly, safely scoped data: organization/academy configuration, permission/capability resolution, published curriculum snapshots, resource metadata, feature flags and public certificate verification results. Cache keys must include tenant, user or authorization-relevant scope where private; use short TTLs and event-driven invalidation. Do not cache individual sensitive profile/assessment data in shared keys. Redis is a performance layer only—PostgreSQL remains authoritative.

## 12. Scalability and operational evolution

The shared-schema, tenant-keyed design supports thousands of students, hundreds of mentors, multiple administrators and concurrent cohorts through scoped indexes, connection pooling, asynchronous aggregation and separate read/reporting paths. At growth thresholds, add read replicas for analytics, materialized/aggregate progress and leaderboard tables, background recomputation, time partitioning, and archive storage before considering service or database separation.

Future multi-organization expansion uses organization-scoped configuration, branding, integrations and membership, not duplicated schemas. Future multiple academies and programmes rely on explicit academy/fellowship/course/cohort hierarchy and immutable version snapshots. A tenant-routing abstraction can later select a dedicated database/region/key for contracted enterprise isolation while preserving the application-level organization key and API semantics.

## 13. Schema implementation acceptance checklist

Before generating Prisma models or migrations, the implementation team must validate:

- all tenant-owned tables contain non-null `organization_id` and scope-consistent foreign keys;
- every entity above has the prescribed primary key, audit fields, soft-delete/status behavior, indexes and lifecycle states;
- migrations create foreign keys, unique/composite/partial indexes and check constraints described here;
- authorization and serializer tests prove cross-tenant denial and private-field protection;
- state-transition, certificate eligibility, enrollment progression, submission-attempt and role-scope invariants have database/application tests;
- sensitive fields, retention and audit events have a reviewed data classification; and
- any departure is documented in an ADR and updates this document before schema implementation proceeds.
