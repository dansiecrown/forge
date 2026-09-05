-- CreateEnum
CREATE TYPE "CohortApplicationStatus" AS ENUM ('pending', 'approved', 'rejected', 'withdrawn');

-- CreateTable
CREATE TABLE "cohort_applications" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "academy_id" TEXT NOT NULL,
    "fellowship_id" TEXT NOT NULL,
    "cohort_id" TEXT NOT NULL,
    "applicant_user_id" TEXT,
    "prospect_email" TEXT,
    "prospect_display_name" TEXT,
    "requested_learning_track_id" TEXT,
    "note" TEXT,
    "status" "CohortApplicationStatus" NOT NULL DEFAULT 'pending',
    "reviewed_by_user_id" TEXT,
    "reviewed_at" TIMESTAMPTZ(3),
    "rejection_reason" TEXT,
    "resulting_user_id" TEXT,
    "resulting_enrollment_id" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "cohort_applications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cohort_applications_resulting_enrollment_id_key" ON "cohort_applications"("resulting_enrollment_id");

-- CreateIndex
CREATE INDEX "cohort_applications_organization_id_status_idx" ON "cohort_applications"("organization_id", "status");

-- CreateIndex
CREATE INDEX "cohort_applications_academy_id_status_idx" ON "cohort_applications"("academy_id", "status");

-- CreateIndex
CREATE INDEX "cohort_applications_applicant_user_id_idx" ON "cohort_applications"("applicant_user_id");

-- CreateIndex
CREATE INDEX "cohort_applications_cohort_id_idx" ON "cohort_applications"("cohort_id");

-- AddForeignKey
ALTER TABLE "cohort_applications" ADD CONSTRAINT "cohort_applications_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cohort_applications" ADD CONSTRAINT "cohort_applications_academy_id_fkey" FOREIGN KEY ("academy_id") REFERENCES "academies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cohort_applications" ADD CONSTRAINT "cohort_applications_fellowship_id_fkey" FOREIGN KEY ("fellowship_id") REFERENCES "fellowships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cohort_applications" ADD CONSTRAINT "cohort_applications_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "cohorts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cohort_applications" ADD CONSTRAINT "cohort_applications_applicant_user_id_fkey" FOREIGN KEY ("applicant_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cohort_applications" ADD CONSTRAINT "cohort_applications_requested_learning_track_id_fkey" FOREIGN KEY ("requested_learning_track_id") REFERENCES "learning_tracks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cohort_applications" ADD CONSTRAINT "cohort_applications_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cohort_applications" ADD CONSTRAINT "cohort_applications_resulting_user_id_fkey" FOREIGN KEY ("resulting_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cohort_applications" ADD CONSTRAINT "cohort_applications_resulting_enrollment_id_fkey" FOREIGN KEY ("resulting_enrollment_id") REFERENCES "enrollments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Hand-written: Prisma's schema DSL cannot express partial indexes or CHECK
-- constraints — same pattern as the partial indexes in
-- 20260725162854_multi_tenant_foundation/migration.sql (roles, cohort_mentors)
-- and 20260727171814_mentor_experience/migration.sql.

-- At most one PENDING application per (cohort, prospect email) — prevents a
-- prospect from double-applying to the same cohort while a decision is
-- outstanding. Resubmission after rejection/withdrawal is intentionally
-- unrestricted (this index only constrains status = 'pending' rows).
CREATE UNIQUE INDEX "cohort_applications_pending_prospect_key"
  ON "cohort_applications" ("cohort_id", "prospect_email")
  WHERE "status" = 'pending' AND "prospect_email" IS NOT NULL;

-- At most one PENDING application per (cohort, applicant user) — the
-- authenticated-student equivalent of the index above.
CREATE UNIQUE INDEX "cohort_applications_pending_applicant_key"
  ON "cohort_applications" ("cohort_id", "applicant_user_id")
  WHERE "status" = 'pending' AND "applicant_user_id" IS NOT NULL;

-- Exactly one of applicant_user_id / prospect_email is set, never both,
-- never neither — an application always has exactly one applicant identity.
ALTER TABLE "cohort_applications" ADD CONSTRAINT "cohort_applications_applicant_xor_prospect_check"
  CHECK (("applicant_user_id" IS NOT NULL) <> ("prospect_email" IS NOT NULL));
