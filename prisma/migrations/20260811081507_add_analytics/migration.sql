-- CreateTable
CREATE TABLE "PageView" (
    "id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "day" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PageView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitorDay" (
    "id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "day" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisitorDay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PageView_day_idx" ON "PageView"("day");

-- CreateIndex
CREATE UNIQUE INDEX "PageView_path_day_key" ON "PageView"("path", "day");

-- CreateIndex
CREATE INDEX "VisitorDay_day_idx" ON "VisitorDay"("day");

-- CreateIndex
CREATE UNIQUE INDEX "VisitorDay_fingerprint_day_key" ON "VisitorDay"("fingerprint", "day");
