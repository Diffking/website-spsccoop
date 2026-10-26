-- AlterTable
ALTER TABLE "SurveyResponse" ADD COLUMN     "claimedMembNo" TEXT,
ADD COLUMN     "claimedPhoneHash" TEXT;

-- CreateTable
CREATE TABLE "Member" (
    "key" TEXT NOT NULL,
    "membNo" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deptCode" TEXT NOT NULL DEFAULT '',
    "deptName" TEXT NOT NULL DEFAULT '',
    "memberTypeCode" TEXT NOT NULL DEFAULT '',
    "memberType" TEXT NOT NULL DEFAULT '',
    "isStaff" BOOLEAN NOT NULL DEFAULT false,
    "sex" TEXT NOT NULL DEFAULT '',
    "ageGroup" TEXT NOT NULL DEFAULT '',
    "phoneHashes" TEXT[],

    CONSTRAINT "Member_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "Member_phoneHashes_idx" ON "Member" USING GIN ("phoneHashes");

