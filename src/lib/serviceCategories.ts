/**
 * กลุ่มของ "บริการของเรา" บนหน้าแรก
 *
 * ส่วนใหญ่เป็นลิงก์ไปหน้า/ระบบอื่น การแบ่งกลุ่มช่วยให้คนหาเจอเร็วขึ้นว่าเรื่องของใคร
 * ไฟล์นี้ไม่แตะฐานข้อมูล ฝั่ง client จึง import ได้
 */

/**
 * สีประจำกลุ่ม — คุมโทนเย็นทั้งสามให้อยู่ตระกูลเดียวกับสีหลักของเว็บ
 * ฟ้ายามเย็น (สมาชิก) · ฟ้าอมเขียวทะเล (คณะกรรมการ) · น้ำเงิน (เจ้าหน้าที่)
 *
 * เขียนเป็นชื่อคลาสเต็มทุกตัว ห้ามต่อสตริงเอาเอง เช่น `bg-${c}-50`
 * เพราะ Tailwind อ่านจากไฟล์ตรง ๆ ชื่อที่ประกอบตอนรันจะไม่ถูกสร้าง CSS ให้
 */
export type CategoryTone = {
  /** แถบสั้นหน้าหัวข้อกลุ่ม */
  bar: string;
  /** ตัวหนังสือหัวข้อกลุ่ม */
  heading: string;
  /** กรอบไอคอนในการ์ด (ปกติ) */
  chip: string;
  /** กรอบไอคอนตอนเอาเมาส์ชี้การ์ด */
  chipHover: string;
  /** ชื่อบริการตอนเอาเมาส์ชี้ */
  titleHover: string;
  /** จุดสีหน้าชื่อแท็บในหลังบ้าน */
  dot: string;
};

export const SERVICE_CATEGORIES = [
  {
    key: "member",
    label: "เกี่ยวกับสมาชิก",
    tone: {
      bar: "bg-sky-400",
      heading: "text-sky-700",
      chip: "bg-sky-100 text-sky-700",
      chipHover: "group-hover:bg-sky-500 group-hover:text-white",
      titleHover: "group-hover:text-sky-700",
      dot: "bg-sky-400",
    },
  },
  {
    key: "committee",
    label: "เกี่ยวกับคณะกรรมการ",
    tone: {
      bar: "bg-teal-400",
      heading: "text-teal-700",
      chip: "bg-teal-100 text-teal-700",
      chipHover: "group-hover:bg-teal-500 group-hover:text-white",
      titleHover: "group-hover:text-teal-700",
      dot: "bg-teal-400",
    },
  },
  {
    key: "staff",
    label: "เกี่ยวกับเจ้าหน้าที่",
    tone: {
      bar: "bg-brand-600",
      heading: "text-brand-800",
      chip: "bg-brand-100 text-brand-700",
      chipHover: "group-hover:bg-brand-600 group-hover:text-white",
      titleHover: "group-hover:text-brand-800",
      dot: "bg-brand-600",
    },
  },
] as const satisfies readonly { key: string; label: string; tone: CategoryTone }[];

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
