# ADR-0004: Premium dark-first design system

**Status:** Accepted
**Date:** 2026-07-22
**Owner:** Lead Engineering

## Context

A design-refinement request asked for a specific visual direction — pure-black-based, dark-by-default, restrained accent colour, and selective glassmorphism inspired by Linear/Vercel/Raycast/Stripe — for the existing authentication UI.

`docs/product-design-specification.md` §7 already documented a different, specific token set that the implementation matched exactly: a light canvas (`#F7F8FA`) as the base background, a brand blue (`#315EFB`) used broadly, and no mention of glassmorphism at all. Per this repo's source-of-truth discipline, that is a genuine documentation conflict, not a simple styling tweak, so it was raised with the product owner before implementation. The product owner chose to adopt the new direction and have the documentation updated to match, rather than fit the new direction inside the old tokens.

This ADR records that decision and the concrete token/contrast work it required. Scope stayed limited to visual refinement of the components and pages that already exist (Button, Card, Input, Label, Alert, FormField, AuthLayout, sign-in/forgot-password/reset-password/unauthorized/home pages) — no new components, routes, or backend/API changes were introduced.

## Decisions

1. **Dark is the default theme; light mode follows `prefers-color-scheme: light`.** No manual theme toggle was built — that would be new interactive functionality (state, persistence, a settings surface) beyond a visual refinement. Respecting the OS preference via a CSS media query satisfies "light mode fully supported" without adding one.
2. **Brand and danger are split into a text-use token and a `-solid` fill token in dark mode.** A single lightness value cannot pass WCAG AA (4.5:1) against both a near-black canvas (used for link/icon/inline-text colour) and a white button label (used for solid CTA fills) simultaneously — the two roles sit against different backgrounds. Concrete values were chosen and hand-verified against the WCAG relative-luminance formula:
   - `--brand` (text/link/focus use) `hsl(227 92% 66%)` ≈ 5.6:1 against black.
   - `--brand-solid` (button fill, white text) `hsl(227 88% 58%)` ≈ 5.2:1 against white.
   - `--danger` (text/icon use) `hsl(4 76% 60%)` — comfortably clears 4.5:1 against black.
   - `--danger-solid` (destructive button fill, white text) `hsl(4 76% 42%)` — comfortably clears 4.5:1 against white.
   Light mode reuses a single value per colour for both roles, since both already sit against similarly light surfaces and the original tokens were already AA-validated. Success and warning were not split — neither is currently used as a solid fill anywhere in the codebase, only as text/icon tint.
3. **Glassmorphism is opt-in, not structural.** `Card` gained a `glass?: boolean` prop (default `false`) backed by a new `.glass-panel` CSS class (theme-tinted low-opacity background, soft border, backdrop blur, near-invisible shadow). Only the three auth pages (sign-in, forgot-password, reset-password) pass `glass`. No dialog/dropdown/popover/toast/command-palette components exist in this codebase yet — the token and utility class are ready for them, but building those components now would be new functionality outside this task's scope.
4. **Radii were bumped modestly** (control 8→10px, card 12→16px, modal 16→20px) for a softer, more premium feel without becoming rounded/playful.
5. **Shadows were rebuilt as a single theme-aware `shadow-subtle` token** (`hsl(var(--shadow-color) / …)`) instead of Tailwind's default grey `shadow-sm`, so elevation reads correctly on both a near-black and a light canvas; on dark surfaces this is intentionally almost invisible, matching the "depth comes from spacing/contrast/glass, not shadow" brief.

## Addendum — 2026-07-22: monochrome primary button

After testing the live sign-in and forgot-password pages, the product owner didn't like the primary button's blue solid fill. On reflection it was inconsistent with this ADR's own inspiration set — Linear, Vercel, and Raycast all use a monochrome primary button (inverted foreground/background fill) and keep colour reserved for links, focus, and state, rather than a bright accent-colour CTA — and with the brief's "accent colours used sparingly, only for active states, focus, success, warnings, critical actions" rule, which a large blue button arguably violated.

Changed `buttonVariants.primary` from `bg-brand-solid text-white` to `bg-foreground text-background` (white-on-near-black in dark mode, near-black-on-white in light mode) with `hover:opacity-90`. This is theme-aware automatically since it reuses the existing `--ink`/`--canvas` tokens rather than new ones.

This removed the only place brand colour was ever used as a solid fill, so the `--brand-solid`/`--brand-solid-hover` tokens (and the matching `brand.solid`/`brand.solid-hover` Tailwind keys) were deleted as dead complexity — `--brand` reverted to a single tone, now used only for links, the focus-adjacent ambient glow on the auth layout, and the text-selection colour. `--danger`/`--danger-solid` were kept as a pair: the destructive button is still the one place a coloured solid fill remains, and that role still has the same text-vs-white-label contrast conflict this ADR originally solved for.

## Consequences

- Every component built with the existing semantic classes (`bg-surface`, `text-foreground`, `border-border`, `rounded-card`, etc.) inherits the new look automatically — no per-page theming work is needed as future milestones add pages.
- `docs/product-design-specification.md` §7 was rewritten to document the dark/light token pairs, the brand/danger split rationale, and the glass usage boundary, so it now matches the implementation exactly (the same discipline this ADR itself required).
- Future floating-surface components (modals, dropdowns, popovers, toasts, command palette) should use `.glass-panel` when built, per the documented list — this is noted for whoever builds them, not built preemptively here.
- No backend, API, or routing changes were made; this ADR is scoped entirely to `apps/web` presentation.
