-- CreateTable
CREATE TABLE "cohort_learning_tracks" (
    "id" TEXT NOT NULL,
    "cohort_id" TEXT NOT NULL,
    "learning_track_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cohort_learning_tracks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fellowship_track_mentors" (
    "id" TEXT NOT NULL,
    "fellowship_id" TEXT NOT NULL,
    "learning_track_id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "assigned_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unassigned_at" TIMESTAMPTZ(3),

    CONSTRAINT "fellowship_track_mentors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cohort_learning_tracks_learning_track_id_idx" ON "cohort_learning_tracks"("learning_track_id");

-- CreateIndex
CREATE UNIQUE INDEX "cohort_learning_tracks_cohort_id_learning_track_id_key" ON "cohort_learning_tracks"("cohort_id", "learning_track_id");

-- CreateIndex
CREATE INDEX "fellowship_track_mentors_membership_id_idx" ON "fellowship_track_mentors"("membership_id");

-- CreateIndex
CREATE INDEX "fellowship_track_mentors_learning_track_id_idx" ON "fellowship_track_mentors"("learning_track_id");

-- CreateIndex: one active (unassigned_at IS NULL) assignment per
-- (fellowship, track, membership) — same hand-written partial-index
-- convention as "cohort_mentors_active_assignment_key".
CREATE UNIQUE INDEX "fellowship_track_mentors_active_assignment_key" ON "fellowship_track_mentors" ("fellowship_id", "learning_track_id", "membership_id") WHERE "unassigned_at" IS NULL;

-- AddForeignKey
ALTER TABLE "cohort_learning_tracks" ADD CONSTRAINT "cohort_learning_tracks_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "cohorts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cohort_learning_tracks" ADD CONSTRAINT "cohort_learning_tracks_learning_track_id_fkey" FOREIGN KEY ("learning_track_id") REFERENCES "learning_tracks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fellowship_track_mentors" ADD CONSTRAINT "fellowship_track_mentors_fellowship_id_fkey" FOREIGN KEY ("fellowship_id") REFERENCES "fellowships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fellowship_track_mentors" ADD CONSTRAINT "fellowship_track_mentors_learning_track_id_fkey" FOREIGN KEY ("learning_track_id") REFERENCES "learning_tracks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fellowship_track_mentors" ADD CONSTRAINT "fellowship_track_mentors_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
