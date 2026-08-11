-- CreateTable
CREATE TABLE "HomeItem" (
    "id" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "icon" TEXT,
    "href" TEXT,
    "imageUrl" TEXT,
    "theme" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarEvent" (
    "id" TEXT NOT NULL,
    "day" INTEGER NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'project',
    "title" TEXT NOT NULL,
    "place" TEXT,
    "time" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HomeItem_section_published_sortOrder_idx" ON "HomeItem"("section", "published", "sortOrder");

-- CreateIndex
CREATE INDEX "CalendarEvent_published_day_idx" ON "CalendarEvent"("published", "day");
