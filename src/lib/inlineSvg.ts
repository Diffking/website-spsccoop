/**
 * อ่านไฟล์ SVG ของโลโก้มาเป็นข้อความ เพื่อฝังลงหน้าเว็บตรง ๆ
 *
 * ฝังดีกว่าใส่ผ่าน <img> เพราะ (1) คมทุกความละเอียดโดยไม่ต้องรออีกหนึ่ง request
 * (2) ไม่มีจังหวะโลโก้กะพริบตอนโหลดหน้า (3) สั่งขนาด/สีจาก CSS ได้
 *
 * ใช้ฝั่ง server เท่านั้น — แตะไฟล์ในเครื่อง
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { sanitizeSvg } from "@/lib/svg";

/** ขนาดสูงสุดที่ยอมฝัง — ไฟล์ใหญ่กว่านี้ทำให้ HTML ทุกหน้าอ้วนขึ้นโดยไม่จำเป็น */
const MAX_INLINE_BYTES = 200 * 1024;

/**
 * คืนโค้ด SVG ที่ล้างแล้ว — ไม่ใช่ไฟล์ SVG ในเครื่อง อ่านไม่ได้ หรือใหญ่เกิน คืน null
 * (คนเรียกจะได้ถอยไปใช้ <img> ตามเดิม)
 */
export async function inlineSvg(url: string | null | undefined): Promise<string | null> {
  if (!url || !url.toLowerCase().endsWith(".svg")) return null;
  // เอาเฉพาะไฟล์ที่อยู่ใน uploads ของเราเอง — ไฟล์บนโดเมนอื่นไม่ไปดึงมาฝัง
  if (!url.startsWith("/uploads/")) return null;

  const name = path.basename(url);
  // กัน path traversal จากชื่อไฟล์ที่บันทึกไว้ในฐาน
  if (name !== url.slice("/uploads/".length)) return null;

  try {
    const file = path.join(process.cwd(), "public", "uploads", name);
    const raw = await readFile(file, "utf8");
    if (raw.length > MAX_INLINE_BYTES) return null;
    return sanitizeSvg(raw);
  } catch {
    // ไม่มีไฟล์/อ่านไม่ได้ ก็ให้หน้าเว็บใช้ <img> ต่อไป ไม่ใช่เรื่องต้องพังทั้งหน้า
    return null;
  }
}
