/**
 * ที่อยู่ไฟล์ที่ใช้แสดงผลจริง — ถ้าเป็นไฟล์บนโดเมนเก็บ assets ให้ชี้มาที่สำเนาในเครื่องแทน
 *
 * ระบบเก็บไฟล์ไว้สองที่เสมอ (uploads/ ของเครื่องนี้ + โดเมน assets) แต่ที่อยู่ที่บันทึกลงฐาน
 * เป็นของโดเมน assets — วันไหนโดเมนนั้นล่ม/ถูกย้าย รูปกับไฟล์ทั้งเว็บจะหายทันที
 * (เกิดขึ้นมาแล้วกับ beta.spsccoop.com ที่หายไปจาก DNS)
 *
 * ตัวแปลงนี้ทำงานตอนแสดงผลเท่านั้น — ข้อมูลในฐานยังเป็นที่อยู่เดิมทุกตัวอักษร
 * เจ้าของเว็บย้ายไฟล์เสร็จเมื่อไหร่ ก็แค่เอาตัวแปลงนี้ออก ไม่ต้องตามแก้ข้อมูล
 */

const ASSETS_BASE = (process.env.ASSETS_BASE_URL ?? "").trim().replace(/\/$/, "");

/** แปลงที่อยู่เดียว — ไม่ใช่ไฟล์บนโดเมน assets ก็คืนค่าเดิม */
export function localAsset(url: string | null | undefined): string {
  if (!url || !ASSETS_BASE || !url.startsWith(`${ASSETS_BASE}/`)) return url ?? "";
  // เก็บเฉพาะชื่อไฟล์ท้ายสุด — สำเนาในเครื่องอยู่รวมกันใน uploads/ ไม่ได้แยกโฟลเดอร์
  const name = url.split("/").pop();
  return name ? `/uploads/${name}` : url;
}

/** แปลงทุกที่อยู่ที่โผล่ในก้อน HTML (src/href ของเนื้อหาหน้าเว็บ) */
export function localAssetsInHtml(html: string): string {
  if (!ASSETS_BASE) return html;
  const pattern = new RegExp(`${ASSETS_BASE.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}/[^"'\\s)]+`, "g");
  return html.replace(pattern, (match) => localAsset(match));
}
