import data from "./splash.json";

/**
 * หน้า splash วันสำคัญ — เนื้อหาทั้งหมดอยู่ใน splash.json (แก้ผ่านหลังบ้าน /admin)
 *
 * แนวคิด: วันสำคัญของประเทศรู้วันล่วงหน้าหมด เลยเก็บเป็น "ช่วงวันที่" ไว้ก่อน
 * แล้วให้เว็บเช็คเองว่าวันนี้ตรงกับวันไหน ไม่ต้องมานั่งกดเปิด-ปิดตอนเที่ยงคืน
 * และพอเลยวันไปแล้วก็หยุดแสดงเอง ไม่ต้อง deploy ซ้ำ
 *
 * ⚠️ ต้องเลือกวันฝั่ง client เท่านั้น (ดู SplashGate/SplashView) — เดิมเพราะเว็บเป็น
 * static export แล้ววันที่จะแช่เป็นวันที่ build · ตอนนี้รันเป็น Node server แล้วแต่กฎ
 * ยังเหมือนเดิม เพราะคอนเทนเนอร์ web ไม่ได้ตั้ง TZ ไทย (ตี 1 ไทยยังเป็นเมื่อวานในเครื่อง)
 * และสำเนาบน www.spsccoop.com ถูกแคชอีก 120 วิ ซึ่งคร่อมเที่ยงคืนได้
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
  /** นับถอยหลังกี่วินาทีแล้วพาเข้าเว็บเอง — 0 หรือไม่ระบุ = ไม่นับ ให้กดปุ่มเอง */
  autoEnterSeconds?: number;
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

/**
 * ตัวไต่เว็บของเครื่องมือค้นหา — ต้องไม่โดนเด้งไปหน้าวันสำคัญ
 *
 * ⚠️ ครอว์เลอร์ของกูเกิลรัน JS ด้วย (เมื่อก่อนไม่รัน) ถ้าปล่อยให้มันโดนเด้ง มันจะไปเจอ
 * ป้ายห้ามเก็บที่หน้านั้น แล้วสรุปว่า "หน้าแรกจัดทำดัชนีไม่ได้" — เว็บหายจากกูเกิลทั้งเว็บ
 * โดยที่หน้าเว็บสำหรับคนยังปกติดีทุกอย่าง หาสาเหตุยากมาก
 *
 * อยู่ที่นี่เพราะมีคนใช้สามที่: SplashGate · สคริปต์เด้งก่อนวาดหน้า (splashRedirect.ts)
 * — แยกกันเขียนเมื่อไหร่ วันหลังแก้ที่เดียวแล้วอีกที่หลุดเงียบ ๆ
 */
export const CRAWLER_UA =
  /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|lighthouse|headless/i;

/** นานสุดที่ตั้งตัวนับถอยหลังได้ — กันตั้งเป็นหลักชั่วโมงแล้วหน้าค้างอยู่อย่างนั้น */
export const MAX_AUTO_ENTER_SECONDS = 60;

/**
 * ตัวนับถอยหลังบนหน้าวันสำคัญกี่วินาที — 0 = ไม่นับ ให้กดปุ่มเอง (ค่าตั้งต้น)
 *
 * ค่าที่อ่านไม่ออกถอยเป็น 0 เสมอ — ไม่นับยังไงก็ปลอดภัยกว่านับด้วยเลขมั่ว ๆ
 */
export function autoEnterSeconds(content: SplashContent): number {
  const raw = Number(content.autoEnterSeconds);
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return Math.min(Math.trunc(raw), MAX_AUTO_ENTER_SECONDS);
}

/**
 * ช่วงวันที่ที่ต้องเด้งไปหน้าวันสำคัญ เป็นตัวเลข YYYYMMDD ไว้เทียบตรง ๆ
 *
 * มีไว้ให้ "สคริปต์เด้งก่อนวาดหน้า" ใช้ — สคริปต์ตัวนั้นเป็นข้อความ JS ฝังใน HTML
 * import อะไรไม่ได้ ถ้าให้มันแปลงวันที่เองต้องลอก parseDate/isOccasionActive ไปทั้งชุด
 * แล้ววันหลังแก้กฎวันที่ที่ไฟล์นี้ อีกฝั่งจะเพี้ยนแบบเงียบ ๆ (บทเรียนเดียวกับ normalize()
 * ของตัวดึงกิจกรรม) · ที่นี่คำนวณให้เสร็จ เหลือให้สคริปต์แค่เทียบเลขสองตัว
 *
 * ⚠️ ยังต้องให้เบราว์เซอร์เป็นคนบอกว่า "วันนี้" คือวันอะไร ไม่ใช่เซิร์ฟเวอร์ —
 * คอนเทนเนอร์ web ไม่ได้ตั้ง TZ ไทย และสำเนาบนโฮสต์ยังถูกแคชอีก 120 วิ
 * จึงทำได้แค่ส่ง "ช่วงวัน" ไปให้ แล้วให้ฝั่งโน้นเทียบกับนาฬิกาของผู้อ่านเอง
 */
export function splashWindows(
  content: SplashContent,
  now: Date = new Date(),
): [number, number][] {
  if (!content.enabled) return [];

  const occasions = content.occasions.filter((o) => o.enabled);
  if (occasions.length === 0) return [];

  // โหมด "แสดงเดี๋ยวนี้" ไม่สนวันที่ — ช่วงที่ครอบทุกวัน
  if (content.timing === "now") return [[0, 99999999]];

  const windows: [number, number][] = [];
  const base = now.getFullYear();

  for (const o of occasions) {
    const from = parseDate(o.from);
    const to = parseDate(o.to);
    if (!from || !to) continue;

    /*
      คิดเผื่อปีก่อนหน้าและปีถัดไปด้วย เพราะนาฬิกาของผู้อ่านอาจข้ามปีไปแล้ว
      ในขณะที่สำเนาหน้านี้ถูกสร้างไว้ตั้งแต่ปีเก่า (แคชบนโฮสต์ 120 วิ · แท็บที่เปิดค้าง)
    */
    for (const year of [base - 1, base, base + 1]) {
      if (from.year !== null || to.year !== null) {
        // ระบุปีไว้ = จัดครั้งเดียว · ฝั่งที่ไม่ได้ระบุปีถือว่าเป็นปีที่กำลังไล่อยู่
        const start = (from.year ?? year) * 10000 + from.md;
        const end = (to.year ?? year) * 10000 + to.md;
        if (start <= end) windows.push([start, end]);
        continue;
      }

      // แบบทุกปี — from > to แปลว่าช่วงคร่อมปีใหม่ (เช่น 12-30 ถึง 01-02)
      const start = year * 10000 + from.md;
      const end = (from.md <= to.md ? year : year + 1) * 10000 + to.md;
      windows.push([start, end]);
    }
  }

  // ระบุปีไว้ครบทั้งสองฝั่ง = ไล่ปีไหนก็ได้ช่วงเดิม — ตัดที่ซ้ำทิ้ง ไม่ต้องส่งไปสามชุด
  const seen = new Set<string>();
  return windows.filter(([start, end]) => {
    const key = `${start}-${end}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
