-- AlterTable
ALTER TABLE "User" ADD COLUMN     "areas" TEXT[] DEFAULT ARRAY[]::TEXT[];
