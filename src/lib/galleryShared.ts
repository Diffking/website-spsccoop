/**
 * แกลเลอรีภาพกิจกรรม — ตรรกะล้วน ไม่แตะฐาน ใช้ได้ทั้งหน้าจอหลังบ้านและฝั่งเซิร์ฟเวอร์
 *
 * หลักของหน้านี้ (เจ้าของเว็บกำหนด 16 พ.ย. 2569): เก็บ "ภาพเด่น" อัลบั้มละ 1 ภาพในเครื่องเรา
 * ภาพที่เหลือทั้งหมดอยู่บนบริการภายนอก (Google Photos ฯลฯ) ผ่านลิงก์ — ไม่เก็บไฟล์เยอะ
 *
 * ⚠️ ห้ามลิงก์ภาพจาก Google Photos มาโชว์ตรง ๆ แทนการอัปภาพเด่น — ที่อยู่ภาพแบบนั้น
 * Google ไม่รับรองว่าถาวร หมดอายุเมื่อไหร่รูปแตกทั้งหน้า
 */

/** โฟลเดอร์ภาพเด่นใต้ uploads (ต้องตรงกับ FOLDERS ใน assetFolders.ts) */
export const GALLERY_FOLDER = "gallery";

/** ย่อภาพเด่นให้ด้านยาวไม่เกินนี้ — ภาพเป็นพระเอกของการ์ด 600 ของค่าตั้งต้นจะดูแตก */
export const GALLERY_MAX_EDGE = 1200;

/**
 * โดเมนอัลบั้มที่ยอมรับ — กันคนวางลิงก์แปลก ๆ (เว็บพนัน/ฟิชชิง) ลงหน้าเว็บสหกรณ์
 * เพิ่มบริการใหม่ได้ที่นี่ที่เดียว ทั้งหลังบ้านและ API ใช้รายการนี้
 */
export const ALBUM_HOSTS = [
  "photos.app.goo.gl",
  "photos.google.com",
  "drive.google.com",
  "facebook.com",
  "www.facebook.com",
  "m.facebook.com",
  "web.facebook.com",
] as const;

/** ชื่อบริการที่โชว์ใต้ปุ่ม "ดูภาพทั้งหมด" */
export function albumServiceName(url: string): string {
  const host = hostOf(url);
  if (!host) return "เว็บภายนอก";
  if (host.endsWith("facebook.com")) return "Facebook";
  if (host === "drive.google.com") return "Google Drive";
  return "Google Photos";
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** ลิงก์อัลบั้มใช้ได้ไหม — ต้องเป็น https และโดเมนอยู่ใน ALBUM_HOSTS เท่านั้น */
export function cleanAlbumUrl(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const value = input.trim();
  if (value.length > 600) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  if (!(ALBUM_HOSTS as readonly string[]).includes(url.hostname.toLowerCase())) return null;
  return url.toString();
}

/** ภาพเด่นต้องเป็นไฟล์ที่อัปเข้าเครื่องนี้เท่านั้น */
export function cleanCoverUrl(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const value = input.trim();
  return /^\/uploads\/[A-Za-z0-9._-]{1,120}$/.test(value) ? value : null;
}

/* ------------------------------------------------------------------ */
/* ปีบัญชี — 1 ต.ค. ถึง 30 ก.ย. ตั้งชื่อตามปี พ.ศ. ที่สิ้นสุด            */
/* เช่น 1 ต.ค. 2569 – 30 ก.ย. 2570 = ปีบัญชี 2570                       */
/* ------------------------------------------------------------------ */

const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" });

/** ปีบัญชี (พ.ศ.) ของวันที่หนึ่ง — คิดตามเวลาไทยเสมอ */
export function fiscalYearOf(date: Date): number {
  const [y, m] = ymd.format(date).split("-").map(Number);
  return y + 543 + (m >= 10 ? 1 : 0);
}

/** ช่วงวันที่ของปีบัญชี — `from` รวม · `to` ไม่รวม (เที่ยงคืนเวลาไทย) */
export function fiscalRange(fy: number): { from: Date; to: Date } {
  const endCE = fy - 543;
  return {
    from: new Date(`${endCE - 1}-10-01T00:00:00+07:00`),
    to: new Date(`${endCE}-10-01T00:00:00+07:00`),
  };
}

/** "1 ต.ค. 2569 – 30 ก.ย. 2570" */
export function fiscalRangeLabel(fy: number): string {
  return `1 ต.ค. ${fy - 1} – 30 ก.ย. ${fy}`;
}

/** รับเฉพาะเลขปีบัญชีที่สมเหตุสมผล กันคนพิมพ์ที่อยู่ /gallery/99999/ */
export function isFiscalYear(value: number): boolean {
  return Number.isInteger(value) && value >= 2540 && value <= 2700;
}

const longDate = new Intl.DateTimeFormat("th-TH", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Asia/Bangkok",
});

/** "วันอาทิตย์ที่ 15 มีนาคม 2570" */
export function albumDateLabel(date: Date): string {
  return longDate.format(date);
}

/** YYYY-MM-DD ตามเวลาไทย — ค่าที่ ThaiDatePicker ใช้ */
export function dateValue(date: Date | string): string {
  return ymd.format(typeof date === "string" ? new Date(date) : date);
}
