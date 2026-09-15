import { db } from "@/lib/db";
import {
  compareEvents,
  eventKey,
  fetchOfficerEvents,
  type ComparedEvent,
  type CurrentEvent,
  type SourceEvent,
} from "@/lib/officerEvents";
import { purgeEverySite } from "@/lib/mirrorPurge";

/**
 * เอากิจกรรมจากระบบสำนักงานเข้าฐานของเว็บ (ดู src/lib/officerEvents.ts)
 *
 * ใช้ร่วมกันสองทางเหมือนวันหยุด: ปุ่มในหลังบ้าน (`/api/admin/home/calendar/source`)
 * กับตัวดึงอัตโนมัติ (`/api/calendar/sync` ที่ service `holiday-sync` เรียกทุก 6 ชม.)
 * — ต้องเป็นตัวเดียวกัน ไม่งั้นวันดีคืนดีสองทางทำงานไม่เหมือนกันแล้วหาสาเหตุไม่เจอ
 *
 * **ต่างกันแค่ "ใครเลือกอะไร"** — เจ้าหน้าที่ติ๊กเป็นรายรายการได้ทั้งเพิ่ม ทับ และลบ
 * ส่วนตัวดึงอัตโนมัติ **เพิ่มของใหม่ทุกชนิด** และ **อัปเดต/ลบเฉพาะรอบรถตู้ที่มาจากระบบสำนักงาน**
 * (`followVan`) — เจ้าของเว็บสั่ง 15 ก.ย. 2569 เพราะหน้า /offices/mobile-van/ เอารอบรถตู้
 * ไปโชว์เป็นตารางออกหน่วย ถ้าสำนักงานเลื่อน/ยกเลิกแล้วเว็บไม่ตาม สมาชิกจะไปผิดที่ผิดเวลา
 * · กิจกรรมที่เจ้าหน้าที่พิมพ์เอง (`source = null`) และโครงการ/สัมมนา ยังไม่ถูกแตะเหมือนเดิม
 *
 * **ไม่มีอะไรเปลี่ยน = ไม่แตะฐาน ไม่ล้างสำเนาบนโฮสต์** ตัวดึงอัตโนมัติจึงวิ่งฟรีได้ทั้งวัน
 */

export type EventSyncResult =
  | { ok: true; added: number; changed: number; removed: number }
  | { ok: false; error: string; status: number };

/**
 * สิ่งที่เจ้าหน้าที่ติ๊กมาจากหน้าจอ
 *
 * `addAll` มีไว้ให้ตัวดึงอัตโนมัติเท่านั้น — ฝั่งหน้าจอส่งรายการที่ติ๊กมาตรง ๆ เสมอ
 * จะได้ไม่มีทางที่การกดปุ่มหนึ่งครั้งไปทำอะไรที่ไม่ได้เห็นบนจอ
 */
export type SyncSelection = {
  addAll?: boolean;
  /**
   * ให้รอบรถตู้ที่มาจากระบบสำนักงานตามต้นทาง — อัปเดตเวลาที่เปลี่ยน ลบรอบที่ต้นทางไม่มีแล้ว
   * ตัวดึงอัตโนมัติเท่านั้น (ดู followVanPlan)
   */
  followVan?: boolean;
  /** รหัสรายการจากต้นทาง (ดู eventKey) ที่จะเพิ่มเข้าเว็บ */
  addKeys?: string[];
  /** id ของแถวในเว็บที่ยอมให้เอาข้อมูลจากต้นทางทับ */
  updateIds?: string[];
  /** id ของแถวในเว็บที่จะลบทิ้ง */
  removeIds?: string[];
};

/** วันที่แบบไทย "YYYY-MM-DD" ของค่าที่เก็บเป็นเที่ยงคืนเวลาไทย */
const thaiYmd = (date: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(date);

/** วันที่ล้วน (YYYY-MM-DD) → เที่ยงคืนเวลาไทย — ตรงกับที่ตาราง CalendarEvent เก็บ */
function thaiMidnight(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00+07:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * เอาเฉพาะตั้งแต่ต้นเดือนนี้เป็นต้นไป
 *
 * ต้นทางเก็บย้อนหลังหลายเดือน (ตอนทำมีรถตู้ย้อนไปถึงเดือนมิถุนายน) แต่ปฏิทินหน้าแรก
 * โชว์ทีละเดือนอยู่แล้ว ดึงของเก่าเข้ามาก็ไม่มีใครเห็น มีแต่ทำให้หน้าปฏิทินในหลังบ้านรก
 */
const monthStart = () => `${thaiYmd(new Date()).slice(0, 7)}-01`;

/** กิจกรรมในเว็บที่ระบุวันที่ไว้ — รายการเก่าที่มีแต่เลขวันเทียบกับต้นทางไม่ได้ จึงไม่นับ */
export async function currentEvents(): Promise<CurrentEvent[]> {
  const rows = await db.calendarEvent.findMany({
    where: { date: { not: null } },
    select: { id: true, date: true, type: true, title: true, place: true, time: true, source: true },
  });

  return rows.map((row) => ({
    id: row.id,
    date: row.date ? thaiYmd(row.date) : "",
    type: row.type,
    title: row.title,
    place: row.place ?? "",
    time: row.time ?? "",
    source: row.source,
  }));
}

export const OFFICER_SOURCE = "officer";

/**
 * รอบรถตู้ที่ต้องตามต้นทาง — ใช้เฉพาะตัวดึงอัตโนมัติ
 *
 * แตะเฉพาะแถว `type = mobile` ที่ `source = officer` เท่านั้น
 *   - **อัปเดต** รอบที่เป็นรายการเดียวกัน (วัน + สถานที่) แต่ชื่อ/เวลาไม่ตรง
 *   - **ลบ** รอบที่ยังไม่ถึงวัน แต่ต้นทางไม่มีแล้ว (ยกเลิก หรือย้ายสถานที่ — ย้ายสถานที่
 *     จะได้รอบใหม่เข้ามาแทนจาก addAll ในรอบเดียวกัน)
 *
 * ⚠️ **ไม่ลบเลยสักรายการ ถ้าไม่แน่ใจว่าได้รายการรถตู้ครบ** — เส้นทางรถตู้ของต้นทางล่ม
 * (`missing`) หรือต้นทางส่งรถตู้มาศูนย์รายการ · ไม่งั้นวันที่ต้นทางมีปัญหาครู่เดียว
 * ตารางออกหน่วยบนหน้าเว็บจะหายเกลี้ยง ยอมแลกกับกรณีที่สำนักงานยกเลิกรถตู้ทุกรอบจริง ๆ
 * (ต้องลบเองในหน้าปฏิทิน)
 *
 * ⚠️ รอบที่ผ่านไปแล้วไม่ลบ ต้นทางอาจเลิกส่งของเก่ามา ไม่ได้แปลว่ายกเลิก
 */
function followVanPlan(loaded: Extract<Loaded, { ok: true }>, fresh: SourceEvent[]) {
  const official = (row: CurrentEvent | undefined) =>
    row?.type === "mobile" && row.source === OFFICER_SOURCE;

  const update = loaded.items.filter(
    (item) => item.status === "changed" && official(item.current),
  );

  const vans = fresh.filter((event) => event.type === "mobile");
  const trusted = !loaded.missing.includes("รถตู้") && vans.length > 0;
  const today = thaiYmd(new Date());
  const remove = trusted
    ? loaded.extra.filter((row) => official(row) && row.date >= today).map((row) => row.id)
    : [];

  return { update, remove };
}

/**
 * รหัสรายการติดไปกับข้อมูลด้วย — **หน้าจอห้ามคำนวณเอง**
 * ไม่งั้นวันหลังแก้กฎตัดคำ (normalize) ที่ไฟล์เดียว อีกฝั่งจะจับคู่ไม่ตรงแบบเงียบ ๆ
 */
export type PreviewEvent = ComparedEvent & { key: string };

type Loaded =
  | {
      ok: true;
      items: PreviewEvent[];
      extra: CurrentEvent[];
      missing: string[];
      /** รายการจากต้นทางตั้งแต่ต้นเดือนนี้ — ไว้ให้ followVanPlan นับว่าได้รถตู้มากี่รอบ */
      fresh: SourceEvent[];
    }
  | { ok: false; error: string; status: number };

async function load(): Promise<Loaded> {
  const source = await fetchOfficerEvents();
  if (!source.ok) return { ok: false, error: source.error, status: 502 };

  const from = monthStart();
  const fresh: SourceEvent[] = source.events.filter((event) => event.date >= from);
  const current = await currentEvents();

  /*
   * "มีในเว็บ แต่ต้นทางไม่มี" — ไว้ให้เจ้าหน้าที่เลือกลบ
   *
   * ⚠️ ไม่ได้แปลว่าผิดเสมอไป · กิจกรรมที่เจ้าหน้าที่พิมพ์เองในเว็บ (ที่ระบบสำนักงาน
   * ไม่มี) ก็มาโผล่ตรงนี้ด้วย จึงต้องติ๊กเองทีละรายการ ไม่มีปุ่มลบทั้งหมดรวดเดียว
   * ตัวดึงอัตโนมัติแตะส่วนนี้เฉพาะรอบรถตู้ที่ `source = officer` (ดู followVanPlan)
   */
  const keys = new Set(fresh.map(eventKey));
  const extra = current.filter((row) => row.date >= from && !keys.has(eventKey(row)));

  const items = compareEvents(fresh, current).map((item) => ({ ...item, key: eventKey(item) }));
  return { ok: true, items, extra, missing: source.missing, fresh };
}

/** เทียบต้นทางกับของในเว็บ โดยยังไม่แตะอะไร — ใช้ตอนกด "ดูรายการ" */
export async function previewEventSync(): Promise<Loaded> {
  return load();
}

/**
 * ดึงเข้าจริงตามที่เลือกมา
 *
 * เลือกอะไรก็ทำแค่นั้น — ไม่มีอะไรเกิดขึ้นนอกเหนือจากที่ติ๊กไว้บนจอ
 */
export async function applyEventSync(selection: SyncSelection = {}): Promise<EventSyncResult> {
  const loaded = await load();
  if (!loaded.ok) return loaded;

  const addKeys = new Set(selection.addKeys ?? []);
  const updateIds = new Set(selection.updateIds ?? []);
  const removeIds = new Set(selection.removeIds ?? []);

  const toAdd = loaded.items.filter(
    (item) => item.status === "new" && (selection.addAll === true || addKeys.has(eventKey(item))),
  );
  const follow = selection.followVan ? followVanPlan(loaded, loaded.fresh) : null;
  for (const item of follow?.update ?? []) if (item.current) updateIds.add(item.current.id);
  for (const id of follow?.remove ?? []) removeIds.add(id);

  const toChange = loaded.items.filter(
    (item) => item.status === "changed" && item.current && updateIds.has(item.current.id),
  );
  /* ลบได้เฉพาะแถวที่โชว์อยู่บนจอรอบนั้นจริง ๆ — กันคนส่ง id มั่วมาลบของที่ไม่เกี่ยวกัน */
  const shown = new Set([
    ...loaded.extra.map((row) => row.id),
    ...loaded.items.flatMap((item) => (item.current ? [item.current.id] : [])),
  ]);
  const toRemove = [...removeIds].filter((id) => shown.has(id));

  // เหมือนเดิมทุกอย่าง = จบตรงนี้ ไม่เขียนฐาน ไม่ล้างสำเนาบนโฮสต์
  if (toAdd.length === 0 && toChange.length === 0 && toRemove.length === 0) {
    return { ok: true, added: 0, changed: 0, removed: 0 };
  }

  for (const item of toAdd) {
    const date = thaiMidnight(item.date);
    if (!date) continue;
    await db.calendarEvent.create({
      data: {
        // ปฏิทินหน้าแรกวางลงช่องวันด้วยเลขวันที่ ส่วน date คุมว่าขึ้นเดือนไหน
        day: Number(item.date.slice(8, 10)),
        date,
        type: item.type,
        title: item.title,
        place: item.place || null,
        time: item.time || null,
        // ทั้งปุ่มในหลังบ้านและตัวดึงอัตโนมัติ — รอบรถตู้ที่เข้ามาทางนี้จะตามต้นทางต่อไปเอง
        source: OFFICER_SOURCE,
      },
    });
  }

  for (const item of toChange) {
    if (!item.current) continue;
    // อัปเดตด้วย id ของแถวที่จับคู่ได้ ไม่ใช่ค้นด้วยข้อความอีกรอบ — ข้อความคนละแบบ
    // (รพ. กับ โรงพยาบาล) จะหาไม่เจอแล้วเงียบไปเฉย ๆ · ไม่แตะสถานะเผยแพร่ที่ตั้งไว้เอง
    await db.calendarEvent.update({
      where: { id: item.current.id },
      data: { title: item.title, place: item.place || null, time: item.time || null },
    });
  }

  if (toRemove.length > 0) {
    await db.calendarEvent.deleteMany({ where: { id: { in: toRemove } } });
  }

  // สมาชิกจะได้เห็นของใหม่ทันที ไม่ต้องรอสำเนาบนโฮสต์หมดอายุ
  purgeEverySite();
  return { ok: true, added: toAdd.length, changed: toChange.length, removed: toRemove.length };
}
