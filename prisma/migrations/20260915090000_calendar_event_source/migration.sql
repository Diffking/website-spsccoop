-- AlterTable
ALTER TABLE "CalendarEvent" ADD COLUMN     "source" TEXT;

-- รอบรถตู้ที่ดึงจากระบบสำนักงานก่อนมีช่องนี้ — ชื่อเรื่องนี้ตัวนำเข้าตั้งให้เอง (readVan ใน officerEvents.ts)
-- ตรวจแล้ว 15 ก.ย. 2569 รถตู้ทั้ง 11 รายการในฐานใช้ชื่อนี้ครบ
UPDATE "CalendarEvent"
SET "source" = 'officer'
WHERE "type" = 'mobile' AND "date" IS NOT NULL AND "title" = 'บริการรถตู้เคลื่อนที่';
