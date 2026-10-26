-- CreateTable
CREATE TABLE "SurveyPrize" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'one',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SurveyPrize_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurveyDraw" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "prizeId" TEXT NOT NULL,
    "round" INTEGER NOT NULL DEFAULT 1,
    "responseId" TEXT NOT NULL,
    "membNo" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "department" TEXT,
    "poolSize" INTEGER NOT NULL,
    "poolHash" TEXT NOT NULL,
    "drawnAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "drawnById" TEXT,
    "drawnByName" TEXT,
    "pressedBy" TEXT,
    "voided" BOOLEAN NOT NULL DEFAULT false,
    "voidReason" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidedByName" TEXT,

    CONSTRAINT "SurveyDraw_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SurveyPrize_surveyId_sortOrder_idx" ON "SurveyPrize"("surveyId", "sortOrder");

-- CreateIndex
CREATE INDEX "SurveyDraw_surveyId_voided_idx" ON "SurveyDraw"("surveyId", "voided");

-- CreateIndex
CREATE INDEX "SurveyDraw_prizeId_idx" ON "SurveyDraw"("prizeId");

-- AddForeignKey
ALTER TABLE "SurveyPrize" ADD CONSTRAINT "SurveyPrize_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyDraw" ADD CONSTRAINT "SurveyDraw_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyDraw" ADD CONSTRAINT "SurveyDraw_prizeId_fkey" FOREIGN KEY ("prizeId") REFERENCES "SurveyPrize"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

