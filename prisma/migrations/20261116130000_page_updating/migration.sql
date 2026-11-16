-- AlterTable
ALTER TABLE "Page" ADD COLUMN     "updating" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "updatingNote" TEXT;
