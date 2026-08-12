/**
 * ส่วนต่าง ๆ ของหน้าแรก ที่เปิด/ปิดได้จากหลังบ้าน
 *
 * แยกไว้ไฟล์นี้ (ไม่รวมใน settings.ts) เพราะฟอร์มหลังบ้านเป็น client component
 * ถ้าไปวางรวมกับ settings.ts จะลาก prisma ติดเข้า bundle ฝั่งเบราว์เซอร์
 *
 * ลำดับในลิสต์ = ลำดับที่ปรากฏจริงบนหน้าแรก เลื่อนหน้าเว็บลงไปเจออะไรก่อน อยู่ก่อนในนี้
 */

export const HOME_SECTIONS = [
  { key: "hero", label: "แบนเนอร์สไลด์ + อัตราดอกเบี้ย" },
  { key: "ticker", label: "ข่าววิ่ง" },
  { key: "news", label: "ประกาศ / จดหมายข่าว + คณะกรรมการ" },
  { key: "services", label: "บริการของเรา" },
  { key: "recommend", label: "สำหรับสมาชิก (การ์ดใหญ่ + การ์ดย่อย)" },
  { key: "memberCorner", label: "แนะนำสมาชิก" },
  { key: "calendar", label: "ปฏิทินสหกรณ์" },
  { key: "officers", label: "สำนักงานบริการสมาชิก" },
] as const;

export type HomeSectionKey = (typeof HOME_SECTIONS)[number]["key"];
export type HomeSections = Record<HomeSectionKey, boolean>;

/** ค่าตั้งต้น = เปิดทุกส่วน (เหมือนที่แสดงอยู่ตอนนี้) */
export const DEFAULT_HOME_SECTIONS = Object.fromEntries(
  HOME_SECTIONS.map((s) => [s.key, true]),
) as HomeSections;

/** เติมคีย์ที่ขาดจากค่าตั้งต้น — ค่าที่บันทึกไว้อาจเก่ากว่าลิสต์ปัจจุบัน */
export const fillHomeSections = (saved: Partial<HomeSections> | null | undefined): HomeSections => ({
  ...DEFAULT_HOME_SECTIONS,
  ...(saved ?? {}),
});

export const isHomeSectionKey = (value: unknown): value is HomeSectionKey =>
  typeof value === "string" && HOME_SECTIONS.some((s) => s.key === value);
