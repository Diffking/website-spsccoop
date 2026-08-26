/**
 * ที่อยู่ของทุกหน้าที่คนทั่วไปเปิดดูได้ — แหล่งความจริงแหล่งเดียว
 *
 * มีสองที่ที่ต้องรู้รายการนี้ และเคยหลุดคนละแบบมาแล้ว:
 *   sitemap.xml           บอกกูเกิลว่าเว็บนี้มีหน้าอะไรบ้าง
 *   /api/public/pages     ให้ตัวมิเรอร์ฝั่งโฮสต์ไล่เก็บสำเนาล่วงหน้า
 *
 * หน้าเว็บมาจากสามที่ รวมกันถึงจะครบ — ขาดที่ไหนไปหน้ากลุ่มนั้นจะหายเงียบ ๆ
 * โดยไม่มีอะไรฟ้อง (กูเกิลไม่เก็บ · โฮสต์ไม่มีสำเนาให้เสิร์ฟตอนเครื่องที่สำนักงานปิด)
 */

import { db } from "@/lib/db";
import { DESIGNED_PAGES } from "@/lib/designedPages";
import { CODED_ROUTES } from "@/lib/siteRoutes";
import { PROGRAM_PATHS } from "@/lib/programPages";

/** เว็บนี้ตั้งให้ทุกที่อยู่ลงท้ายด้วย / — ไม่ใส่จะโดนพาไปที่อยู่ใหม่ก่อนหนึ่งจังหวะ */
function withSlash(path: string): string {
  const clean = `/${path.replace(/^\/+|\/+$/g, "")}`;
  return clean === "/" ? "/" : `${clean}/`;
}

/**
 * หน้าที่ต้องเก็บสำเนาไว้ แต่ไม่ต้องบอกกูเกิล
 * — /splash/ คือหน้าวันสำคัญที่เด้งให้ดูก่อนเข้าเว็บ ไม่ใช่หน้าเนื้อหาที่ควรค้นเจอ
 */
export const WARM_ONLY_PATHS = ["/splash/"];

export async function publicPaths(): Promise<string[]> {
  const pages = await db.page
    .findMany({ where: { published: true }, select: { slug: true }, orderBy: { slug: "asc" } })
    .catch(() => []);

  return [
    ...new Set([
      // หน้าที่เขียนเป็นโค้ด เช่น หน้าแรก ทำเนียบกรรมการ
      ...CODED_ROUTES.map(withSlash),
      // หน้าที่ระบบจัดหน้าให้เอง เช่น ติดต่อสหกรณ์
      ...DESIGNED_PAGES.map((p) => withSlash(p.path)),
      // หน้าโปรแกรม เช่น ตรวจสุขภาพการเงิน
      ...PROGRAM_PATHS.map(withSlash),
      // หน้าเนื้อหาที่เจ้าหน้าที่สร้างเอง (เฉพาะที่เผยแพร่แล้ว)
      ...pages.map((p) => withSlash(p.slug)),
    ]),
  ];
}
