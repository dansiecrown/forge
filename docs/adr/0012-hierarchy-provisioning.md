# ADR-0012: Hierarchy, Provisioning & Role-Access Correction

**Status:** Accepted
**Date:** 2026-09-04
**Owner:** Lead Engineering

## Context

Pre-Milestone-8 scope item: correct and complete the administrative hierarchy — Organization →
Academy → Fellowship → Cohort → Students, with Mentors as cohort-scoped supporting users and
**no Fellowship Admin role** — so the UI and backend both communicate and enforce it clearly.

An audit (recorded below, not re-litigated in the code) found the backend hierarchy enforcement
already correct and already tested: required, non-nullable foreign keys at every level; every
`create()` validates its parent belongs to the caller's scope
(`AcademiesService.assertBelongsToScope`, `FellowshipsService.assertOpenForCohortCreation`); every
`list()`/`get()` already calls `MembershipsService.getAcademyScope()` to confine an academy-scoped
caller to their own academy; mentor assignment is already cohort-scoped
(`POST/DELETE /cohorts/:id/mentors`), never self-service; the Super Admin cross-tenant bypass in
`PermissionsGuard` is intact; and no `FELLOWSHIP_ADMIN` role exists anywhere in code or docs. The
real gaps were on the frontend: no contextual creation flow, no child lists on parent detail pages,
no real breadcrumb, and a flat nav presenting Organizations/Academies/Fellowships/Cohorts as four
unrelated top-level sections instead of one navigable hierarchy.

## Decisions

1. **No Fellowship Admin role was created, and none was found to remove.** A Fellowship remains a
   managed resource, not an administrative scope — ORG_ADMIN and ACADEMY_ADMIN manage it, exactly
   as before.

2. **Contextual creation replaces the flat "pick any parent from a dropdown" pattern.**
   `FellowshipCreatePage`/`CohortCreatePage` now read an optional `?academyId=`/`?fellowshipId=`
   query param. Arriving from a parent's own detail page ("Academy → Fellowships → Create
   fellowship") locks that field to a read-only value instead of a dropdown of every
   academy/fellowship in the organization; arriving from the flat route directly (still a valid,
   unchanged entry point) keeps the original dropdown. No new routes were added — this is additive
   to the existing `/admin/fellowships/new` and `/admin/cohorts/new` routes, not a restructure of
   them.

3. **Academy and Fellowship detail pages gained a real "children" section.** `AcademyDetailPage`
   now lists its own fellowships (`useFellowshipsList(q, status, academyId)`, extended with a third,
   optional parent-filter argument — the backend already accepted `?academyId=`/`?fellowshipId=`,
   only the frontend hook never threaded it through) with a contextual "New fellowship" action;
   `FellowshipDetailPage` does the same for its cohorts. Previously these pages only showed a raw
   count in a stats card, with no way to see or reach the children at all.

4. **A real `Breadcrumb` component (`components/admin/breadcrumb.tsx`) replaces the single-level
   "ParentList / slug" pattern** every detail page had (e.g. "Academies / slug"). Organization,
   Academy, Fellowship, and Cohort detail pages, plus the two create pages when arriving with
   context, now show the full chain — Organizations / OrgName / AcademyName / FellowshipName /
   CohortName — each link navigable. `Cohort`/`Fellowship` already carry their own
   `organizationId`/`academyId` directly (denormalized, per the existing schema), so every
   breadcrumb's supporting data comes from one extra parallel query per level, never a chain of
   sequential waterfalled fetches.

5. **The admin nav has exactly one hierarchy entry point, resolved per role — not four flat,
   unrelated top-level items.** `useHierarchyRootItem()` in `admin-layout.tsx` returns "Organizations"
   (Super Admin, list), "My Organization" (anyone holding `academy.create` — ORG_ADMIN), or "My
   Academy" (anyone holding `academy.update` but not `academy.create` — ACADEMY_ADMIN), chosen by
   permission key rather than a hardcoded role name so it can never drift from what the guard
   actually enforces. Fellowships and Cohorts are reached by drilling down from there, per the
   requested nav shape. The flat `/admin/academies`, `/admin/fellowships`, `/admin/cohorts` list
   routes are **not deleted** — they remain valid, reachable URLs — they're just no longer linked
   from the sidebar, since the hierarchy-first flow now covers the same ground with context attached.

6. **`GET /me`'s membership objects now include `academyId`** (`packages/api-contract`'s
   `MeResponse`, `MeController.getMe`) — null for an org-wide role, set for an academy-scoped one.
   This is what makes "My Academy" resolvable client-side at all; the column already existed on
   `Membership`, it simply wasn't being surfaced. Purely additive — no existing consumer of `/me`
   is affected by one new optional-shaped field.

7. **Fixed a real navigation-context bug directly blocking "Super Admin can navigate down the
   hierarchy regardless of their own organization membership" (the explicit requirement this task
   named):** `OrganizationDetailPage` now sets the app's active-organization context to whatever
   `orgId` its own route is showing, the moment it mounts, instead of leaving the org switcher's
   last selection in place. Every other hierarchy-scoped query (`AcademiesService`/
   `FellowshipsService`/`CohortsService`) filters by `organizationId` *before* checking Super Admin
   status, unlike `OrganizationsService.get()`'s own explicit cross-org bypass — so a Super Admin
   drilling from the Organizations list into an org other than whatever their switcher last had
   selected would 404 on that org's own academies/fellowships/cohorts once they went one level
   deeper, despite the top-level org page itself loading fine. This one fix (not four) covers the
   whole drill-down path, because every page below it inherits the same active-organization
   context. See DEBT-033 below for the one path it does not cover.

## Consequences

- No new database tables, columns, or migrations. No new permissions, no new roles.
- No backend authorization logic changed — the audit found it already correct, and every existing
  authorization test (academy-scope isolation on `fellowships.service.spec.ts`/
  `cohorts.service.spec.ts`, cohort-scoped mentor assignment) is untouched and still passes.
- `AdminPageHeader`'s `description` prop wrapper changed from `<p>` to `<div>` — a `Breadcrumb`
  renders a `<nav>`, which is not phrasing content and cannot legally sit inside a `<p>`. Purely a
  markup-validity fix; no visual change (same `text-sm text-muted-foreground` styling).
- One new backend contract field is disclosed rather than silently added: `MeResponse.memberships[].academyId`.

See `docs/KNOWN_TECHNICAL_DEBT.md` (DEBT-033) for the one remaining edge case Decision 7 doesn't
cover — a Super Admin deep-linking directly to an Academy/Fellowship/Cohort URL without visiting
that organization's own detail page first.
