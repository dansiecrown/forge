-- CreateEnum
CREATE TYPE "HuddleAttendanceStatus" AS ENUM ('present', 'absent', 'excused');

-- CreateEnum
CREATE TYPE "SubmissionReviewDecision" AS ENUM ('revision_requested', 'approved');

-- RenameTable
-- Hand-written in place of Prisma's destructive drop/recreate diff: this is a
-- pure rename (see docs/adr/0008-mentor-experience.md Decision 4), not a
-- schema change to existing data. The primary key, the user_id unique index,
-- and the user_id foreign key constraint all carry over unchanged under
-- their old (student_profiles_*) names — Postgres and Prisma both work
-- correctly with a cosmetically-mismatched constraint/index name.
ALTER TABLE "student_profiles" RENAME TO "user_profiles";

-- AlterTable
ALTER TABLE "user_profiles" ADD COLUMN     "availability" TEXT;

-- CreateTable
CREATE TABLE "huddle_sessions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "cohort_id" TEXT NOT NULL,
    "week_number" INTEGER NOT NULL,
    "notes" TEXT,
    "discussion_topics" TEXT[],
    "action_items" TEXT[],
    "created_by_membership_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "huddle_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "huddle_attendance" (
    "id" TEXT NOT NULL,
    "huddle_session_id" TEXT NOT NULL,
    "enrollment_id" TEXT NOT NULL,
    "status" "HuddleAttendanceStatus" NOT NULL,
    "recorded_by_membership_id" TEXT NOT NULL,
    "recorded_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "huddle_attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentor_notes" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "cohort_id" TEXT NOT NULL,
    "enrollment_id" TEXT NOT NULL,
    "author_membership_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "mentor_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submission_reviews" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "practical_task_submission_id" TEXT NOT NULL,
    "reviewer_membership_id" TEXT NOT NULL,
    "status" "SubmissionReviewDecision" NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submission_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "huddle_sessions_cohort_id_week_number_key" ON "huddle_sessions"("cohort_id", "week_number");

-- CreateIndex
CREATE INDEX "huddle_attendance_enrollment_id_idx" ON "huddle_attendance"("enrollment_id");

-- CreateIndex
CREATE UNIQUE INDEX "huddle_attendance_huddle_session_id_enrollment_id_key" ON "huddle_attendance"("huddle_session_id", "enrollment_id");

-- CreateIndex
CREATE INDEX "mentor_notes_enrollment_id_created_at_idx" ON "mentor_notes"("enrollment_id", "created_at");

-- CreateIndex
CREATE INDEX "submission_reviews_practical_task_submission_id_created_at_idx" ON "submission_reviews"("practical_task_submission_id", "created_at");

-- AddForeignKey
ALTER TABLE "huddle_sessions" ADD CONSTRAINT "huddle_sessions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "huddle_sessions" ADD CONSTRAINT "huddle_sessions_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "cohorts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "huddle_sessions" ADD CONSTRAINT "huddle_sessions_created_by_membership_id_fkey" FOREIGN KEY ("created_by_membership_id") REFERENCES "memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "huddle_attendance" ADD CONSTRAINT "huddle_attendance_huddle_session_id_fkey" FOREIGN KEY ("huddle_session_id") REFERENCES "huddle_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "huddle_attendance" ADD CONSTRAINT "huddle_attendance_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "huddle_attendance" ADD CONSTRAINT "huddle_attendance_recorded_by_membership_id_fkey" FOREIGN KEY ("recorded_by_membership_id") REFERENCES "memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_notes" ADD CONSTRAINT "mentor_notes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_notes" ADD CONSTRAINT "mentor_notes_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "cohorts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_notes" ADD CONSTRAINT "mentor_notes_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_notes" ADD CONSTRAINT "mentor_notes_author_membership_id_fkey" FOREIGN KEY ("author_membership_id") REFERENCES "memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_reviews" ADD CONSTRAINT "submission_reviews_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_reviews" ADD CONSTRAINT "submission_reviews_practical_task_submission_id_fkey" FOREIGN KEY ("practical_task_submission_id") REFERENCES "practical_task_submissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_reviews" ADD CONSTRAINT "submission_reviews_reviewer_membership_id_fkey" FOREIGN KEY ("reviewer_membership_id") REFERENCES "memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
