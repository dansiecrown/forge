# ADR-0010: Cohort Applications (Self-Service Registration + Prospect Onboarding)

**Status:** Accepted
**Date:** 2026-07-31
**Owner:** Lead Engineering

## Context

Live-testing the Milestone 7 academy-scoping bug fix surfaced two real gaps in the shipped
platform: there was no way for a student to request joining a cohort themselves (an admin/mentor
had to manually call `POST /cohorts/:id/enrollments` on their behalf), and no way for a brand-new
"prospect" — someone with no platform account at all — to apply to the platform. Every account
until now was created by an admin invite (`POST /users/invitations`).

The user confirmed the desired shape via clarifying questions before implementation began:
registration is limited to fellowships/cohorts an admin has explicitly marked public (reusing the
already-existing, previously-inert `Fellowship.isPublic` / `Academy.isPublic` booleans), applications
require admin approval before becoming a real enrollment (never instant self-enroll), and a single
application lets the applicant — student or prospect — pick both a cohort and a learning track, with
approval creating whatever's missing (account, org membership, enrollment) and applying the
requested track in one action.

Pre-implementation regression check: `pnpm --filter @forge/api test` — 34/34 suites, 184/184 tests
passing (the same baseline the academy-scoping fix left the repository in).

## Decisions

0. **Everything lives in a new `CohortApplication` entity + `AdminModule` orchestration, not a new
   module and not the `cohorts` module.** The public catalog browse and the "is this cohort actually
   open for applications" check cannot be built on `CohortsService.get()` / `FellowshipsService.get()`
   as they exist today — both now bake in `MembershipsService.getAcademyScope(scope, callerId)` (the
   Milestone 7 hierarchy-scoping fix), which requires a real authenticated caller. An anonymous
   prospect has no `callerId`, so those methods would resolve to the safe "sees nothing" default and
   404 everything. `CohortApplicationsRepository`/`PublicCatalogRepository` therefore go direct-Prisma
   instead — the same "inject `PrismaService` directly" precedent `AdminStatsRepository` already
   established, not a new pattern. Approval is also the first true 3-module orchestration in this
   codebase (identity + organizations + cohorts in one call); since `AdminModule` already imports all
   three, the whole feature lives there, mirroring the placement rule from
   `docs/adr/0009-administration-platform.md` §0.
1. **Approval reuses the existing invite mechanism verbatim rather than inventing a new
   account-creation path.** `CohortApplicationsService.approve()` calls the unmodified
   `UsersService.invite()` (creates the `User` row + `PasswordResetToken` + sends the existing
   "invitation" email template) when the application has no `applicantUserId`, then the unmodified
   `MembershipsService.inviteIntoOrganization()` (skipped if the resolved user already has an active
   membership — approving an existing student's application must not re-invite them or hit
   `ALREADY_MEMBER`). No new email template, no new token table, no new "accept invitation" endpoint.
2. **Approval is ordered to be idempotent/resumable across a partial failure.** The four steps
   (resolve/create the user, ensure membership, create-or-reuse the enrollment, apply the requested
   track) span four services with no shared database transaction. A new
   `EnrollmentsService.findByCohortAndUser()` (backed by a new `EnrollmentsRepository
   .findByCohortAndUser()`, both additive, not exposed over HTTP) is checked before falling back to
   `EnrollmentsService.create()` — without it, a retried `approve()` call after a later step failed
   would hit Enrollment's plain `@@unique([cohortId, userId])` constraint and misreport as "already
   enrolled." The `CohortApplication` row itself is only marked `approved` as the very last step, so a
   failed attempt is always safely retryable. `CAPACITY_REACHED` / `ACTIVE_ENROLLMENT_EXISTS` from the
   enrollment-creation step deliberately bubble unchanged as 409s rather than being auto-converted
   into a rejection — auto-rejecting would itself be an unreviewed automated decision, on a feature
   whose entire point is admin review.
3. **New permission keys follow the existing dot-separated singular-resource convention.**
   `cohort.application.submit` (granted to `STUDENT` only), `cohort.application.read` and
   `cohort.application.manage` (both granted to `ORG_ADMIN`/`ACADEMY_ADMIN`, mirroring the
   `announcement.read`/`announcement.manage` split) — not `cohort_application.manage`. The
   authenticated self-submit route uses this real permission key rather than borrowing an unrelated
   one purely to satisfy `PermissionsGuard`'s organization-resolution requirement (the trick
   `enrollments/me` uses for `enrollment.progress.read`) — adding one more key alongside the two admin
   keys this feature already needs was effectively free and avoids a second "grants no broader access"
   caveat elsewhere in the codebase.
4. **The public catalog is a genuinely cross-tenant, unauthenticated read.** `GET /public/fellowships`
   takes no `X-Organization-Id` and no session — an anonymous prospect has neither. The target
   organization for a submitted application is resolved entirely server-side from the chosen
   `cohortId` via `CohortApplicationsRepository.findApplyableCohort()`, never supplied by the client.
   This is a deliberate, disclosed exception to `docs/project-structure.md`'s "repository methods take
   scope objects, not optional organization arguments" convention, precedented by
   `AdminStatsRepository`'s existing optional-scope aggregation methods. The authenticated
   student-submit path additionally passes its own `X-Organization-Id` to `findApplyableCohort()` so a
   student can only self-submit into their *currently active* organization's public cohorts — the same
   method, same "is this cohort open" rule, in both cases, so the rule can never drift between the two
   entry points.
5. **The admin approval queue is academy-scoped exactly like every other admin list**, reusing
   `MembershipsService.getAcademyScope()` (`CohortApplication.academyId` is denormalized from the
   cohort specifically so this works, matching `Cohort.academyId`'s own denormalization precedent) —
   an Academy Admin sees only applications for cohorts under their own academy, an Org Admin sees the
   whole organization.
6. **`SystemSettings.registrationOpen`** — stored and admin-editable since Milestone 7 but never read
   anywhere until now — **is this feature's kill switch.** Both submission paths check it first and
   reject with `REGISTRATION_CLOSED` if false, closing the same "disclosed narrowing" gap
   `docs/adr/0009-administration-platform.md` Decision 5 flagged for `SystemSettings`' other policy
   fields, at least for this one flag.

## Consequences

- `docs/KNOWN_TECHNICAL_DEBT.md` — no entries close; `Fellowship.isPublic`/`Academy.isPublic` (stored
  since Milestone 3, never read until now) and `SystemSettings.registrationOpen` (stored since
  Milestone 7, never read until now) both move from "disclosed but inert" to "actually enforced."
- New, disclosed narrowings, matching this codebase's established pattern of listing what was
  deliberately left out rather than silently omitting it:
  - No email notification on rejection or withdrawal — only the existing invite email fires, on
    approval, for a brand-new prospect identity.
  - No re-application cooldown — a rejected/withdrawn application can be resubmitted immediately; the
    two hand-written partial unique indexes (`cohort_applications_pending_prospect_key`,
    `cohort_applications_pending_applicant_key`) only block a second **pending** row for the same
    cohort.
  - No capacity pre-check or seats-remaining display at submission time — `CAPACITY_REACHED` surfaces
    at approval time, same as today's manual-enroll flow.
  - A prospect cannot withdraw their own application (no session to authenticate a withdrawal with) —
    only an authenticated student can self-withdraw, via `POST /cohort-applications/:id/actions/withdraw`.
  - An authenticated student can only self-submit into their currently active organization's public
    cohorts. Applying to a different organization goes through the same anonymous `/apply` flow a
    first-time prospect uses — safe, because `UsersService.invite()` reuses an existing identity by
    email rather than duplicating it, but the experience is "re-enter your email," not "you're already
    logged in."
  - No abuse-protection code beyond the existing global `ThrottlerGuard`, which already covers every
    route including the two new public ones.
- `CohortApplication` is the first model in the schema with more than one foreign key to `User`
  (`applicantUserId`, `reviewedByUserId`, `resultingUserId`) — each uses a named Prisma relation
  (`@relation("CohortApplicationApplicant")` etc.). No prior model needed this; future models with
  multiple `User` FKs should follow the same naming pattern.
- Curriculum-content and Reports/Audit/Certificates/Announcements academy-scoping remain the
  disclosed, un-closed gap noted in `docs/KNOWN_TECHNICAL_DEBT.md` DEBT-015 — this feature's admin
  queue closes the same class of gap for `CohortApplication` specifically, not those other surfaces.
