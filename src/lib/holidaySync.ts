import { db } from "@/lib/db";
import { compareHolidays, fetchHolidaySource, type ComparedHoliday } from "@/lib/holidaySource";
import { purgeEverySite } from "@/lib/mirrorPurge";

/**
 * เอาวันหยุดจากระบบสำนักงานเข้าฐานของเว็บ
 *
 * ใช้ร่วมกันสองทาง: ปุ่มในหลังบ้าน (`/api/admin/holidays/source`) กับตัวดึงอัตโนมัติ
 * (`/api/holidays/sync` ที่ service `holiday-sync` เรียกทุก 6 ชม.) — ต้องเป็นตัวเดียวกัน
 * ไม่งั้นวันดีคืนดีสองทางจะทำงานไม่เหมือนกันแล้วหาสาเหตุไม่เจอ
 *
 * **ไม่มีอะไรเปลี่ยน = ไม่แตะฐาน ไม่ล้างแคช** ตัวดึงอัตโนมัติจึงวิ่งฟรีได้ทั้งวัน
 * โดยไม่สร้างงานให้ใครเลย
 */

export type SyncResult =
  | { ok: true; added: number; renamed: number; changed: ComparedHoliday[] }
  | { ok: false; error: string; status: number };

/** วันที่ของวันหยุดในฐาน เป็น "YYYY-MM-DD" ตามเวลาไทย (เก็บเป็นเที่ยงคืนไทย = 17:00Z วันก่อน) */
const thaiYmd = (date: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(date);

/** วันที่ล้วน (YYYY-MM-DD) → เที่ยงคืนเวลาไทย — ต้องตรงกับ parseThaiDate ของ API วันหยุด */
function thaiMidnight(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00+07:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function currentHolidays() {
  const rows = await db.holiday.findMany({ select: { date: true, title: true } });
  return rows.map((row) => ({ date: thaiYmd(row.date), title: row.title }));
}

/** เทียบต้นทางกับของในเว็บ โดยยังไม่แตะอะไร — ใช้ตอนกด "ดูรายการ" */
export async function previewHolidaySync() {
  const source = await fetchHolidaySource();
  if (!source.ok) return { ok: false as const, error: source.error, status: 502 };

  return {
    ok: true as const,
    enabled: source.enabled,
    items: compareHolidays(source.holidays, await currentHolidays()),
  };
}

/**
 * ดึงเข้าจริง
 *
 * `updateNames` = ยอมให้ชื่อจากต้นทางทับชื่อที่แก้ไว้ในเว็บด้วยไหม (ปุ่มในหลังบ้าน
 * ให้ติ๊กเอง · ตัวดึงอัตโนมัติไม่ทับเด็ดขาด เพราะไม่มีใครนั่งดูว่ามันทับอะไรไป)
 */
export async function applyHolidaySync(updateNames = false): Promise<SyncResult> {
  const source = await fetchHolidaySource();
  if (!source.ok) return { ok: false, error: source.error, status: 502 };

  /*
   * ต้นทางปิดระบบวันหยุดอยู่ = รายการที่ได้มาอาจเป็นของค้างหรือว่างเปล่า
   * เอาเข้ามาตอนนี้เสี่ยงได้ของผิด — ให้ไปเปิดที่ต้นทางก่อน
   */
  if (!source.enabled) {
    return {
      ok: false,
      error: "ระบบต้นทางปิดการใช้งานวันหยุดอยู่ — เปิดที่ระบบสำนักงานก่อนแล้วค่อยดึงอีกครั้ง",
      status: 409,
    };
  }

  const compared = compareHolidays(source.holidays, await currentHolidays());
  const toAdd = compared.filter((item) => item.status === "new");
  const toRename = updateNames ? compared.filter((item) => item.status === "renamed") : [];

  // เหมือนเดิมทุกอย่าง = จบตรงนี้ ไม่เขียนฐาน ไม่ล้างสำเนาบนโฮสต์
  if (toAdd.length === 0 && toRename.length === 0) {
    return { ok: true, added: 0, renamed: 0, changed: [] };
  }

  for (const item of toAdd) {
    const date = thaiMidnight(item.date);
    if (!date) continue;
    // วันหยุดราชการเป็นข้อมูลจริงที่สมาชิกต้องรู้ เผยแพร่เลย (ซ่อนทีหลังได้ถ้าไม่ต้องการ)
    await db.holiday.create({ data: { date, title: item.title } });
  }

  for (const item of toRename) {
    const date = thaiMidnight(item.date);
    if (!date) continue;
    // แก้เฉพาะชื่อ ไม่แตะหมายเหตุกับสถานะเผยแพร่ที่เจ้าหน้าที่ตั้งไว้เอง
    await db.holiday.updateMany({ where: { date }, data: { title: item.title } });
  }

  // สมาชิกจะได้เห็นของใหม่ทันที ไม่ต้องรอสำเนาบนโฮสต์หมดอายุ
  purgeEverySite();
  return { ok: true, added: toAdd.length, renamed: toRename.length, changed: [...toAdd, ...toRename] };
}
