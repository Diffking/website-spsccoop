import { PROGRAM_PATHS } from "@/lib/programPages";

/**
 * ตรวจว่าลิงก์ในเมนูกดแล้วไปถึงหน้าจริงหรือเปล่า
 *
 * เมนูพิมพ์ที่อยู่เองได้ พิมพ์ผิดตัวเดียวคนกดก็เจอหน้า 404 โดยไม่มีใครรู้
 * จนกว่าจะมีคนโทรมาบอก — หลังบ้านจึงต้องเตือนตั้งแต่ตอนแก้เมนู
 *
 * ไฟล์นี้ไม่แตะฐานข้อมูล ฝั่ง client จึง import ได้
 */

/**
 * หน้าที่เขียนไว้ในโค้ด (ไม่ได้อยู่ในตาราง Page) — เพิ่มหน้าใหม่ในโค้ดเมื่อไหร่ ต้องมาต่อท้ายที่นี่
 * ไม่งั้นหลังบ้านจะเตือนว่า "ยังไม่มีหน้า" ทั้งที่กดเข้าได้จริง
 */
export const CODED_ROUTES = ["/", "/about/directory/board", ...PROGRAM_PATHS];

export type LinkStatus =
  /** ไม่ได้ใส่ลิงก์ — เป็นหัวข้อไว้กางเมนูย่อยเฉย ๆ */
  | "heading"
  /** ลิงก์ออกไปเว็บอื่น ตรวจให้ไม่ได้ */
  | "external"
  /** มีหน้าอยู่จริง */
  | "ok"
  /** มีหน้าแล้วแต่ยังไม่เผยแพร่ — คนนอกยังเข้าไม่ได้ */
  | "draft"
  /** ยังไม่มีหน้า กดแล้วเจอ 404 */
  | "missing";

/** ตัดทั้ง / หน้าและหลังออก ให้เทียบกับ slug ในฐานได้ตรง ๆ */
export const toSlug = (href: string) => href.trim().replace(/^\/+|\/+$/g, "");

export function linkStatus(
  href: string,
  pages: { slug: string; published: boolean }[],
): LinkStatus {
  const value = href.trim();
  if (!value) return "heading";
  if (/^(https?:)?\/\//i.test(value) || /^(mailto:|tel:|#)/i.test(value)) return "external";

  // เทียบแบบไม่สนใจ / ปิดท้าย เพราะเว็บนี้ตั้งค่าให้ทุก URL ลงท้ายด้วย /
  const slug = toSlug(value);
  if (CODED_ROUTES.some((route) => toSlug(route) === slug)) return "ok";

  const page = pages.find((p) => p.slug === slug);
  if (!page) return "missing";
  return page.published ? "ok" : "draft";
}

export const STATUS_STYLE: Record<LinkStatus, { label: string; className: string }> = {
  heading: { label: "หัวข้อเมนู", className: "bg-gray-100 text-gray-500" },
  external: { label: "ลิงก์ภายนอก", className: "bg-sky-50 text-sky-700" },
  ok: { label: "มีหน้าแล้ว", className: "bg-emerald-50 text-emerald-700" },
  draft: { label: "ยังไม่เผยแพร่", className: "bg-amber-50 text-amber-700" },
  missing: { label: "ยังไม่มีหน้า", className: "bg-red-50 text-red-600" },
};
