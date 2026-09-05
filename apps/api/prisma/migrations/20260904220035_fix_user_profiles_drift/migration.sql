-- AlterTable
ALTER TABLE "user_profiles" RENAME CONSTRAINT "student_profiles_pkey" TO "user_profiles_pkey";
ALTER TABLE "user_profiles" ADD COLUMN     "phone" TEXT;

-- RenameForeignKey
ALTER TABLE "user_profiles" RENAME CONSTRAINT "student_profiles_user_id_fkey" TO "user_profiles_user_id_fkey";

-- RenameIndex
ALTER INDEX "student_profiles_user_id_key" RENAME TO "user_profiles_user_id_key";
