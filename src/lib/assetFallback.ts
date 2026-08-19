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

/** ใส่ backslash หน้าอักขระพิเศษ — สร้าง regex จากที่อยู่เว็บที่มีจุดกับสแลชอยู่เต็ม */
const escapeRegExp = (value: string) =>
  value
    .split("")
    .map((c) => (".*+?^${}()|[]\\".includes(c) ? "\\" + c : c))
    .join("");

/**
 * แปลงทุกที่อยู่ที่โผล่ในก้อน HTML (src/href ของเนื้อหาหน้าเว็บ)
 *
 * ต้องจับแบบที่ถูกเข้ารหัสไว้ด้วย — ลิงก์ "อ่านแบบ E-Book" เก็บที่อยู่ไฟล์ไว้ใน
 * ?src=https%3A%2F%2F... ซึ่งไม่ตรงกับรูปแบบธรรมดา ปล่อยไว้จะเหลือที่อยู่ของโดเมนที่ล่มแล้ว
 * ค้างในลิงก์ กดแล้วเปิดไม่ได้ทั้งที่ไฟล์ยังอยู่ครบในเครื่อง
 */
export function localAssetsInHtml(html: string): string {
  if (!ASSETS_BASE) return html;

  const plain = new RegExp(`${escapeRegExp(ASSETS_BASE)}/[^"'\\s)]+`, "g");
  const encoded = new RegExp(
    `${escapeRegExp(encodeURIComponent(ASSETS_BASE))}(?:%2F|/)[^"'\\s)&]+`,
    "gi",
  );

  return html
    .replace(plain, (match) => localAsset(match))
    .replace(encoded, (match) => encodeURIComponent(localAsset(decodeURIComponent(match))));
}

/**
 * ลำดับที่อยู่ที่ควรลองดึงไฟล์ — สำเนาในเครื่องก่อน ค่อยตกไปที่โดเมน assets
 *
 * ใช้กับตัวส่งต่อไฟล์ PDF (/api/pdf, /api/ebook) ที่ต้อง fetch ไฟล์จริงมาส่งให้เบราว์เซอร์
 * โดเมน assets ล่มเมื่อไหร่ ตัวส่งต่อจะดึงไม่ได้แล้วขึ้น "เปิดเอกสารไม่สำเร็จ" ทั้งที่ไฟล์
 * ยังอยู่ครบในเครื่อง (เกิดขึ้นมาแล้วตอน beta.spsccoop.com หายจาก DNS)
 *
 * เอาสำเนาในเครื่องขึ้นก่อนเสมอ เพราะเร็วกว่าและไม่ต้องออกไปนอกเครื่องอยู่แล้ว
 */
export function assetCandidates(url: string, requestUrl: string): string[] {
  const list: string[] = [];
  const local = localAsset(url);

  const absolute = (value: string) =>
    value.startsWith("/") ? new URL(value, requestUrl).toString() : value;

  if (local && local !== url) list.push(absolute(local));
  if (url) list.push(absolute(url));
  return list;
}
