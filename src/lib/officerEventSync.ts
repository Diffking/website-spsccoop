import { db } from "@/lib/db";
import {
  compareEvents,
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
 * **ไม่มีอะไรเปลี่ยน = ไม่แตะฐาน ไม่ล้างสำเนาบนโฮสต์** ตัวดึงอัตโนมัติจึงวิ่งฟรีได้ทั้งวัน
 * · **ไม่เคยลบอะไร** กิจกรรมที่เจ้าหน้าที่พิมพ์เองในเว็บจึงไม่หายไปกับการดึงข้อมูล
 */

export type EventSyncResult =
  | { ok: true; added: number; changed: number; items: ComparedEvent[] }
  | { ok: false; error: string; status: number };

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
    select: { id: true, date: true, type: true, title: true, place: true, time: true },
  });

  return rows.map((row) => ({
    id: row.id,
    date: row.date ? thaiYmd(row.date) : "",
    type: row.type,
    title: row.title,
    place: row.place ?? "",
    time: row.time ?? "",
  }));
}

type Loaded =
  | { ok: true; items: ComparedEvent[]; missing: string[] }
  | { ok: false; error: string; status: number };

async function load(): Promise<Loaded> {
  const source = await fetchOfficerEvents();
  if (!source.ok) return { ok: false, error: source.error, status: 502 };

  const from = monthStart();
  const fresh: SourceEvent[] = source.events.filter((event) => event.date >= from);

  return { ok: true, items: compareEvents(fresh, await currentEvents()), missing: source.missing };
}

/** เทียบต้นทางกับของในเว็บ โดยยังไม่แตะอะไร — ใช้ตอนกด "ดูรายการ" */
export async function previewEventSync(): Promise<Loaded> {
  return load();
}

/**
 * ดึงเข้าจริง
 *
 * `updateDetails` = ยอมให้ชื่อเรื่อง/สถานที่/เวลาจากต้นทางทับของที่แก้ไว้ในเว็บด้วยไหม
 * (ปุ่มในหลังบ้านให้ติ๊กเอง · ตัวดึงอัตโนมัติไม่ทับเด็ดขาด เพราะไม่มีใครนั่งดูว่ามันทับอะไรไป)
 */
export async function applyEventSync(updateDetails = false): Promise<EventSyncResult> {
  const loaded = await load();
  if (!loaded.ok) return loaded;

  const toAdd = loaded.items.filter((item) => item.status === "new");
  const toChange = updateDetails ? loaded.items.filter((item) => item.status === "changed") : [];

  // เหมือนเดิมทุกอย่าง = จบตรงนี้ ไม่เขียนฐาน ไม่ล้างสำเนาบนโฮสต์
  if (toAdd.length === 0 && toChange.length === 0) {
    return { ok: true, added: 0, changed: 0, items: [] };
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

  // สมาชิกจะได้เห็นของใหม่ทันที ไม่ต้องรอสำเนาบนโฮสต์หมดอายุ
  purgeEverySite();
  return {
    ok: true,
    added: toAdd.length,
    changed: toChange.length,
    items: [...toAdd, ...toChange],
  };
}
