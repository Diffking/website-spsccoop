/**
 * กลุ่มของ "บริการของเรา" บนหน้าแรก
 *
 * ส่วนใหญ่เป็นลิงก์ไปหน้า/ระบบอื่น การแบ่งกลุ่มช่วยให้คนหาเจอเร็วขึ้นว่าเรื่องของใคร
 * ไฟล์นี้ไม่แตะฐานข้อมูล ฝั่ง client จึง import ได้
 */

export const SERVICE_CATEGORIES = [
  { key: "member", label: "เกี่ยวกับสมาชิก" },
  { key: "committee", label: "เกี่ยวกับคณะกรรมการ" },
  { key: "staff", label: "เกี่ยวกับเจ้าหน้าที่" },
] as const;

export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number]["key"];

export const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  SERVICE_CATEGORIES.map((c) => [c.key, c.label]),
);

/**
 * รายการเก่าที่บันทึกไว้ก่อนมีการแบ่งกลุ่ม (category ว่าง) ให้ถือเป็นกลุ่มนี้
 * ทั้งหน้าเว็บและหลังบ้านต้องใช้ค่าเดียวกัน ไม่งั้นหลังบ้านโชว์อยู่แท็บหนึ่ง
 * แต่หน้าเว็บไปโผล่อีกกลุ่ม
 */
export const DEFAULT_CATEGORY = "member";

export const isServiceCategory = (value: unknown): value is ServiceCategory =>
  typeof value === "string" && SERVICE_CATEGORIES.some((c) => c.key === value);

/** กลุ่มของรายการหนึ่ง ๆ — ค่าว่างหรือค่าแปลกปลอมถือเป็นกลุ่มเริ่มต้น */
export const categoryOf = (value: unknown): ServiceCategory =>
  isServiceCategory(value) ? value : DEFAULT_CATEGORY;
