/**
 * ที่อยู่ไฟล์ที่ระบบเรายอมเปิดให้ — ใช้ตรวจก่อนดึงไฟล์มาส่งต่อ (ดู /api/pdf)
 *
 * ถ้ารับ URL อะไรก็ได้มาแล้ว fetch ตาม เว็บเราจะกลายเป็นตัวกลางให้คนอื่นใช้ยิงไฟล์
 * ไปที่เครื่องอื่นในเครือข่ายเดียวกัน (SSRF) — จึงต้องจำกัดไว้แค่ที่เก็บไฟล์ของเราเอง
 */

const ASSETS_BASE = (process.env.ASSETS_BASE_URL ?? "").trim().replace(/\/$/, "");

export function isAllowedAssetUrl(value: string): boolean {
  const url = value.trim();
  if (!url) return false;

  // ไฟล์ในเครื่องเรา เช่น /uploads/xxx.pdf — ต้องไม่มี .. ไต่ออกนอกโฟลเดอร์
  if (url.startsWith("/uploads/")) return !url.includes("..");

  // ไฟล์บนโดเมนเก็บ assets ที่ตั้งไว้ใน .env
  if (ASSETS_BASE && url.startsWith(`${ASSETS_BASE}/`)) return true;

  return false;
}
