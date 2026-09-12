/**
 * ดึงกิจกรรมจากระบบสำนักงาน (CoopSmile officer) มาลงปฏิทินหน้าแรก
 *
 * หลักการเดียวกับวันหยุด (ดู src/lib/holidaySource.ts) — เจ้าหน้าที่ลงตารางรถตู้
 * กับกิจกรรมไว้ที่ระบบสำนักงานอยู่แล้ว การมาพิมพ์ซ้ำในเว็บอีกรอบคือที่มาของ
 * ข้อมูลสองที่ไม่ตรงกัน · **ดึงมาเก็บในฐานของเว็บ ไม่ได้อ่านสดตอนสมาชิกเปิดหน้าเว็บ**
 * เพราะต้นทางล่มเมื่อไหร่ปฏิทินจะหายทั้งแผงทันที และดึงมาแล้วยังแก้ต่อ/ซ่อนได้ตามปกติ
 *
 * ต้นทางมี 2 เส้นทาง (อ่านได้จากโค้ดหน้า /web/admin/holidays ของระบบนั้น)
 *   · `/activity`     → โครงการ · สัมมนา  (มีชื่อเรื่องมาให้)
 *   · `/van-service`  → รถตู้เคลื่อนที่    (ไม่มีชื่อเรื่อง มีแต่สถานที่กับช่วงเวลา)
 *
 * ตั้งที่อยู่ที่ OFFICER_EVENT_SOURCE_URL ใน .env — ไม่ตั้ง = ซ่อนปุ่มดึงข้อมูลไปเลย
 * (หลักเดียวกับ HOLIDAY_SOURCE_URL) ตัวอย่างค่า: https://officer.coopsmile.org/liff/admin
 */

/** ชนิดกิจกรรมที่ปฏิทินหน้าแรกรู้จัก — ตรงกับ EVENT_TYPES ใน src/lib/homeItems.ts */
export type SourceEventType = "mobile" | "project" | "seminar";

export type SourceEvent = {
  /** "YYYY-MM-DD" ตามปฏิทินสากล */
  date: string;
  type: SourceEventType;
  title: string;
  /** สถานที่ — ว่างได้ */
  place: string;
  /** ช่วงเวลาแบบที่เขียนบนปฏิทิน เช่น "12.00-15.00" — ว่างได้ */
  time: string;
};

export type OfficerResult =
  | { ok: true; events: SourceEvent[]; missing: string[] }
  | { ok: false; error: string };

/** ที่อยู่ต้นทาง — ว่าง = ยังไม่ได้ตั้งค่า ฟีเจอร์นี้ถูกซ่อน */
export function officerSourceUrl(): string {
  return (process.env.OFFICER_EVENT_SOURCE_URL ?? "").trim().replace(/\/+$/, "");
}

/** ชื่อเครื่องต้นทางแบบอ่านง่าย ไว้โชว์ในหลังบ้าน — อ่านไม่ออกก็คืนค่าเดิม */
export function officerSourceLabel(): string {
  const url = officerSourceUrl();
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

const isDate = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

/**
 * "13:00" + "15:00" → "13.00-15.00" — จุดไม่ใช่ทวิภาค เพราะปฏิทินหน้าแรกเขียนแบบนี้
 * มาไม่ครบก็ใช้เท่าที่มี · ไม่มีเลยคืนค่าว่างแล้วไปใช้ชื่อช่วงเวลาแทน
 */
function timeRange(start: unknown, end: unknown): string {
  const from = text(start).replace(":", ".");
  const to = text(end).replace(":", ".");
  if (from && to) return `${from}-${to}`;
  return from || to;
}

/** ขอข้อมูลหนึ่งเส้นทาง — ต่อไม่ติดคืน null ไม่ throw ให้หน้าหลังบ้านพังทั้งหน้า */
async function get(url: string): Promise<unknown | null> {
  try {
    // ตัดจบที่ 8 วินาที — ไม่ตอบภายในนี้ถือว่าต้นทางไม่พร้อม ไม่ใช่ช้า
    const response = await fetch(url, { signal: AbortSignal.timeout(8000), cache: "no-store" });
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error(`ดึงกิจกรรมจากระบบสำนักงานไม่สำเร็จ (${url}):`, error);
    return null;
  }
}

/** โครงการ/สัมมนา — ต้นทางส่ง type มาให้ตรงกับของเราอยู่แล้ว ที่ไม่รู้จักถือเป็นโครงการ */
function readActivity(data: unknown): SourceEvent[] {
  const rows = (data as { activity?: unknown })?.activity;
  if (!Array.isArray(rows)) return [];

  return rows.flatMap((raw): SourceEvent[] => {
    const row = raw as Record<string, unknown>;
    if (!isDate(row.date)) return [];

    const title = text(row.title);
    if (!title) return [];

    const type = row.type === "mobile" || row.type === "seminar" ? row.type : "project";
    return [
      {
        date: row.date,
        type,
        title,
        place: text(row.location),
        time: timeRange(row.start, row.end),
      },
    ];
  });
}

/**
 * รถตู้เคลื่อนที่ — ต้นทางไม่มีชื่อเรื่องมาให้ มีแต่สถานที่กับช่วงเวลา
 * จึงตั้งชื่อให้เองให้ตรงกับที่เคยพิมพ์มือไว้ในปฏิทิน ("บริการรถตู้เคลื่อนที่")
 * ส่วนโรงพยาบาลปลายทางไปอยู่ช่องสถานที่ ซึ่งปฏิทินโชว์ให้อยู่แล้ว
 */
function readVan(data: unknown): SourceEvent[] {
  const rows = (data as { van?: unknown })?.van;
  if (!Array.isArray(rows)) return [];

  return rows.flatMap((raw): SourceEvent[] => {
    const row = raw as Record<string, unknown>;
    if (!isDate(row.date)) return [];

    return [
      {
        date: row.date,
        type: "mobile",
        title: "บริการรถตู้เคลื่อนที่",
        place: text(row.location),
        // ไม่ได้ระบุเวลา = ใช้ชื่อช่วงที่ต้นทางเขียนไว้ เช่น "บางช่วง" ดีกว่าเว้นว่าง
        time: timeRange(row.start, row.end) || text(row.slot_label),
      },
    ];
  });
}

/**
 * ดึงทั้งสองเส้นทาง
 *
 * เส้นทางหนึ่งล่มไม่ทำให้ทั้งก้อนล้ม — คืนเท่าที่ได้แล้วบอกใน `missing` ว่าขาดอะไรไป
 * เจ้าหน้าที่จะได้รู้ว่ารายการที่เห็นยังไม่ครบ ไม่ใช่เข้าใจว่าต้นทางไม่มีข้อมูล
 */
export async function fetchOfficerEvents(): Promise<OfficerResult> {
  const base = officerSourceUrl();
  if (!base) {
    return { ok: false, error: "ยังไม่ได้ตั้งค่าที่อยู่ระบบต้นทาง (OFFICER_EVENT_SOURCE_URL)" };
  }

  const [activity, van] = await Promise.all([
    get(`${base}/activity`),
    get(`${base}/van-service`),
  ]);

  if (activity === null && van === null) {
    return { ok: false, error: `ต่อกับระบบสำนักงานไม่ได้ — ${officerSourceLabel()}` };
  }

  const missing: string[] = [];
  if (activity === null) missing.push("โครงการ/สัมมนา");
  if (van === null) missing.push("รถตู้");

  const events = [...readActivity(activity), ...readVan(van)].sort(
    (a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title),
  );

  return { ok: true, events, missing };
}

/**
 * ตัดคำที่เขียนไม่เหมือนกันสองที่ให้เหลือรูปเดียว ก่อนเอาไปเทียบว่าเป็นรายการเดียวกันไหม
 *
 * ⚠️ เรื่องนี้ไม่ใช่ของเกิน — ของจริงเขียนคนละแบบทั้งคู่ (ตรวจเมื่อ 12 ก.ย. 2569)
 *   เว็บพิมพ์ "รพ.ควนเนียง"  ·  ต้นทางส่ง "โรงพยาบาลควนเนียง"
 * ถ้าเทียบตรงตัวจะกลายเป็นคนละรายการ แล้วการดึงครั้งแรกจะได้รถตู้ซ้ำทั้งเดือน
 *
 * ใช้ตอน **เทียบ** เท่านั้น ของที่บันทึกลงฐานยังเป็นข้อความเต็มจากต้นทางตามเดิม
 */
const normalize = (value: string) =>
  value
    .replace(/\s+/g, "")
    .replace(/โรงพยาบาล/g, "รพ.")
    .replace(/^(โครงการ|กิจกรรม|งาน)/, "");

/**
 * รหัสประจำรายการ — วันที่ + ชนิด + สถานที่
 *
 * ยึดสถานที่เป็นตัวระบุ ไม่ใช่ชื่อเรื่อง เพราะรถตู้ใช้ชื่อเดียวกันทุกใบ วันเดียวกัน
 * อาจวิ่งสองโรงพยาบาล ถ้าตัดสถานที่ออกจะกลายเป็นรายการเดียวกันแล้วหายไปหนึ่งใบ
 * · รายการที่ไม่ระบุสถานที่ถึงค่อยใช้ชื่อเรื่องแทน จะได้ยังแยกออกจากกัน
 *
 * ⚠️ ผลที่ตามมา: แก้ **สถานที่** ที่ต้นทาง จะเข้ามาเป็นรายการใหม่ ของเดิมค้างอยู่
 * ต้องลบเองในหน้าปฏิทิน — ยอมแลกกับการไม่ทำให้รถตู้หลายคันในวันเดียวกันหายไปเอง
 */
export const eventKey = (e: { date: string; type: string; title: string; place: string }) =>
  `${e.date}|${e.type}|${normalize(e.place) || normalize(e.title)}`;

export type EventStatus = "new" | "same" | "changed";

/** รายการเดียวกันที่มีอยู่ในเว็บแล้ว — ไว้บอกว่าจะทับอะไร และอัปเดตด้วย id ตัวไหน */
export type CurrentEvent = {
  id: string;
  date: string;
  type: string;
  title: string;
  place: string;
  time: string;
};

export type ComparedEvent = SourceEvent & {
  status: EventStatus;
  /** ของที่มีอยู่ในเว็บตอนนี้ — มีเฉพาะตอน status = same หรือ changed */
  current?: CurrentEvent;
};

/**
 * เทียบของจากต้นทางกับที่มีอยู่ในเว็บ — บอกว่าจะเพิ่มอะไร รายละเอียดไม่ตรงกันตรงไหน
 *
 * "changed" = เป็นรายการเดียวกัน (วันเดียวกัน ชนิดเดียวกัน ที่เดียวกัน) แต่ชื่อเรื่อง
 * หรือช่วงเวลาเขียนไม่ตรงกัน · ไม่ถือว่าผิด เพราะเจ้าหน้าที่อาจตั้งใจแก้ในเว็บเอง
 * จึงไม่ทับให้เอง ต้องติ๊กยืนยันก่อน
 */
export function compareEvents(source: SourceEvent[], current: CurrentEvent[]): ComparedEvent[] {
  const byKey = new Map(current.map((event) => [eventKey(event), event]));

  return source.map((item) => {
    const existing = byKey.get(eventKey(item));
    if (!existing) return { ...item, status: "new" as const };

    const same =
      normalize(existing.title) === normalize(item.title) &&
      normalize(existing.time) === normalize(item.time);

    return { ...item, status: same ? ("same" as const) : ("changed" as const), current: existing };
  });
}
