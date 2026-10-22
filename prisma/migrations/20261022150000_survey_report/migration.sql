-- AlterTable
ALTER TABLE "Survey" ADD COLUMN     "feedbackSummary" JSONB,
ADD COLUMN     "feedbackSummaryAt" TIMESTAMP(3),
ADD COLUMN     "shareExpiresAt" TIMESTAMP(3),
ADD COLUMN     "shareToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Survey_shareToken_key" ON "Survey"("shareToken");

