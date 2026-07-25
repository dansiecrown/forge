-- CreateEnum
CREATE TYPE "AcademyStatus" AS ENUM ('active', 'archived');

-- CreateEnum
CREATE TYPE "FellowshipStatus" AS ENUM ('draft', 'published', 'retired');

-- CreateEnum
CREATE TYPE "CohortStatus" AS ENUM ('draft', 'enrolling', 'active', 'paused', 'completed', 'archived');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('invited', 'active', 'paused', 'completed', 'withdrawn');

-- AlterTable
ALTER TABLE "memberships" ADD COLUMN     "academy_id" TEXT;

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "branding" JSONB,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "custom_domain" TEXT,
ADD COLUMN     "data_region" TEXT NOT NULL DEFAULT 'africa-west',
ADD COLUMN     "default_timezone" TEXT NOT NULL DEFAULT 'Africa/Lagos',
ADD COLUMN     "legal_name" TEXT,
ADD COLUMN     "logo_asset_id" TEXT,
ADD COLUMN     "settings" JSONB,
ADD COLUMN     "settings_version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "support_email" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "academies" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "AcademyStatus" NOT NULL DEFAULT 'active',
    "description" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Lagos',
    "branding" JSONB,
    "contact_email" TEXT,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "academies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fellowships" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "academy_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "FellowshipStatus" NOT NULL DEFAULT 'draft',
    "duration_weeks" INTEGER NOT NULL,
    "description" TEXT,
    "summary" TEXT,
    "default_capacity" INTEGER,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "registration_opens_at" TIMESTAMPTZ(3),
    "registration_closes_at" TIMESTAMPTZ(3),
    "eligibility_metadata" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "fellowships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cohorts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "academy_id" TEXT NOT NULL,
    "fellowship_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "CohortStatus" NOT NULL DEFAULT 'draft',
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "timezone" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "description" TEXT,
    "enrollment_deadline" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "cohorts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cohort_mentors" (
    "id" TEXT NOT NULL,
    "cohort_id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "assigned_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unassigned_at" TIMESTAMPTZ(3),

    CONSTRAINT "cohort_mentors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrollments" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "academy_id" TEXT NOT NULL,
    "fellowship_id" TEXT NOT NULL,
    "cohort_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'invited',
    "invited_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "joined_at" TIMESTAMPTZ(3),
    "ended_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "academies_organization_id_status_idx" ON "academies"("organization_id", "status");

-- CreateIndex
CREATE INDEX "fellowships_academy_id_status_idx" ON "fellowships"("academy_id", "status");

-- CreateIndex
CREATE INDEX "cohorts_organization_id_status_starts_at_idx" ON "cohorts"("organization_id", "status", "starts_at");

-- CreateIndex
CREATE INDEX "cohorts_fellowship_id_status_idx" ON "cohorts"("fellowship_id", "status");

-- CreateIndex
CREATE INDEX "cohort_mentors_membership_id_idx" ON "cohort_mentors"("membership_id");

-- CreateIndex
CREATE INDEX "enrollments_user_id_idx" ON "enrollments"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "enrollments_cohort_id_user_id_key" ON "enrollments"("cohort_id", "user_id");

-- CreateIndex
CREATE INDEX "memberships_academy_id_idx" ON "memberships"("academy_id");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_custom_domain_key" ON "organizations"("custom_domain");

-- CreateIndex
CREATE INDEX "organizations_status_created_at_idx" ON "organizations"("status", "created_at");

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_academy_id_fkey" FOREIGN KEY ("academy_id") REFERENCES "academies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academies" ADD CONSTRAINT "academies_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fellowships" ADD CONSTRAINT "fellowships_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fellowships" ADD CONSTRAINT "fellowships_academy_id_fkey" FOREIGN KEY ("academy_id") REFERENCES "academies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cohorts" ADD CONSTRAINT "cohorts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cohorts" ADD CONSTRAINT "cohorts_academy_id_fkey" FOREIGN KEY ("academy_id") REFERENCES "academies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cohorts" ADD CONSTRAINT "cohorts_fellowship_id_fkey" FOREIGN KEY ("fellowship_id") REFERENCES "fellowships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cohort_mentors" ADD CONSTRAINT "cohort_mentors_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "cohorts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cohort_mentors" ADD CONSTRAINT "cohort_mentors_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_fellowship_id_fkey" FOREIGN KEY ("fellowship_id") REFERENCES "fellowships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "cohorts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Partial unique indexes (docs/database-design.md's documented "WHERE
-- deleted_at IS NULL" constraints for Academy/Fellowship/Cohort slugs, and
-- the Milestone 3 "one active/pending Enrollment per Fellowship" and "one
-- active CohortMentor assignment" rules). Prisma's schema DSL cannot express
-- a WHERE clause on @@unique, so these are hand-written here instead of
-- generated — same pattern as the identity/RBAC migration's roles/
-- membership_roles partial indexes.

-- CreateIndex: an academy's slug is unique among its organization's active academies.
CREATE UNIQUE INDEX "academies_org_slug_active_key" ON "academies" ("organization_id", "slug") WHERE "deleted_at" IS NULL;

-- CreateIndex: a fellowship's slug is unique among its academy's active fellowships.
CREATE UNIQUE INDEX "fellowships_academy_slug_active_key" ON "fellowships" ("organization_id", "academy_id", "slug") WHERE "deleted_at" IS NULL;

-- CreateIndex: a cohort's slug is unique among its academy's active cohorts.
CREATE UNIQUE INDEX "cohorts_academy_slug_active_key" ON "cohorts" ("academy_id", "slug") WHERE "deleted_at" IS NULL;

-- CreateIndex: a mentor can only be actively assigned to a cohort once.
CREATE UNIQUE INDEX "cohort_mentors_active_assignment_key" ON "cohort_mentors" ("cohort_id", "membership_id") WHERE "unassigned_at" IS NULL;

-- CreateIndex: a student may hold only one active or pending Enrollment per
-- Fellowship at a time (Milestone 3 brief, Part E) — enforced at the
-- database level, not just in application code.
CREATE UNIQUE INDEX "enrollments_fellowship_active_progression_key" ON "enrollments" ("fellowship_id", "user_id") WHERE "status" IN ('invited', 'active', 'paused');

-- A cohort's end must be after its start (docs/database-design.md's
-- documented Cohort chronology rule).
ALTER TABLE "cohorts" ADD CONSTRAINT "cohorts_chronology_check" CHECK ("ends_at" > "starts_at");
