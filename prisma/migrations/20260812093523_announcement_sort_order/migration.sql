-- DropIndex
DROP INDEX "Announcement_published_kind_publishedAt_idx";

-- AlterTable
ALTER TABLE "Announcement" ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Announcement_published_kind_sortOrder_publishedAt_idx" ON "Announcement"("published", "kind", "sortOrder", "publishedAt");
