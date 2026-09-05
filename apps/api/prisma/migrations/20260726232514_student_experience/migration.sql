-- CreateEnum
CREATE TYPE "PracticalTaskSubmissionStatus" AS ENUM ('draft', 'submitted', 'under_review', 'revision_requested', 'completed');

-- CreateEnum
CREATE TYPE "PortfolioVisibility" AS ENUM ('private', 'public');

-- AlterTable
ALTER TABLE "practical_task_submissions" ADD COLUMN     "live_demo_url" TEXT,
ADD COLUMN     "repository_url" TEXT,
ADD COLUMN     "status" "PracticalTaskSubmissionStatus" NOT NULL DEFAULT 'draft',
ALTER COLUMN "submitted_at" DROP NOT NULL,
ALTER COLUMN "submitted_at" DROP DEFAULT;

-- CreateTable
CREATE TABLE "student_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "bio" TEXT,
    "skills" TEXT[],
    "interests" TEXT[],
    "github_url" TEXT,
    "linkedin_url" TEXT,
    "website_url" TEXT,
    "learning_preferences_metadata" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "student_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resource_bookmarks" (
    "id" TEXT NOT NULL,
    "enrollment_id" TEXT NOT NULL,
    "resource_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resource_bookmarks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolio_projects" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "enrollment_id" TEXT NOT NULL,
    "practical_task_submission_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "technologies" TEXT[],
    "skills_acquired" TEXT[],
    "repository_url" TEXT,
    "live_demo_url" TEXT,
    "completion_date" TIMESTAMPTZ(3) NOT NULL,
    "visibility" "PortfolioVisibility" NOT NULL DEFAULT 'private',
    "public_slug" TEXT,
    "published_at" TIMESTAMPTZ(3),
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "portfolio_projects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "student_profiles_user_id_key" ON "student_profiles"("user_id");

-- CreateIndex
CREATE INDEX "resource_bookmarks_resource_id_idx" ON "resource_bookmarks"("resource_id");

-- CreateIndex
CREATE UNIQUE INDEX "resource_bookmarks_enrollment_id_resource_id_key" ON "resource_bookmarks"("enrollment_id", "resource_id");

-- CreateIndex
CREATE INDEX "portfolio_projects_enrollment_id_display_order_idx" ON "portfolio_projects"("enrollment_id", "display_order");

-- CreateIndex
-- Hand-written: Prisma's schema DSL cannot express a WHERE clause on
-- @@unique. Enforces "public_slug is unique per organization among
-- non-deleted, published portfolio projects" — same pattern as every other
-- soft-delete-aware unique index in this schema (e.g.
-- learning_tracks_fellowship_slug_active_key).
CREATE UNIQUE INDEX "portfolio_projects_org_public_slug_active_key" ON "portfolio_projects"("organization_id", "public_slug") WHERE "deleted_at" IS NULL AND "public_slug" IS NOT NULL;

-- AddForeignKey
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_bookmarks" ADD CONSTRAINT "resource_bookmarks_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_bookmarks" ADD CONSTRAINT "resource_bookmarks_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "learning_resources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_projects" ADD CONSTRAINT "portfolio_projects_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_projects" ADD CONSTRAINT "portfolio_projects_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_projects" ADD CONSTRAINT "portfolio_projects_practical_task_submission_id_fkey" FOREIGN KEY ("practical_task_submission_id") REFERENCES "practical_task_submissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
