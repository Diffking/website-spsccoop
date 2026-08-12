import { nav as DEFAULT_NAV, site as DEFAULT_BRAND } from "@/data/home";
import { getSetting } from "@/lib/settings";

/**
 * เมนูนำทางบนหัวเว็บ + ชื่อ/โลโก้ — เก็บใน Setting เป็นก้อน JSON ก้อนเดียว
 *
 * ไม่ทำเป็นตารางแยกเพราะเมนูมีชั้นย่อยถึง 3 ชั้น เก็บเป็นต้นไม้ทั้งก้อนแล้วบันทึกทีเดียว
 * ง่ายกว่าและไม่ต้องกังวลเรื่องลำดับ/พ่อลูกค้างในฐาน
 */

export type NavNode = {
  label: string;
  href: string;
  children?: NavNode[];
};

export type SiteBrand = {
  /** ชื่อเต็ม — ขึ้นบนแถบบนสุดและท้ายเว็บ */
  name: string;
  /** ชื่อย่อ — ใช้บนจอมือถือที่ชื่อเต็มยาวเกิน */
  shortName: string;
  /** โลโก้ที่อัปจากหลังบ้าน — เว้นว่าง = ใช้โลโก้ที่ติดมากับโค้ด */
  logoUrl?: string;
};

export const DEFAULT_SITE_BRAND: SiteBrand = {
  name: DEFAULT_BRAND.name,
  shortName: DEFAULT_BRAND.shortName,
  logoUrl: "",
};

export const getNav = () => getSetting<NavNode[]>("nav", DEFAULT_NAV);
export const getBrand = () => getSetting<SiteBrand>("siteBrand", DEFAULT_SITE_BRAND);

/** ตัดกิ่งที่ไม่มีชื่อทิ้ง และตัดฟิลด์แปลกปลอมออก — ใช้ตรวจก่อนบันทึกจากหลังบ้าน */
export function cleanNav(input: unknown, depth = 0): NavNode[] {
  if (!Array.isArray(input) || depth > 2) return [];

  return input.flatMap((raw): NavNode[] => {
    if (!raw || typeof raw !== "object") return [];
    const node = raw as Record<string, unknown>;

    const label = typeof node.label === "string" ? node.label.trim() : "";
    if (!label) return [];

    const href = typeof node.href === "string" ? node.href.trim() : "";
    const children = cleanNav(node.children, depth + 1);

    // เมนูที่ไม่มีทั้งลิงก์และเมนูย่อย กดแล้วไม่ไปไหน ให้ชี้หน้าแรกไว้ก่อน
    // ส่วนเมนูที่มีลูก เว้นลิงก์ว่างได้ — หัวเว็บจะทำเป็นหัวข้อกางเมนูย่อยแทน
    return [
      {
        label,
        href: href || (children.length > 0 ? "" : "/"),
        ...(children.length > 0 ? { children } : {}),
      },
    ];
  });
}
