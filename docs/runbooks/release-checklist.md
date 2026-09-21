# Release Checklist

A repeatable checklist for every future release after the initial production launch (see
`docs/PRODUCTION_LAUNCH_CHECKLIST.md` for the one-time launch checklist specifically).

## Before merging

- [ ] `pnpm lint` passes
- [ ] `pnpm format` passes (no unrelated files newly failing — see
      `docs/KNOWN_TECHNICAL_DEBT.md` DEBT-041 for one pre-existing, deliberately-untouched exception)
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes — check the actual numbers, not just exit code (compare suite/test counts
      against the previous known-good run; a silently-skipped or newly-excluded test is a regression)
- [ ] `pnpm build` succeeds for both `apps/api` and `apps/web`
- [ ] Any new migration reviewed for: additive-only where possible, correct indexes, correct
      cascade/restrict behavior, applies cleanly via `prisma migrate deploy`
- [ ] Any new environment variable added to `.env.example` with a real placeholder and documented in
      `docs/runbooks/environment-configuration.md`
- [ ] Any new architectural decision recorded in `docs/ENGINEERING_DECISIONS.md` or a new ADR
- [ ] CI is green on the PR (`.github/workflows/ci.yml`)

## Before deploying to production

- [ ] Migration reviewed for whether it's backward-compatible with the currently-running API version
      (expand → deploy → backfill → contract for anything non-additive — see
      `docs/system-architecture.md` §14)
- [ ] Confirm the target environment's variables are current (no drift from
      `docs/runbooks/environment-configuration.md`)
- [ ] Confirm no development/test-only code, credentials, or seed scripts are part of what's deploying

## Deploy

Follow `docs/runbooks/production-deployment.md`'s Deploy steps exactly, in order.

## After deploying

- [ ] Run `docs/runbooks/production-deployment.md`'s Verify steps
- [ ] Watch logs for the first few minutes for unexpected errors
- [ ] Confirm `GET /health` and `GET /health/ready` both report healthy
- [ ] Spot-check the specific feature/fix this release shipped, against real (not synthetic) usage
      where possible

## If something goes wrong

Follow `docs/runbooks/production-deployment.md`'s Roll Back section, then
`docs/runbooks/incident-recovery.md` for the specific symptom.
