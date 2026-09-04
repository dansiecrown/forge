# ADR-0011: Public Tech Impact Fellowship Landing Experience

**Status:** Accepted
**Date:** 2026-09-04
**Owner:** Lead Engineering

## Context

Project Forge is the platform; **Tech Impact Fellowship** is the first programme it powers. Until
now, the only public-facing surface was the plain, utilitarian `/apply` React page — functional,
but it presented as a generic Project Forge screen, not as a real fellowship's own website, and
carried the full React bundle just to show a form. This work adds an approved, additional scope
item on top of the already-shipped Milestone 7 Administration Platform and Cohort Applications
feature (ADR-0009, ADR-0010): a polished, narrative public landing experience that presents
itself as Tech Impact Fellowship, plus the admin-side search/filter/bulk-action tooling its
application queue was missing.

## Decisions

1. **The landing page is vanilla HTML/CSS/JS, served as a static asset from `apps/web/public/`,
   not a new React route.** Placed at `apps/web/public/fellowship/{index.html,styles.css,script.js}`.
   Vite copies `public/` verbatim into `dist/` with zero transformation for anything other than
   `.html` files during **dev only** (confirmed live: `dist/fellowship/index.html` after a
   production build is byte-identical to the source file, and `vite preview` serves it with no
   framework injection at all). This satisfies "no large JavaScript bundle for the public page"
   literally — an anonymous visitor never downloads React. No `vite.config.ts` change was made or
   needed.
2. **Known dev-only quirk, not a bug**: under `pnpm dev:web`, visiting the bare directory path
   `/fellowship/` falls through to the SPA's history-fallback middleware instead of resolving to
   `fellowship/index.html`; the explicit `/fellowship/index.html` always serves correctly, and the
   bare `/fellowship/` path works correctly in both `vite preview` and any standard static host.
   Use the explicit path during local dev.
3. **The application form stays inside the vanilla page and calls the existing public API
   directly** (`GET /public/fellowships`, `POST /public/cohort-applications`) rather than linking
   out to the existing React `/apply` page mid-journey. Both endpoints already existed, unmodified,
   from ADR-0010 — no parallel application system, no duplicated validation. This keeps one
   consistent design language from hero to confirmation instead of handing the visitor to a
   differently-styled page for the one action that matters most.
4. **The public catalog fed to this page is the same genuinely cross-tenant `GET
   /public/fellowships` ADR-0010 built for the generic `/apply` picker — not narrowed to Tech
   Impact Fellowship's organization specifically**, because the response shape has no organization
   identifier to filter on and adding one would mean changing an existing, tested, deliberately
   cross-tenant public contract for a scope item that doesn't require it. In the platform's
   current single-tenant-in-practice state this is a non-issue (there is exactly one organization
   with public fellowships), but it is a disclosed narrowing: if a second organization ever also
   marks a fellowship public, this Tech-Impact-Fellowship-branded page would start listing their
   tracks and cohorts too. See `docs/KNOWN_TECHNICAL_DEBT.md`.
5. **No build-time environment injection for the static page's API base URL.** `apps/web/src`
   gets `VITE_API_BASE_URL` from Vite's env handling; a plain static asset in `public/` gets none.
   `script.js` hardcodes the same default the React client falls back to
   (`http://localhost:3000/api/v1`) behind a `window.FELLOWSHIP_API_BASE_URL` override point. A
   real deployment serving this page from a different origin than the API needs that one line (or
   the override global) set. Disclosed, not fixed here — no existing mechanism in this repo injects
   env values into `public/` assets, and building one is a bigger, separately-scoped change.
6. **Admin cohort-application search/filter/bulk actions extend the existing `CohortApplicationsService`
   and `CohortApplicationsRepository` in place** — a `q`/`fellowshipId` filter alongside the
   existing `status` filter (same `contains`/`insensitive` pattern `AdminUsersRepository` already
   uses), and `bulkApprove`/`bulkReject` methods that loop the exact same per-item `approve()`/
   `reject()` the single-item admin actions already call. Each item is independently
   version-checked and independently reported; one bad row (stale version, capacity reached)
   never aborts the rest of the batch. This is a real server-side bulk operation (one HTTP
   request, one controller action) as required, not N frontend requests — it just doesn't need a
   database-level bulk statement, because `approve()`'s four-service orchestration (identity +
   organizations + cohorts) has no bulk-capable equivalent to call instead.

## Consequences

- No new database tables, columns, or migrations. `CohortApplication` (ADR-0010) already models
  every state this page's application form produces.
- No new permissions. Bulk approve/reject are gated by the same `cohort.application.manage`
  already required for the single-item actions.
- The public marketing site and the authenticated React app remain two genuinely separate
  frontends sharing one backend — exactly the boundary this scope item asked for. Nothing in
  `apps/web/src` (the authenticated portals) was restyled or restructured.
- Live-verified end-to-end against a real database: academy → fellowship → learning track →
  cohort created and published via the real admin API, a submission through the public endpoint,
  admin search/filter, a bulk-approve (including a deliberately-invalid id to confirm per-item
  failure reporting), a bulk-reject, and confirmation that the approved application produced a
  real user + enrollment. Unauthenticated and under-privileged access to the admin endpoints were
  both confirmed rejected.
