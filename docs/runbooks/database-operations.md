# Database Operations Guide

## Migrations

15 migrations exist, all additive (no `DROP TABLE`/`DROP COLUMN` in any of them — verified by grepping
every `migration.sql`), applied in this order:

```
20260721231427_identity_and_access_control
20260723072350_add_missing_fk_indexes
20260725162854_multi_tenant_foundation
20260725221837_curriculum_learning_engine
20260726232514_student_experience
20260727171814_mentor_experience
20260730090000_administration_platform
20260730230714_cohort_applications
20260904220035_fix_user_profiles_drift
20260904221500_fellowship_chat
20260905120000_cohort_scoped_tracks
20260905160000_track_switch_grace_period
20260906013000_user_username
20260907010000_direct_messaging
20260912200000_add_track_chat_channels
```

**Apply migrations:**

```sh
pnpm --filter @forge/api exec prisma migrate deploy
```

Safe to run repeatedly — only applies migrations not already recorded in the database's
`_prisma_migrations` table. This is the command CI now runs against a fresh Postgres container on
every push (`.github/workflows/ci.yml`), so a from-scratch clean-database apply is verified on every
commit, not just claimed.

**Validate the schema file itself** (no database connection needed beyond resolving `DATABASE_URL`,
catches syntax/semantic errors in `schema.prisma` before they'd surface as a failed migration):

```sh
pnpm --filter @forge/api exec prisma validate
```

**Never hand-edit an already-applied migration file.** If a migration needs correcting, create a new
migration that makes the correction — `pnpm --filter @forge/api exec prisma migrate dev --name <description>`
in a development environment, then commit the generated SQL. Editing history breaks `migrate deploy`'s
checksum verification for anyone who already applied the original.

## What's required system configuration vs. seed/demo data

| Category | What it is | Where it comes from | Required for the app to boot/function |
| --- | --- | --- | --- |
| **Required system configuration** | Permission catalogue (`Permission` rows), the five system roles (`Role` rows: `SUPER_ADMIN`, `ORG_ADMIN`, `ACADEMY_ADMIN`, `MENTOR`, `STUDENT`), `SystemSettings` singleton row | `prisma/seeds/identity.seed.ts` | **Yes** — authorization has nothing to check permissions against without this. Run once per environment, safe to re-run (idempotent upserts). |
| **Bootstrap Super Admin** | One `User` + `Membership` + role grant | `identity.seed.ts`, only if `SEED_SUPER_ADMIN_EMAIL`/`PASSWORD` are set | Not required for the app to boot, but required for anyone to be able to administer a fresh installation — see "First Super Admin" in `docs/runbooks/environment-configuration.md`. |
| **Demo/development seed data** | `prisma/seeds/dev-test-users.seed.ts` (Test Org Admin / Academy Admin / Mentor / Student, `*.test.local` emails, shared `TestPass123!` password) and `prisma/seeds/tech-impact-cohort1.seed.ts` (a full Tech Impact Fellowship Cohort 1: 3 tracks, 9 weeks of real content, plus one `student@techimpact.test` test account) | Explicit, separate scripts — never run automatically, never run by `identity.seed.ts` | **No.** Documented in README as development-only. Must not run against a production database — see Production Data Safety below. |
| **Real Tech Impact Fellowship Cohort 1 data** | The actual Organization/Academy/Fellowship/Cohort/LearningTrack/Course/curriculum rows an admin creates for the real launch | Created via the real admin API/UI (or, if reusing this exact seed's output, `tech-impact-cohort1.seed.ts`'s Organization/Academy/Fellowship/tracks/curriculum rows plus the real applicant data that flows in through the public application system) | Not required for the *application* to boot, but is the actual product content the real launch depends on. See `docs/runbooks/admin-operations.md`. |

## Production database initialization process

For a genuinely fresh production database:

```sh
pnpm --filter @forge/api exec prisma migrate deploy   # 1. schema
pnpm --filter @forge/api prisma:seed                   # 2. permissions, roles, system settings, bootstrap Super Admin
```

That's it — a fresh production database starts with **no fellowships, no cohorts, no learning content,
no students, no mentors** beyond the one bootstrap Super Admin. Everything else (the real Tech Impact
Fellowship org/academy/fellowship/cohort, its 3 learning tracks and their curriculum, real students and
mentors) is created afterward by that Super Admin through the real, authenticated admin API/UI — see
`docs/runbooks/admin-operations.md` — or, if the team chooses to reuse the already-authored Cohort 1
curriculum content from `tech-impact-cohort1.seed.ts` rather than re-author it through the admin UI,
that script may be run once against the fresh production database as a **content-authoring shortcut**
(it seeds real curriculum content, not fake data) — but its **test student account
(`student@techimpact.test`)** must then be treated as a development fixture even in that case: remove
its enrollment (or the whole account) before real applicants are onboarded. See Production Data Safety.

Do **not** run `dev-test-users.seed.ts` against a production database under any circumstance — every
account it creates shares a single, publicly-documented password.

## Backup and recovery

**Current state: backup automation is not implemented in this repository** — no hosting provider has
been selected yet (see `docs/runbooks/production-deployment.md`), and automated backups are a
capability of the *managed database provider*, not application code. This section documents the exact
requirement so it isn't silently skipped once a provider is chosen.

| Requirement | Specification |
| --- | --- |
| Backup frequency | Continuous point-in-time recovery (PITR) if the chosen managed Postgres provider supports it, or at minimum daily full snapshots. |
| Retention | At minimum 30 days of daily backups; align with the provider's PITR window if using one. |
| Backup location | Provider-managed storage, in a different failure domain than the primary database (this is standard for any managed Postgres offering — AWS RDS, GCP Cloud SQL, Supabase, Neon, Railway, etc. all provide this natively). |
| Restore procedure | Provider-specific (restore-to-point-in-time or restore-from-snapshot via the provider's console/CLI, producing a new database instance) — document the exact provider steps here once a provider is selected. |
| Who can perform restoration | Whoever holds production database admin access — name this explicitly once a team/on-call structure exists; do not leave it undefined. |
| Recovery verification | After any restore, run `pnpm --filter @forge/api exec prisma migrate deploy` (confirms the restored schema matches the current migration history) and the Verify steps in `docs/runbooks/production-deployment.md`, then spot-check that recent, expected data (a recent enrollment, a recent chat message) is actually present. |

**A live restore test was not performed** — there is no production database yet to test a restore
against, and this development environment's Postgres has no managed backup/restore tooling to exercise.
Perform and document a real restore drill as soon as a production database with a managed provider
exists, before the first real cohort's data is at risk.

## Production Data Safety — what this exact database currently contains (as of this milestone)

This repository's shared development database (used throughout Milestones 1–9's live verification) is
**not** a candidate for direct promotion to production as-is. A full audit this milestone found:

- Hundreds of auto-generated integration-test fixture accounts (`*@chat-access-test.local`,
  timestamp-suffixed), created by repeatedly running `*.integration.spec.ts` suites against this
  database rather than an isolated test database. Harmless (no real access, not linked to Tech Impact
  Fellowship's real org/cohort) but numerous.
- Two documented, intentional development fixture accounts still enrolled in the real Cohort 1:
  `student@test.local` ("Test Student," from `dev-test-users.seed.ts`) and `student@techimpact.test`
  ("Tech Impact Test Student," from `tech-impact-cohort1.seed.ts`) — both README-documented dev tools,
  not accidental pollution, but **must not remain enrolled once real applicants populate Cohort 1**.
  `mentor@test.local` similarly holds a real, active `CohortMentor` assignment to Cohort 1.
- A duplicate, stale "Tech Impact Fellowship" fellowship row (slug `tif`, under an archived academy)
  was found publicly listed alongside the real one — **fixed this milestone** (set `isPublic: false`
  via the real admin API), confirmed the public catalog now shows exactly one Tech Impact Fellowship.
- Several disposable test `CohortApplication` rows used to verify the admin review queue
  (`ada.tester@example.com`, `bola.tester@example.com`, `chidi.tester@example.com`, plus stale
  application history against `student@test.local`) — **removed this milestone**, along with the two
  resulting never-activated "invited" user enrollments they had created in Cohort 1.

**Recommendation:** launch production on a genuinely fresh database (migrations + `identity.seed.ts`
only), with the real Cohort 1 configured through the admin UI/API by a human operator (or by running
`tech-impact-cohort1.seed.ts` once for its curriculum content, then immediately removing its test
student per the note above). If this exact development database is instead promoted directly, the
`student@test.local` / `student@techimpact.test` / `mentor@test.local` fixtures and the ~300+ test
accounts must be explicitly removed first — see `docs/PRODUCTION_LAUNCH_CHECKLIST.md`.
