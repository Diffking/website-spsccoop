/**
 * สิทธิ์ตามหน้าที่รับผิดชอบ — ใครดูแลส่วนไหนของเว็บได้บ้าง
 *
 * เดิมทีคนที่ล็อกอินได้แก้ได้ทุกอย่าง พอมีเจ้าหน้าที่หลายคนดูแลคนละส่วน
 * ต้องจำกัดให้แต่ละคนเห็นและแก้เฉพาะส่วนของตัวเอง จะได้ไม่เผลอไปแก้ของคนอื่น
 *
 * `areas` ของผู้ใช้ว่าง = ดูแลได้ทั้งเว็บ (ผู้ใช้เดิมทุกคนเป็นแบบนี้ ไม่ต้องไปตั้งย้อนหลัง)
 * ADMIN เข้าได้ทุกที่เสมอ ไม่ว่า areas จะเป็นอะไร
 *
 * ไฟล์นี้ไม่แตะฐานข้อมูลและไม่ import ของฝั่ง server ใช้ได้ทั้ง client และ server
 */

import { groupKeyOf } from "@/lib/pageGroups";
import { designedPageOf } from "@/lib/designedPages";

export type AreaKey =
  | "home.layout"
  | "home.slides"
  | "home.rates"
  | "home.ticker"
  | "home.announcements"
  | "home.committees"
  | "home.services"
  | "home.member"
  | "home.calendar"
  | "home.officers"
  | "header"
  | "footer"
  | "splash"
  | "holidays"
  | "pages"
  | "designed"
  | "programs"
  | "seo";

/** รายชื่อพื้นที่ทั้งหมด — ใช้ทำรายการติ๊กเลือกในหน้าผู้ใช้งาน และหาที่อยู่ของแต่ละพื้นที่ */
export const AREAS: { key: AreaKey; href: string; label: string; group: string }[] = [
  { key: "home.layout", href: "/admin/home", label: "จัดวางหน้าแรก (เปิด/ปิด/สลับลำดับส่วน)", group: "หน้าแรก" },
  { key: "home.slides", href: "/admin/home/slides", label: "สไลด์", group: "หน้าแรก" },
  { key: "home.rates", href: "/admin/home/rates", label: "อัตราดอกเบี้ย", group: "หน้าแรก" },
  { key: "home.ticker", href: "/admin/home/ticker", label: "ข่าววิ่ง", group: "หน้าแรก" },
  { key: "home.announcements", href: "/admin/home/announcements", label: "ประกาศ / จดหมายข่าว", group: "หน้าแรก" },
  { key: "home.committees", href: "/admin/home/committees", label: "คณะกรรมการดำเนินการ", group: "หน้าแรก" },
  { key: "home.services", href: "/admin/home/services", label: "บริการ", group: "หน้าแรก" },
  { key: "home.member", href: "/admin/home/member", label: "สำหรับสมาชิก", group: "หน้าแรก" },
  { key: "home.calendar", href: "/admin/home/calendar", label: "ปฏิทินสหกรณ์", group: "หน้าแรก" },
  { key: "home.officers", href: "/admin/home/officers", label: "สำนักงานบริการสมาชิก", group: "หน้าแรก" },
  { key: "header", href: "/admin/header", label: "ส่วนหัวเว็บ", group: "ทั้งเว็บ" },
  { key: "footer", href: "/admin/footer", label: "ส่วนท้ายเว็บ", group: "ทั้งเว็บ" },
  { key: "splash", href: "/admin/splash", label: "วันสำคัญ", group: "ทั้งเว็บ" },
  { key: "holidays", href: "/admin/holidays", label: "วันหยุด", group: "ทั้งเว็บ" },
  { key: "designed", href: "/admin/designed", label: "หน้าออกแบบอัตโนมัติ", group: "ทั้งเว็บ" },
  { key: "programs", href: "/admin/programs", label: "หน้าโปรแกรม", group: "ทั้งเว็บ" },
  { key: "seo", href: "/admin/seo", label: "SEO", group: "ทั้งเว็บ" },
  { key: "pages", href: "/admin/pages", label: "หน้าเนื้อหา — ทุกหมวด", group: "หน้าเนื้อหา" },
];

const AREA_KEYS = new Set<string>(AREAS.map((a) => a.key));

/** คำนำหน้าของพื้นที่ที่เป็น "หมวดหน้าเนื้อหา" — หมวดมาจากฐาน จึงเป็นคีย์ตายตัวไม่ได้ */
const PAGE_PREFIX = "page:";

/** พื้นที่ของหมวดหน้าเนื้อหาหนึ่งหมวด เช่น "ดาวน์โหลดเอกสาร" → "page:ดาวน์โหลดเอกสาร" */
export function pageArea(category: string): string {
  return `${PAGE_PREFIX}${category}`;
}

/** ถ้าเป็นพื้นที่หมวดหน้าเนื้อหา คืนชื่อหมวด ไม่ใช่คืน null */
export function pageAreaCategory(area: string): string | null {
  return area.startsWith(PAGE_PREFIX) ? area.slice(PAGE_PREFIX.length) : null;
}

/** ตัดค่าที่ไม่รู้จักทิ้ง — กันคีย์แปลกปลอมจากคำขอเข้าฐาน */
export function cleanAreas(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const kept = input
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter((v) => AREA_KEYS.has(v) || (v.startsWith(PAGE_PREFIX) && v.length > PAGE_PREFIX.length));
  return [...new Set(kept)];
}

export type Actor = { role: "ADMIN" | "EDITOR"; areas: string[] };

/** ดูแลได้ทั้งเว็บไหม — ADMIN หรือคนที่ยังไม่ได้กำหนดพื้นที่รับผิดชอบ */
export function hasFullAccess(user: Actor): boolean {
  return user.role === "ADMIN" || user.areas.length === 0;
}

/** เข้าพื้นที่นี้ได้ไหม — ส่งหลายพื้นที่มา = มีอันใดอันหนึ่งก็พอ */
export function canArea(user: Actor, area: AreaKey | AreaKey[]): boolean {
  if (hasFullAccess(user)) return true;
  const wanted = Array.isArray(area) ? area : [area];
  return wanted.some((key) => user.areas.includes(key));
}

type PageLike = { slug: string; category?: string | null };

/** แก้หน้าเนื้อหาหน้านี้ได้ไหม — ดูจากหมวดที่หน้านั้นอยู่ */
export function canPage(user: Actor, page: PageLike): boolean {
  if (hasFullAccess(user) || user.areas.includes("pages")) return true;
  /*
   * หน้าออกแบบอัตโนมัติ (เช่น ติดต่อเรา) เก็บ "เนื้อหาเพิ่มเติม" ไว้ในตาราง Page เหมือนกัน
   * แต่แก้จากเมนูหน้าออกแบบอัตโนมัติ ไม่ใช่เมนูหน้าเนื้อหา — สิทธิ์จึงมาจากพื้นที่นั้น
   */
  if (designedPageOf(page.slug)) return user.areas.includes("designed");
  return user.areas.includes(pageArea(groupKeyOf(page)));
}

/** แตะหน้าเนื้อหาได้บ้างไหม (อย่างน้อยหนึ่งหมวด) — ใช้ตัดสินว่าจะโชว์เมนู "หน้าเนื้อหา" ไหม */
export function canAnyPage(user: Actor): boolean {
  if (hasFullAccess(user) || user.areas.includes("pages")) return true;
  return user.areas.some((a) => a.startsWith(PAGE_PREFIX));
}

/** หมวดหน้าเนื้อหาที่คนนี้ดูแล — null = ทุกหมวด */
export function allowedPageCategories(user: Actor): string[] | null {
  if (hasFullAccess(user) || user.areas.includes("pages")) return null;
  return user.areas.map(pageAreaCategory).filter((c): c is string => c !== null);
}

/** กรองรายการหน้าเนื้อหาให้เหลือเฉพาะที่คนนี้ดูแล */
export function filterPages<T extends PageLike>(user: Actor, pages: T[]): T[] {
  if (hasFullAccess(user) || user.areas.includes("pages")) return pages;
  return pages.filter((page) => canPage(user, page));
}

/**
 * ที่อยู่แรกที่คนนี้เปิดได้ — ใช้ตอนโดนเด้งออกจากหน้าที่ไม่มีสิทธิ์
 * ทุกคนเปิดหน้าภาพรวมได้อยู่แล้ว จึงคืน /admin/ เสมอ แยกไว้เป็นฟังก์ชันกันลืมแก้พร้อมกัน
 */
export const ADMIN_HOME = "/admin/";
