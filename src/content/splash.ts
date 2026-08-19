import data from "./splash.json";

/**
 * หน้า splash วันสำคัญ — เนื้อหาทั้งหมดอยู่ใน splash.json (แก้ผ่านหลังบ้าน /admin)
 *
 * แนวคิด: วันสำคัญของประเทศรู้วันล่วงหน้าหมด เลยเก็บเป็น "ช่วงวันที่" ไว้ก่อน
 * แล้วให้เว็บเช็คเองว่าวันนี้ตรงกับวันไหน ไม่ต้องมานั่งกดเปิด-ปิดตอนเที่ยงคืน
 * และพอเลยวันไปแล้วก็หยุดแสดงเอง ไม่ต้อง deploy ซ้ำ
 *
 * ⚠️ ต้องเลือกวันฝั่ง client เท่านั้น (ดู SplashGate/SplashView) — ถ้าเลือกตอน build
 * วันที่จะถูกแช่ไว้เป็นวันที่ build ตลอดไป เพราะเว็บเป็น static export
 */

export type SplashOccasion = {
  id: string;
  /** ชื่อวันสำคัญ — ใช้ในหลังบ้านอย่างเดียว ไม่ได้แสดงบนหน้าเว็บ */
  name: string;
  enabled: boolean;
  /** "MM-DD" = ทุกปี | "YYYY-MM-DD" = เฉพาะปีนั้น */
  from: string;
  to: string;
  image: string;
  alt: string;
  /** ข้อความเสริม — เว้นว่างได้ถ้าตัวหนังสืออยู่บนภาพอยู่แล้ว */
  headline: string;
  subtext: string;
  /** สีพื้นหลัง — คีย์จาก SPLASH_BACKGROUNDS (ไม่ระบุ = ดำสนิท) */
  bg?: string;
};

/** จะให้ขึ้นเมื่อไหร่ */
export type SplashTiming =
  /** เฉพาะช่วงวันที่ที่ตั้งไว้ในแต่ละวันสำคัญ (ปกติใช้แบบนี้) */
  | "schedule"
  /** ขึ้นเดี๋ยวนี้เลย ไม่ต้องรอถึงวัน — ใช้ตอนอยากโชว์ประกาศทันที หรือลองดูก่อนถึงวันจริง */
  | "now";

/** จะให้ขึ้นบ่อยแค่ไหน */
export type SplashRepeat =
  /** ครั้งเดียวต่อการเข้าเว็บหนึ่งครั้ง — เข้าแล้วเดินดูต่อจะไม่โดนเด้งซ้ำ */
  | "session"
  /** ทุกครั้งที่กลับมาหน้าแรก (เว้นช่วงสั้น ๆ หลังกดเข้าเว็บ ไม่งั้นจะวนไม่จบ) */
  | "always";

export type SplashContent = {
  /** สวิตช์ใหญ่ — ปิดแล้วหน้า splash ไม่ขึ้นเลยไม่ว่าวันสำคัญจะตรงหรือไม่ */
  enabled: boolean;
  buttonText: string;
  /** ไม่ระบุ = "schedule" (ของเดิมก่อนมีตัวเลือกนี้) */
  timing?: SplashTiming;
  /** ไม่ระบุ = "session" */
  repeat?: SplashRepeat;
  occasions: SplashOccasion[];
};

/**
 * หลังกดปุ่ม "เข้าสู่เว็บไซต์" ให้เว้นไปเท่านี้ก่อนจะเด้งได้อีก (โหมดทุกครั้ง)
 *
 * ถ้าไม่เว้น พอกดเข้าเว็บแล้วเด้งกลับหน้าวันสำคัญทันที กลายเป็นวนไม่จบ เข้าเว็บไม่ได้เลย
 */
export const SPLASH_GRACE_MS = 3 * 60 * 1000;

export const splashContent = data as SplashContent;

/** แปลง "MM-DD" หรือ "YYYY-MM-DD" เป็นตัวเลขไว้เทียบ — คืน null ถ้ารูปแบบผิด */
function parseDate(value: string): { year: number | null; md: number } | null {
  const m = /^(?:(\d{4})-)?(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year: m[1] ? Number(m[1]) : null, md: month * 100 + day };
}

/** วันนี้อยู่ในช่วงของวันสำคัญนี้ไหม */
export function isOccasionActive(o: SplashOccasion, now: Date): boolean {
  const from = parseDate(o.from);
  const to = parseDate(o.to);
  if (!from || !to) return false;

  const todayMd = (now.getMonth() + 1) * 100 + now.getDate();

  // ระบุปีไว้ = จัดครั้งเดียว ต้องตรงทั้งปีและวัน
  if (from.year !== null || to.year !== null) {
    const year = now.getFullYear();
    const today = year * 10000 + todayMd;
    const start = (from.year ?? year) * 10000 + from.md;
    const end = (to.year ?? year) * 10000 + to.md;
    return today >= start && today <= end;
  }

  // แบบทุกปี — ถ้า from > to แปลว่าช่วงคร่อมปีใหม่ (เช่น 12-30 ถึง 01-02)
  if (from.md <= to.md) return todayMd >= from.md && todayMd <= to.md;
  return todayMd >= from.md || todayMd <= to.md;
}

/** วันสำคัญที่ต้องแสดงวันนี้ — null = ไม่ต้องแสดง splash */
export function getActiveOccasion(
  content: SplashContent = splashContent,
  now: Date = new Date(),
): SplashOccasion | null {
  if (!content.enabled) return null;

  // โหมด "แสดงเดี๋ยวนี้" ข้ามการเช็ควันที่ไปเลย เอารายการแรกที่เปิดไว้
  if (content.timing === "now") {
    return content.occasions.find((o) => o.enabled) ?? null;
  }

  return content.occasions.find((o) => o.enabled && isOccasionActive(o, now)) ?? null;
}
