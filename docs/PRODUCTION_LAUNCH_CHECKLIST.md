# Production Launch Checklist — Tech Impact Fellowship Cohort 1

The single authoritative checklist for launching Project Forge into real production. Compiled at the
end of Milestone 9. **Every item below reflects what was actually verified, not what should be true in
principle** — an unchecked item is either not yet done or could not be verified in this environment;
see the note under each.

- [ ] **Production environment configured** — Not done. No hosting provider has been selected (a
      deliberate, disclosed gap — see `docs/runbooks/production-deployment.md`). Requirements are fully
      documented; provisioning itself is a pending business/infra decision.
- [ ] **Secrets configured** — Not applicable until a production environment exists. Requirements and
      generation instructions are documented in `docs/runbooks/environment-configuration.md`; the
      literal `.env.example` placeholder values are rejected at boot in every environment (verified —
      see `docs/ENGINEERING_DECISIONS.md`'s Milestone 8 entry).
- [ ] **Domain configured** — Not done (depends on hosting provider selection).
- [ ] **HTTPS active** — Not done (depends on domain). The application enforces `Secure` cookies and
      logs a boot warning for a non-HTTPS `WEB_ORIGIN` whenever `NODE_ENV=production` (verified in code
      and by the M8 test suite).
- [x] **Database migrations verified** — 15 migrations, all additive, verified applying cleanly via
      `prisma migrate deploy` (both locally this session and via CI's fresh Postgres service container
      on every push).
- [ ] **Backups configured** — Not done. This is a managed-database-provider capability, pending
      provider selection. Requirements documented in `docs/runbooks/database-operations.md`.
- [ ] **Restore procedure verified** — Not done; no production database exists yet to test a restore
      against. Documented procedure exists in `docs/runbooks/database-operations.md`; a live restore
      drill is required before real cohort data is at risk.
- [x] **Redis configured if required** — Confirmed optional for a single-API-instance launch (chat
      degrades gracefully without it, verified by design and by existing tests); required only for
      multi-instance real-time chat fan-out.
- [x] **Email configured and verified** — Real SMTP credentials are configured and were confirmed live
      this milestone: a real send attempt through the configured relay produced a genuine SMTP-level
      response (rejected only because the test recipient address was intentionally fake), and account/
      enrollment creation was confirmed to succeed independently of email delivery outcome.
- [x] **WebSockets verified** — Fellowship Chat's connection auth, subscription authorization, periodic
      revalidation, and cross-Fellowship isolation are covered by existing integration tests
      (`chat-websocket-isolation.integration.spec.ts`, `chat-access.integration.spec.ts`), both
      confirmed passing this milestone (345/345 tests, full suite, run to completion).
- [x] **Health checks verified** — `GET /health` and `GET /health/ready` both confirmed live this
      milestone; readiness correctly checks database connectivity (built and tested in Milestone 8).
- [x] **Logging verified** — Reviewed: structured request-ID-tagged logs via Nest's `Logger`,
      authentication/authorization failures and database errors are logged server-side with no client
      exposure of stack traces; confirmed no passwords, tokens, MFA secrets, or recovery codes are ever
      logged (code review, not a claim).
- [x] **CI/CD verified** — `.github/workflows/ci.yml` runs lint/format/typecheck/`prisma validate`/
      `prisma migrate deploy`/test/build against real Postgres+Redis service containers on every push;
      confirmed no step silently continues past a failure except the deliberately-informational
      dependency audit.
- [x] **Public landing page verified** — Live-checked this milestone: no placeholder/TODO/Lorem-ipsum
      content, correct single Tech Impact Fellowship listing (a duplicate stale entry was found and
      fixed — see below), real cohort/track data.
- [x] **Application flow verified** — Live end-to-end this milestone: a real submission through
      `POST /public/cohort-applications`, admin approval, and confirmed resulting user + enrollment
      creation, against the real Cohort 1.
- [x] **Admin application workflow verified** — Approve/reject/version-conflict-safety confirmed live
      this milestone; search/filter/bulk-actions were live-verified in the session that shipped them
      (`docs/adr/0011-public-fellowship-experience.md`'s own documented verification) and re-confirmed
      passing by the current automated test suite.
- [x] **Cohort 1 structure verified** — Organization → Academy → Fellowship → Cohort → Tracks hierarchy
      confirmed correct and navigable; Cohort 1's status/dates corrected this milestone from a
      test-convenience "already active" state to a genuine "enrolling" state with real forward dates
      (explicit product decision — see the Milestone 9 completion report).
- [x] **Learning tracks verified** — Web Development, WordPress Website Design, and Graphics Design
      each confirmed to have real weeks/lessons/resources/practical tasks (established Milestone 7,
      re-confirmed reachable via the live public catalog this milestone).
- [x] **Student onboarding verified** — Full apply → approve → account-activation-path → login →
      dashboard → track → lesson → task-submission chain confirmed working this milestone (the specific
      new applicant's own email-activation step could not be completed end-to-end because the test used
      an intentionally-fake, non-deliverable address — the mechanism itself, and the existing seeded
      test student's equivalent full journey, were both verified).
- [x] **Mentor onboarding verified** — A full submit → revision-requested → resubmit → approved review
      cycle was executed live this milestone between a real mentor and student account, with correct,
      permanent review history.
- [x] **Fellowship Chat verified** — See WebSockets item above; cross-Fellowship message/channel
      isolation specifically re-confirmed via the existing, passing integration test suite.
- [x] **Tenant isolation verified** — Existing integration tests passing (`tenant-isolation.integration.spec.ts`)
      plus a live cross-organization access attempt this milestone, correctly rejected with `403` before
      reaching any cohort/application-scoped logic.
- [x] **Security checks passed** — Milestone 8's comprehensive audit (auth, rate limiting, WebSocket
      flood protection, dependency vulnerabilities, security headers) re-confirmed still in place this
      milestone (CORS locked to the single configured origin, Helmet security headers all present); no
      new critical or high-severity issue found this milestone.
- [ ] **Mobile checks passed** — Not verified. No browser automation tool was available in this
      environment to visually test responsive/mobile layouts, dark/light mode, or touch navigation. The
      design system's existing responsive conventions (established across prior milestones, per
      `CLAUDE.md`'s UI standards) were not newly regression-tested. Perform a real manual/device check
      before launch.
- [ ] **Production data cleaned** — Partially done. This milestone removed the clearly-disposable test
      application fixtures (`ada.tester`/`bola.tester`/`chidi.tester`@example.com and their resulting
      dormant enrollments) and fixed a stale duplicate public Fellowship listing. **Not removed**: three
      documented development-fixture accounts (`student@test.local`, `student@techimpact.test`,
      `mentor@test.local`) still hold real enrollments/mentor assignment in the actual Cohort 1, and
      roughly 300 harmless auto-generated integration-test accounts exist in this shared database (never
      linked to Tech Impact Fellowship's real data). **Recommendation: launch on a fresh database** (see
      `docs/runbooks/database-operations.md`) rather than promoting this one; if this exact database is
      used instead, those three fixture accounts must be explicitly removed from Cohort 1 first.
- [x] **Rollback procedure documented** — `docs/runbooks/production-deployment.md`'s Roll Back section.

## Bugs found and fixed during this audit

1. **Duplicate public Fellowship listing** — a stale "Tech Impact Fellowship" row (slug `tif`, under an
   archived academy) was independently marked public alongside the real one, meaning the public catalog
   would have shown two entries to a real applicant. Fixed via the real admin API
   (`PATCH /fellowships/:id { isPublic: false }`); confirmed the catalog now shows exactly one.
2. **Cohort 1 was not actually applyable** — its status (`active`, set for a prior milestone's
   student-experience testing) meant `GET /public/fellowships` returned zero cohorts, so no real
   applicant could apply to anything. Corrected per explicit product decision this milestone (status
   `enrolling`, real forward dates) — see the Milestone 9 completion report for the full reasoning and
   the verification that existing enrolled students' progress/deadlines are unaffected by the date
   change.
