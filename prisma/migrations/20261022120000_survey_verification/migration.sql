-- AlterTable
ALTER TABLE "SurveyResponse" ADD COLUMN     "checkedAt" TIMESTAMP(3),
ADD COLUMN     "claimedName" TEXT,
ADD COLUMN     "claimedPhone" TEXT,
ADD COLUMN     "queueId" TEXT,
ADD COLUMN     "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT,
ADD COLUMN     "reviewedByName" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'live',
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'verified',
ADD COLUMN     "statusNote" TEXT,
ALTER COLUMN "membNo" DROP NOT NULL,
ALTER COLUMN "name" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "SurveyResponse_queueId_key" ON "SurveyResponse"("queueId");

-- CreateIndex
CREATE INDEX "SurveyResponse_surveyId_status_idx" ON "SurveyResponse"("surveyId", "status");

