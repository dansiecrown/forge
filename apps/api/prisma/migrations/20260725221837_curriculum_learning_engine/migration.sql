-- CreateEnum
CREATE TYPE "CurriculumStatus" AS ENUM ('draft', 'published', 'archived');

-- CreateEnum
CREATE TYPE "TrackDifficulty" AS ENUM ('beginner', 'intermediate', 'advanced');

-- CreateEnum
CREATE TYPE "LessonType" AS ENUM ('video', 'article', 'documentation', 'reading', 'external_resource', 'live_session_reference', 'embedded_content');

-- CreateEnum
CREATE TYPE "LearningResourceType" AS ENUM ('udemy_course', 'youtube_video', 'official_documentation', 'github_repository', 'pdf', 'article', 'book', 'other');

-- AlterTable
ALTER TABLE "cohorts" ADD COLUMN     "curriculum_snapshot" JSONB,
ADD COLUMN     "curriculum_snapshot_at" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "enrollments" ADD COLUMN     "current_learning_track_id" TEXT;

-- CreateTable
CREATE TABLE "learning_tracks" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "fellowship_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "icon_metadata" JSONB,
    "difficulty" "TrackDifficulty" NOT NULL DEFAULT 'beginner',
    "estimated_weeks" INTEGER,
    "status" "CurriculumStatus" NOT NULL DEFAULT 'draft',
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "prerequisites_metadata" JSONB,
    "learning_outcomes" TEXT[],
    "tags" TEXT[],
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "learning_tracks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courses" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "learning_track_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "overview" TEXT,
    "objectives" TEXT[],
    "completion_criteria" TEXT,
    "estimated_hours" INTEGER,
    "status" "CurriculumStatus" NOT NULL DEFAULT 'draft',
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_modules" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "week_number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "objectives" TEXT[],
    "summary" TEXT,
    "estimated_study_hours" INTEGER,
    "requires_mentor_huddle" BOOLEAN NOT NULL DEFAULT false,
    "requires_practical_work" BOOLEAN NOT NULL DEFAULT false,
    "unlock_rules" JSONB,
    "huddle_schedule_metadata" JSONB,
    "huddle_meeting_link" TEXT,
    "mentor_huddle_notes" TEXT,
    "huddle_attendance_required" BOOLEAN NOT NULL DEFAULT false,
    "status" "CurriculumStatus" NOT NULL DEFAULT 'draft',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "weekly_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lessons" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "weekly_module_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "lesson_type" "LessonType" NOT NULL,
    "estimated_duration_minutes" INTEGER,
    "resource_url" TEXT,
    "attachment_metadata" JSONB,
    "embedded_content_metadata" JSONB,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "completion_required" BOOLEAN NOT NULL DEFAULT true,
    "status" "CurriculumStatus" NOT NULL DEFAULT 'draft',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_resources" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "weekly_module_id" TEXT NOT NULL,
    "lesson_id" TEXT,
    "resource_type" "LearningResourceType" NOT NULL,
    "url" TEXT,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "provider" TEXT,
    "estimated_duration_minutes" INTEGER,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "status" "CurriculumStatus" NOT NULL DEFAULT 'draft',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "learning_resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "practical_tasks" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "weekly_module_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "instructions" TEXT,
    "deliverables" TEXT[],
    "submission_type_metadata" JSONB,
    "due_offset_days" INTEGER,
    "rubric_metadata" JSONB,
    "max_score" INTEGER,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "status" "CurriculumStatus" NOT NULL DEFAULT 'draft',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "practical_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_completions" (
    "id" TEXT NOT NULL,
    "enrollment_id" TEXT NOT NULL,
    "lesson_id" TEXT NOT NULL,
    "completed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "lesson_completions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resource_acknowledgments" (
    "id" TEXT NOT NULL,
    "enrollment_id" TEXT NOT NULL,
    "resource_id" TEXT NOT NULL,
    "acknowledged_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "resource_acknowledgments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "practical_task_submissions" (
    "id" TEXT NOT NULL,
    "enrollment_id" TEXT NOT NULL,
    "practical_task_id" TEXT NOT NULL,
    "submitted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submission_metadata" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "practical_task_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "learning_tracks_fellowship_id_status_display_order_idx" ON "learning_tracks"("fellowship_id", "status", "display_order");

-- CreateIndex
CREATE INDEX "courses_learning_track_id_status_display_order_idx" ON "courses"("learning_track_id", "status", "display_order");

-- CreateIndex
CREATE INDEX "weekly_modules_course_id_status_idx" ON "weekly_modules"("course_id", "status");

-- CreateIndex
CREATE INDEX "lessons_weekly_module_id_status_display_order_idx" ON "lessons"("weekly_module_id", "status", "display_order");

-- CreateIndex
CREATE INDEX "learning_resources_weekly_module_id_status_display_order_idx" ON "learning_resources"("weekly_module_id", "status", "display_order");

-- CreateIndex
CREATE INDEX "practical_tasks_weekly_module_id_status_display_order_idx" ON "practical_tasks"("weekly_module_id", "status", "display_order");

-- CreateIndex
CREATE INDEX "lesson_completions_lesson_id_idx" ON "lesson_completions"("lesson_id");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_completions_enrollment_id_lesson_id_key" ON "lesson_completions"("enrollment_id", "lesson_id");

-- CreateIndex
CREATE INDEX "resource_acknowledgments_resource_id_idx" ON "resource_acknowledgments"("resource_id");

-- CreateIndex
CREATE UNIQUE INDEX "resource_acknowledgments_enrollment_id_resource_id_key" ON "resource_acknowledgments"("enrollment_id", "resource_id");

-- CreateIndex
CREATE INDEX "practical_task_submissions_practical_task_id_idx" ON "practical_task_submissions"("practical_task_id");

-- CreateIndex
CREATE UNIQUE INDEX "practical_task_submissions_enrollment_id_practical_task_id_key" ON "practical_task_submissions"("enrollment_id", "practical_task_id");

-- CreateIndex
CREATE INDEX "enrollments_current_learning_track_id_idx" ON "enrollments"("current_learning_track_id");

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_current_learning_track_id_fkey" FOREIGN KEY ("current_learning_track_id") REFERENCES "learning_tracks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_tracks" ADD CONSTRAINT "learning_tracks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_tracks" ADD CONSTRAINT "learning_tracks_fellowship_id_fkey" FOREIGN KEY ("fellowship_id") REFERENCES "fellowships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_learning_track_id_fkey" FOREIGN KEY ("learning_track_id") REFERENCES "learning_tracks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_modules" ADD CONSTRAINT "weekly_modules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_modules" ADD CONSTRAINT "weekly_modules_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_weekly_module_id_fkey" FOREIGN KEY ("weekly_module_id") REFERENCES "weekly_modules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_resources" ADD CONSTRAINT "learning_resources_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_resources" ADD CONSTRAINT "learning_resources_weekly_module_id_fkey" FOREIGN KEY ("weekly_module_id") REFERENCES "weekly_modules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_resources" ADD CONSTRAINT "learning_resources_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practical_tasks" ADD CONSTRAINT "practical_tasks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practical_tasks" ADD CONSTRAINT "practical_tasks_weekly_module_id_fkey" FOREIGN KEY ("weekly_module_id") REFERENCES "weekly_modules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_completions" ADD CONSTRAINT "lesson_completions_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_completions" ADD CONSTRAINT "lesson_completions_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_acknowledgments" ADD CONSTRAINT "resource_acknowledgments_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_acknowledgments" ADD CONSTRAINT "resource_acknowledgments_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "learning_resources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practical_task_submissions" ADD CONSTRAINT "practical_task_submissions_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practical_task_submissions" ADD CONSTRAINT "practical_task_submissions_practical_task_id_fkey" FOREIGN KEY ("practical_task_id") REFERENCES "practical_tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Partial unique indexes (docs/adr/0006-curriculum-learning-engine.md's
-- reconciliation of docs/database-design.md's "WHERE deleted_at IS NULL"
-- constraint pattern for curriculum entity slugs/week numbers). Prisma's
-- schema DSL cannot express a WHERE clause on @@unique, so these are
-- hand-written here instead of generated — same pattern as the Milestone 3
-- migration's academies/fellowships/cohorts partial indexes.

-- CreateIndex: a learning track's slug is unique among its fellowship's active tracks.
CREATE UNIQUE INDEX "learning_tracks_fellowship_slug_active_key" ON "learning_tracks" ("fellowship_id", "slug") WHERE "deleted_at" IS NULL;

-- CreateIndex: a course's slug is unique among its learning track's active courses.
CREATE UNIQUE INDEX "courses_track_slug_active_key" ON "courses" ("learning_track_id", "slug") WHERE "deleted_at" IS NULL;

-- CreateIndex: a week number is unique among its course's active weekly modules
-- (one row per week — see docs/adr/0006-curriculum-learning-engine.md Decision 2).
CREATE UNIQUE INDEX "weekly_modules_course_week_active_key" ON "weekly_modules" ("course_id", "week_number") WHERE "deleted_at" IS NULL;
