/**
 * ค่าคงที่ของการ์ดคณะกรรมการ — แยกไว้ไฟล์นี้เพราะทั้งหน้าเว็บและหลังบ้านเป็น client component
 * ถ้าไปวางรวมใน settings.ts จะลาก prisma ติดเข้า bundle ฝั่งเบราว์เซอร์ด้วยแล้ว build พัง
 */

/** กรอบรูปเต็ม 100% — เท่ากับสัดส่วนรูปถ่ายติดบัตรที่สหกรณ์ใช้ */
export const COMMITTEE_PHOTO_BASE = { width: 220, height: 300 };

/** ขนาดที่เลือกได้ (%) — จำกัดไว้เท่านี้ จะได้ไม่มีใครใส่ค่าประหลาดจนการ์ดเสียทรง */
export const COMMITTEE_PHOTO_SCALES = [70, 80, 90, 100] as const;

export const DEFAULT_COMMITTEE_PHOTO_SCALE = 70;
