# ADR-0015: Name-First Display, and List-Then-Edit Detail Pages

**Status:** Accepted
**Date:** 2026-09-05
**Owner:** Lead Engineering

## Context

Two related UI flaws reported directly against the running app:

1. Several admin screens displayed a raw id (a user's `userId`, a cohort mentor's `membershipId`, an
   audit log entry's `actorUserId`) instead of a name — confirmed live: `OrganizationDetailPage`'s
   "Organization administrators" card, `CohortDetailPage`'s "Enrollments" and "Assigned mentors"
   lists, and the Audit Center (both the Actor column and its filter, which required typing a raw
   UUID to search).
2. Every "detail" page with editable fields (Organization/Academy/Fellowship/Cohort profile,
   and the shared student/mentor `ProfileForm`) rendered its edit form inline and always-visible,
   with no distinct read/edit mode, and native `<select>` dropdowns used the browser's own
   unthemeable popup chrome.

## Decisions

1. **Every id-bearing list/detail response the frontend renders resolves a name server-side.**
   Where a real Prisma relation already exists (`Membership.user`, `CohortMentor.membership.user`),
   the fix is `include: { user: true }` at the query site. Where none exists by design —
   `Enrollment` and `AuditLog` have no FK to `User`, so that history survives a user's account being
   later removed — the fix is a batch `UsersService.listByIds()` lookup (already existed, built for
   exactly this purpose but never wired into these call sites) merged onto the result in the
   service layer. Every new/changed field is additive to its contract type
   (`EnrollmentEntity.userDisplayName`/`userEmail`, `CohortMentorEntity.userDisplayName`/`userEmail`,
   `AuditLogEntry.actorDisplayName`, `OrganizationAdmin`), never a breaking rename.

2. **Any control that lets a caller pick one resource from a list of names now supports
   type-to-search.** `PersonSearchField` (people, already existed) is now a thin wrapper over a new
   generic `EntitySearchField<T>` — same suggestions-dropdown UX, reusable for any resource type.
   The Audit Center's actor *filter* is the first non-person consumer, replacing a raw
   "type a UUID" text box.

3. **`Select`/`SelectField` (plain, non-search dropdowns) keep their native `<select>` element —
   forms still get real, unmodified `react-hook-form` `register()` wiring — but `appearance-none`
   plus an overlaid `ChevronDown` replace each browser's own inconsistent trigger chrome.** The open
   option *list* itself is still browser/OS-rendered; no cross-browser CSS can restyle that popup's
   internals today. A control where genuine search value exists uses `EntitySearchField` instead,
   which is fully custom-rendered end to end.

4. **Every editable "detail" section is read-only by default — a read-only `DefinitionList`, plus an
   Edit button that opens the existing form inside a `Dialog`.** Applied to
   Organization/Academy/Fellowship/Cohort's profile sections and the shared student/mentor
   `ProfileForm`. Submitting shows the existing loading-spinner button state; on success the dialog
   closes and a toast confirms it; on failure the dialog stays open (with the existing inline
   `Alert` for detail) and an error toast fires too. No page's mutation hooks, validation schemas,
   or field sets changed — only what wraps them.

5. **A new `ToastProvider`/`useToast()` (mounted once at the app root) is the app's first save-result
   notification system**, used by every conversion in Decision 4. Success is `role="status"`
   (polite), failure is `role="alert"` (assertive) — the same distinction `Alert` already draws.
   Auto-dismisses after 5s or on manual close; never reverts a dismissed/read toast back.

## Consequences

- No schema changes. `CohortsModule` and `AdminModule` gained `IdentityModule` as an import (to
  reach `UsersService` for the batch-lookup enrichment) — no circular dependency, since
  `IdentityModule` already depends on `PlatformModule`/`OrganizationsModule`, not the reverse.
- `Select`/`SelectField`'s public API is unchanged — every existing call site across the app needed
  zero edits.
- Channel/organization/academy/fellowship/cohort *management* forms (create/rename/archive) are
  unaffected by Decision 4 — only each entity's own "Profile"/"details" section, the one that was
  genuinely always-visible, was converted.
- A full line-by-line audit of every remaining "should this show a name instead of an id" spot
  across the app was not attempted — the three confirmed instances above are fixed; anything else
  found later is a small, same-pattern follow-up, not a new decision.
