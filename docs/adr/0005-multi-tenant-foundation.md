# ADR-0005: Multi-tenant foundation (Organizations, Academies, Fellowships, Cohorts, Enrollment)

**Status:** Accepted
**Date:** 2026-07-25
**Owner:** Lead Engineering

## Context

Milestone 3's brief asked for Organizations, Academies, Fellowship Programmes, Cohorts, and Enrollment
relationships to be built together, end to end (database, API, admin UI, tests), in one pass.

`docs/development-roadmap.md` does not sequence this work as one milestone. It splits the same scope
across **Phase 4** (Organizations/Academies, tenant administration) and **Phase 6** (Fellowships/
Cohorts/Enrollment, catalogue and cohort operations), with Phase 5 (web application shell) placed
between them, and a critical-path gate: "Do not begin tenant-owned domain migrations before Phase 2
scope, audit, migration, and outbox conventions are accepted" (line 301). Phase 2's own deliverables
include a transactional outbox event framework, which was never built — `AuditLogService` is
explicitly synchronous, no-outbox, by Milestone 2's own documented design. `docs/ENGINEERING_DECISIONS.md`
states the same rule directly, naming these exact entities: "later-milestone functionality
(Organizations, Academies, Fellowships, Cohorts, Courses, dashboards, etc.) is not started early, even
opportunistically."

This is a genuine conflict between an explicit instruction and the project's own standing process
documents, not a simple ambiguity. It was raised before implementation began. The product owner chose
to override the roadmap sequencing and proceed with the milestone as briefed. This ADR records that
decision, per the Architecture Lock rule, along with every point where the milestone brief's field
list didn't map cleanly onto `docs/database-design.md`'s existing (aspirational, previously
unimplemented) schema for these five entities.

## Decisions

1. **Roadmap sequencing is overridden for this milestone only.** Organizations, Academies, Fellowships,
   and Cohorts/Enrollment are built together now rather than across Phases 4 and 6. The outbox
   convention and Phase 5 web shell that the roadmap gates this work on are **not** built as part of
   this override — only the specific entities and endpoints the milestone brief requested. Future
   milestones should not treat this as a precedent that roadmap sequencing is generally optional;
   it was an explicit, one-time product decision for this milestone, made with the conflict disclosed.

2. **Organization lifecycle stays status-driven, not `deleted_at`-based**, per `docs/database-design.md`'s
   explicit statement that "no cascading deletion of tenant data" applies and "`deleted_at` is normally
   unused; use status" for Organization. The brief's "Soft delete, Restore" requirement is satisfied by
   `archived` ⟷ `active` status transitions (`POST /organizations/:orgId/actions/archive|restore`), not
   a new `deleted_at` column. `Academy`, `Fellowship`, and `Cohort` *do* get real `deleted_at` soft
   delete — `docs/database-design.md` specifies partial `WHERE deleted_at IS NULL` unique indexes for
   exactly these three, matching the existing `roles` precedent from ADR-0003.

3. **Fellowship does not carry `startDate`/`endDate`.** `docs/database-design.md` deliberately separates
   Fellowship (a reusable, academy-owned programme template) from Cohort (a dated, capacity-bound
   delivery run of that template) — Cohort already owns `startsAt`/`endsAt`/`capacity`. Putting real
   dates on Fellowship too would create two disagreeing sources of truth for "when does this run."
   Fellowship instead gets `defaultCapacity` (already documented) and a new `registrationOpensAt`/
   `registrationClosesAt` pair (a programme-level application window, not documented previously) to
   satisfy the brief's "Registration window"/"Capacity" fields without duplicating Cohort's dates.

4. **Fellowship omits `curriculumVersion`/`completionPolicyVersion`.** `docs/database-design.md` lists
   these as required Fellowship fields, but they describe a curriculum/completion-policy system this
   milestone explicitly excludes ("No coursework yet"). Adding them now, unpopulated, would be the same
   speculative-column mistake ADR-0003 already named and avoided for `Membership.academy_id` before
   Academy existed. Deferred to whichever milestone builds the catalogue/curriculum system (roadmap
   Phase 6).

5. **`Organization.country`** is a new field, not in `docs/database-design.md`'s original list, added
   because the milestone brief asked for it explicitly (Part A). Documented here as the addendum,
   consistent with the Architecture Lock rule's "never change both without recording why."

6. **Enrollment status is `invited|active|paused|completed|withdrawn`**, not the full six-value set
   `docs/database-design.md` lists (`...|awaiting_completion_review`). That status describes a
   submission-review workflow this milestone doesn't build. The narrower set is what the "one active
   Enrollment per Fellowship" and basic status-transition rules in the brief actually require.

7. **`Membership.academyId` is added**, nullable, anchoring an academy-scoped membership (e.g.
   `ACADEMY_ADMIN`, a mentor or student's home academy) to one specific `Academy` row. This is exactly
   the column ADR-0003 deferred: "omitted, not just nullable... added as a real, populated column when
   Academies are built." Deeper academy-scoped permission *enforcement* beyond this FK existing is
   tracked as new technical debt (`docs/KNOWN_TECHNICAL_DEBT.md`), not built here.

8. **`GET /organizations` (the platform tenant list) and the create/suspend/archive/restore actions are
   gated by an explicit `PermissionResolverService.hasPlatformRole(..., 'SUPER_ADMIN')` check inside
   `OrganizationsService`, not only the `@RequirePermissions` guard.** Relying on a permission key alone
   would let a hypothetical custom tenant role holding `organization.list` see every other tenant's
   data — the same class of defect ENGINEERING_DECISIONS.md's "security-first engineering" principle
   treats as a release blocker. `organization.read`/`.update` remain permission-key-gated and
   ORG_ADMIN-grantable, since reading/editing one's own organization is legitimately tenant-scoped.

9. **A platform Super Admin's own active-organization header never causes a false "not found" on another
   organization's detail.** `OrganizationsService.get` originally treated any non-matching
   `X-Organization-Id` as cross-tenant and 404'd — correct for an ORG_ADMIN, but wrong for a Super
   Admin browsing/managing a *different* organization than whichever one happens to be their own
   active context. This was caught live (via a browser walkthrough of the admin UI, not just API
   testing) and fixed by only enforcing the scope-match for non-super-admin callers. Covered by a
   regression test (`organizations.service.spec.ts`).

10. **Action endpoints (`publish`/`retire`/`activate`/`pause`/`complete`) carry `version` in the request
    body**, while `PATCH` endpoints use the `If-Match` header, per the existing `Role` precedent (whose
    documented JSON sample also shows `version` in the body, but whose actual implementation uses
    `If-Match` for `PATCH`). This milestone introduces the first action endpoints in the codebase, so
    there was no prior precedent for that specific case — body-carried `version` was chosen to match
    `docs/api-specification.md`'s literal documented request samples for these new routes.

11. **Academy archive / Fellowship retire do not block on active Cohorts beneath them.** Enforcing that
    would require the owning module (`organizations`, `catalog`) to depend on its descendant module
    (`cohorts`), inverting the established one-directional dependency chain
    (`organizations → catalog → cohorts`) that keeps `docs/project-structure.md`'s module-boundary rule
    enforceable. Tracked as new technical debt rather than solved with a reverse import.

## Consequences

- `docs/database-design.md` remains the schema-design source of truth for the fields it already
  specified; this ADR is the record of every place the live schema (in
  `apps/api/prisma/migrations/20260725162854_multi_tenant_foundation/`) diverges from it and why —
  the doc itself is not rewritten, since the divergences are milestone-specific additions/omissions,
  not corrections of a wrong prior spec (contrast with the Database Naming precedent in
  `docs/ENGINEERING_DECISIONS.md`).
- DEBT-005 (no domain-entity layer) is resolved for the three new modules (`organizations`'s Academy/
  Organization additions, `catalog`, `cohorts`) — each has an `entities/` layer with a mapper function,
  per that debt item's own note that this was "better proven once Organizations/Catalog exist." The
  identity/roles modules are unchanged; retrofitting them is separate, still-open debt.
- Three new, small technical-debt items were opened (`docs/KNOWN_TECHNICAL_DEBT.md`): academy-scoped
  permission enforcement beyond the FK, Academy/Fellowship not blocking on active descendants, and the
  admin UI shipping ahead of the Phase-5 web shell it will eventually be absorbed into.
- No outbox, no Phase 5 web shell, no curriculum/course system, no attendance/huddles, and no student/
  mentor-facing portal were built — all explicitly out of scope per the milestone brief and this ADR's
  Decision 1.
