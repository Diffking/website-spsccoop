-- CreateTable
CREATE TABLE "SecurityEvent" (
    "id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kind" TEXT NOT NULL,
    "username" TEXT,
    "ip" TEXT,
    "note" TEXT,

    CONSTRAINT "SecurityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SecurityEvent_at_idx" ON "SecurityEvent"("at");

-- CreateIndex
CREATE INDEX "SecurityEvent_kind_at_idx" ON "SecurityEvent"("kind", "at");

