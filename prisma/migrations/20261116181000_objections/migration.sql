-- CreateTable
CREATE TABLE "ObjectionRound" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "opensAt" TIMESTAMP(3) NOT NULL,
    "closesAt" TIMESTAMP(3) NOT NULL,
    "agendas" JSONB NOT NULL DEFAULT '[]',
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ObjectionRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Objection" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "membNo" TEXT NOT NULL,
    "membKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "items" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Objection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ObjectionRound_year_key" ON "ObjectionRound"("year");

-- CreateIndex
CREATE INDEX "Objection_roundId_createdAt_idx" ON "Objection"("roundId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Objection_roundId_membKey_key" ON "Objection"("roundId", "membKey");

-- AddForeignKey
ALTER TABLE "Objection" ADD CONSTRAINT "Objection_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "ObjectionRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;
