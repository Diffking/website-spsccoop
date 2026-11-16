-- AlterTable
ALTER TABLE "Announcement" ADD COLUMN     "archiveYear" INTEGER;

-- CreateIndex
CREATE INDEX "Announcement_archiveYear_idx" ON "Announcement"("archiveYear");
