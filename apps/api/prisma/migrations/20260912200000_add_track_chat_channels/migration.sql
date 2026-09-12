-- AlterEnum
-- `IF NOT EXISTS` (PostgreSQL 12+) makes this safe to re-run against a
-- database this value was already added to out-of-band (`prisma db push`,
-- used here because an unrelated, pre-existing checksum drift on an earlier
-- migration made `prisma migrate dev` offer a full database reset).
ALTER TYPE "ChatChannelType" ADD VALUE IF NOT EXISTS 'track';

-- AlterTable
ALTER TABLE "fellowship_chat_channels" ADD COLUMN     "cohort_id" TEXT,
ADD COLUMN     "learning_track_id" TEXT;

-- CreateIndex
CREATE INDEX "fellowship_chat_channels_cohort_id_learning_track_id_idx" ON "fellowship_chat_channels"("cohort_id", "learning_track_id");

-- AddForeignKey
ALTER TABLE "fellowship_chat_channels" ADD CONSTRAINT "fellowship_chat_channels_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "cohorts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fellowship_chat_channels" ADD CONSTRAINT "fellowship_chat_channels_learning_track_id_fkey" FOREIGN KEY ("learning_track_id") REFERENCES "learning_tracks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
