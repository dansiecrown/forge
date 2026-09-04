# ADR-0013: Dashboard Bento Redesign — Glass & Skeleton Exception

**Status:** Accepted
**Date:** 2026-09-04
**Owner:** Lead Engineering

## Context

The three dashboard pages (Admin, Mentor, Student portal) each hand-rolled the same generic
uniform grid of stat cards, a spinner-only loading state, and an Empty/Error state that collapsed
into the same `EmptyState` message with no distinct visual and no retry. The user asked for a
Bento-style asymmetric layout, a documented Loading/Error/Empty/Success state pattern, and —
explicitly, after being told this conflicts with the current system — glassmorphism and skeleton
loaders on these three pages specifically, accepted as a deliberate, disclosed exception rather
than applied silently.

## Decisions

1. **Dashboard content cards use `<Card glass>` — a scoped exception to ADR-0004,** which reserves
   glassmorphism for floating/overlay surfaces only (auth card, menus, dialogs, toasts) and never
   for page content. The three dashboards now use it for ordinary content tiles. **Every other page
   in the app is unaffected and remains on the ADR-0004 pattern** — organization/academy/fellowship/
   cohort detail pages, list pages, settings, etc. all still render plain `border-border`/`bg-surface`
   cards. This is a visible, intentional inconsistency between "the dashboards" and "everything
   else," accepted because it was explicitly requested, not something to silently extend elsewhere.
2. **A new `Skeleton` primitive (`components/ui/skeleton.tsx`) replaces the spinner for these three
   pages' Loading state.** Each dashboard composes its own skeleton shape (KPI tiles, the focal
   tile, list rows) out of `Skeleton` blocks rather than a single generic placeholder box, so the
   loading state previews the actual layout about to appear. The spinner pattern
   (`Loader2` + `animate-spin`) is untouched everywhere else in the app — this is additive, not a
   replacement of the existing convention.
3. **A new compound `DashboardState` component (`components/dashboard-state.tsx`)** — `<DashboardState
   status={...}><DashboardState.Loading>`/`.Error`/`.Empty`/`.Content>` — replaces each page's own
   hand-rolled `if (isLoading) return ...; if (error) return ...` chain. All three dashboards compute
   `status` the same way: `isLoading ? 'loading' : error ? 'error' : isEmptyCondition ? 'empty' :
   'success'`. This is a page-level pattern, not a new global list/detail-page convention — the
   existing `DataTable` component's own built-in loading/error/empty handling (used by every
   list page) is untouched.
4. **Error and Empty are now visually distinct**, where before both rendered the identical
   `EmptyState` "We couldn't load your dashboard" message regardless of which had actually
   happened. The new `DashboardErrorPanel` gives Error its own danger-toned treatment and an actual
   retry button wired to the query's own `refetch()` — previously a real error offered no way to
   recover without a full page reload.
5. **Each dashboard's Bento layout picks one focal tile per the audit of what data actually
   exists** — no page gained a fabricated chart or invented time-series. Admin already had a real
   weekly-enrollment trend, so that chart is the focal tile there. Mentor and Student have no
   time-series data at all; their focal tile is instead their single most important existing
   element — Mentor's Review queue (the most actionable, time-sensitive list) and Student's
   Progress ring merged with "Continue learning" into one hero tile (previously two separate small
   cards). No new backend fields or data were added to manufacture a "primary stat."
6. **Decorative all-caps micro-labels were removed** ("Welcome back" eyebrow, "Huddles"/"Your recent
   notes" section labels) in favor of plain-case headings and spacing-led hierarchy. Semantic status
   colors (warning for at-risk/deadlines, success for reviewed, brand for streak/time) were kept —
   they encode real state, not decoration, and removing them would be a real usability regression
   for no visual-cleanliness gain.

## Consequences

- No backend changes, no new permissions, no new data fields.
- The app now has two coexisting content-card visual languages by design: ADR-0004's plain cards
  (everywhere) and this ADR's glass+skeleton cards (the three dashboards only). Anyone extending a
  dashboard should keep using `<Card glass>`/`Skeleton`/`DashboardState`; anyone building a new
  non-dashboard admin page should keep using the ADR-0004 pattern, not this one.
- `Skeleton` and `DashboardState` are generic enough to reuse if a future page's design explicitly
  calls for this same treatment — but adopting them elsewhere without a matching explicit request
  would erode the ADR-0004 boundary this decision is careful to keep intact.
