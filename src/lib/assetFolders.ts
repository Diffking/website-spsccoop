/**
 * รายชื่อโฟลเดอร์เก็บไฟล์ใต้ assets/ และตัวตรวจชื่อโฟลเดอร์
 *
 * แยกออกมาจาก src/lib/ftp.ts เพราะไฟล์นั้น import basic-ftp กับอ่านค่า env
 * เอาไปใช้ในหน้าจอหลังบ้าน (ฝั่งเบราว์เซอร์) ไม่ได้ — ไฟล์นี้เป็นข้อมูลล้วน ใช้ได้ทั้งสองฝั่ง
 *
 * กฎของระบบ: ทุกจุดที่อัปไฟล์ต้องระบุโฟลเดอร์เสมอ ห้ามปล่อยให้ตกไปที่ค่าเริ่มต้น
 * เพราะไฟล์จะไปกองรวมกันจนตามหาไม่เจอ — ตัวช่วยด้านล่างมีไว้ให้ทุกจุดมีชื่อโฟลเดอร์ของตัวเอง
 */

/** โฟลเดอร์ย่อยใน assets/ — ค่าที่รับได้มีเท่านี้ กันคนยิง API ใส่ path แปลก ๆ */
export const FOLDERS = {
  banner_slide: "แบนเนอร์สไลด์",
  Declar: "ประกาศ",
  newsletter: "จดหมายข่าว",
  resultreport: "รายงานกิจการ",
  member_docs: "เอกสารแนะนำสมาชิก",
  page_images: "รูปในหน้าเนื้อหา",
  brand: "โลโก้และภาพประจำเว็บ",
  home_items: "รูปรายการหน้าแรก",
} as const;

/**
 * รูปคณะกรรมการแยกโฟลเดอร์ตามชุด เช่น committees/set45
 * ชุดใหม่มาก็ไม่ต้องมาแก้โค้ด และรูปชุดเก่ายังอยู่ครบไม่ปนกัน
 */
const COMMITTEE_FOLDER = /^committees\/set\d{1,3}$/;

export const committeeFolder = (set: number) => `committees/set${Math.trunc(set)}` as Folder;

/**
 * หน้าเนื้อหาแต่ละหน้ามีโฟลเดอร์ของตัวเองใต้ pages/ เช่น pages/about-history
 * ไฟล์ที่แนบในหน้าไหนก็อยู่ด้วยกัน เข้าไปดูใน FTP แล้วรู้ทันทีว่าไฟล์นี้ของหน้าอะไร
 * (เดิมกองรวมกันหมดใน page_images ตามหาไฟล์ของหน้าหนึ่ง ๆ ไม่ได้เลย)
 */
const PAGE_FOLDER = /^pages\/[a-z0-9][a-z0-9-]{0,39}$/;

/** ชื่อโฟลเดอร์จาก slug ของหน้า — about/history → pages/about-history */
export function pageFolder(slug: string): Folder {
  const name = slug
    .toLowerCase()
    .replace(/[^a-z0-9/-]+/g, "-")
    .replace(/\//g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return (name ? `pages/${name}` : "page_images") as Folder;
}

/** ตรวจชื่อโฟลเดอร์ที่เจ้าหน้าที่พิมพ์เอง — ผิดรูปแบบคืนค่าที่คำนวณจาก slug แทน */
export function cleanPageFolder(input: unknown, slug: string): Folder {
  if (typeof input === "string") {
    const value = input.trim().replace(/^\/+|\/+$/g, "");
    const withPrefix = value.startsWith("pages/") ? value : `pages/${value}`;
    if (PAGE_FOLDER.test(withPrefix)) return withPrefix as Folder;
  }
  return pageFolder(slug);
}

export type Folder =
  | keyof typeof FOLDERS
  | `committees/set${number}`
  | `pages/${string}`
  | `home_items/${string}`;

export const DEFAULT_FOLDER: Folder = "banner_slide";

export const isFolder = (value: unknown): value is Folder =>
  typeof value === "string" &&
  (Object.hasOwn(FOLDERS, value) ||
    COMMITTEE_FOLDER.test(value) ||
    PAGE_FOLDER.test(value) ||
    HOME_ITEM_FOLDER.test(value));

/**
 * รูปของรายการหน้าแรกแยกตามส่วนที่ใช้ เช่น home_items/officers
 * ไม่ต้องมาเพิ่ม FOLDERS ทุกครั้งที่มีส่วนใหม่ แต่ยังแยกโฟลเดอร์ให้หาไฟล์เจอ
 */
const HOME_ITEM_FOLDER = /^home_items\/[a-z0-9-]{1,30}$/;

/** ชื่อโฟลเดอร์ของรายการหน้าแรกแต่ละส่วน — ใช้เป็นค่าตั้งต้นให้ทุกส่วนมีที่อยู่ของตัวเอง */
export function homeItemFolder(section: string): Folder {
  const name = section
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30);
  return (name ? `home_items/${name}` : "home_items") as Folder;
}
