-- CreateEnum
CREATE TYPE "AnnouncementKind" AS ENUM ('ANNOUNCEMENT', 'NEWSLETTER', 'REPORT');

-- DropIndex
DROP INDEX "Announcement_published_publishedAt_idx";

-- AlterTable
ALTER TABLE "Announcement" ADD COLUMN     "kind" "AnnouncementKind" NOT NULL DEFAULT 'ANNOUNCEMENT';

-- CreateIndex
CREATE INDEX "Announcement_published_kind_publishedAt_idx" ON "Announcement"("published", "kind", "publishedAt");
