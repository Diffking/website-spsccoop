import { db } from "@/lib/db";

/**
 * หมุดสำหรับวาง "ตารางเวลาออกหน่วยรถตู้" ลงในหน้าเนื้อหา (หน้า /offices/mobile-van/)
 *
 * ปัญหาที่แก้: ตารางเดิมพิมพ์ค้างไว้ในเนื้อหาหน้า ("— รอเติมข้อมูล —") ไม่มีใครมาแก้ทุกสัปดาห์
 * ทั้งที่รอบรถตู้ถูกดึงจากระบบสำนักงานเข้า `CalendarEvent` ทุก 6 ชม. อยู่แล้ว
 * (ดู src/lib/officerEventSync.ts) · หมุดนี้เอาข้อมูลชุดนั้นมาวางเป็นตาราง
 *
 * วิธีใช้: ในเนื้อหาหน้าใส่ `<div class="live-van-schedule"></div>` ตรงที่อยากให้ตารางขึ้น
 * แล้วตอน render หมุดถูกแทนที่ด้วยตาราง HTML ตั้งแต่ฝั่งเซิร์ฟเวอร์ — ได้หน้าตา `.prose-page`
 * เหมือนตารางอื่นในหน้า และ Google อ่านรายการได้
 *
 * ต่างจาก liveRates.ts ที่ผ่าหน้าแล้ววางคอมโพเนนต์ เพราะตารางนี้ไม่มีอะไรให้กด ไม่ต้องมี state
 *
 * ⚠️ ชื่อคลาสต้องอยู่ใน `ALLOWED_CLASSES` (pageHtml.ts) ไม่งั้นหมุดโดนตัวกรองกินตอนกดบันทึก
 *
 * ⚠️ **แถวที่เลยวันไปแล้วถูกซ่อนบนเครื่องผู้อ่านอีกชั้น** (`data-van-date` → PageContent.tsx)
 * เพราะ www.spsccoop.com เสิร์ฟสำเนาที่เก็บไว้ตอนเครื่องนี้ปิด (กลางคืน · เสาร์อาทิตย์)
 * ตารางในสำเนาจะยังมีรอบของวันที่ผ่านไปแล้ว
 */
export const LIVE_VAN_SCHEDULE = "live-van-schedule";

/** แสดงล่วงหน้ากี่วัน — ปฏิทินของต้นทางลงไว้ราวหนึ่งเดือน เผื่อไว้สองเดือน */
const DAYS_AHEAD = 60;

export type VanRow = { ymd: string; place: string; time: string | null };

const BKK = "Asia/Bangkok";

function bangkokYmd(d: Date): string {
  // en-CA ให้รูปแบบ YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone: BKK }).format(d);
}

/** "อ. 16 ก.ย. 2569" */
const thaiShort = new Intl.DateTimeFormat("th-TH", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: BKK,
});

/** รอบรถตู้ตั้งแต่วันนี้ (เวลาไทย) ไปอีก DAYS_AHEAD วัน — อ่านฐานไม่ได้คืนรายการว่าง ไม่ล้มทั้งหน้า */
export async function getVanSchedule(now = new Date()): Promise<VanRow[]> {
  // วันที่ในฐานเก็บเป็น "เที่ยงคืนเวลาไทย" (17:00Z ของวันก่อนหน้า)
  const from = new Date(`${bangkokYmd(now)}T00:00:00+07:00`);
  const to = new Date(from.getTime() + DAYS_AHEAD * 86_400_000);

  try {
    const rows = await db.calendarEvent.findMany({
      where: { type: "mobile", published: true, date: { gte: from, lt: to } },
      orderBy: [{ date: "asc" }, { place: "asc" }],
      select: { date: true, place: true, title: true, time: true },
    });
    return rows.map((r) => ({
      ymd: bangkokYmd(r.date!),
      place: r.place?.trim() || r.title,
      time: r.time?.trim() || null,
    }));
  } catch (error) {
    console.error("อ่านตารางรถตู้ไม่ได้:", error);
    return [];
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const EMPTY_TEXT = "ยังไม่มีกำหนดการออกหน่วย — ติดตามประกาศได้ที่หน้าแรก";

/**
 * ตาราง HTML ของรอบรถตู้
 *
 * แถว `data-van-empty` มีเสมอ — ไม่มีรอบเลยก็โชว์ตั้งแต่แรก · มีรอบก็ซ่อนไว้
 * แล้วเครื่องผู้อ่านเปิดขึ้นมาเองเมื่อแถวทั้งหมดเลยวันไปแล้ว (สำเนาเก่าบนโฮสต์)
 */
export function vanScheduleHtml(rows: VanRow[]): string {
  const body = rows
    .map((r) => {
      const date = thaiShort.format(new Date(`${r.ymd}T12:00:00+07:00`));
      const time = r.time ? `${escapeHtml(r.time)} น.` : "—";
      return (
        `<tr data-van-date="${r.ymd}">` +
        `<td>${escapeHtml(date)}</td><td>${escapeHtml(r.place)}</td><td>${time}</td></tr>`
      );
    })
    .join("");
  const empty =
    `<tr data-van-empty${rows.length > 0 ? " hidden" : ""}>` +
    `<td colspan="3">${EMPTY_TEXT}</td></tr>`;

  return (
    `<table class="van-schedule"><thead><tr><th>วันที่</th><th>หน่วยงาน / จุดจอด</th><th>เวลา</th></tr></thead>` +
    `<tbody>${body}${empty}</tbody></table>`
  );
}

/** แทนหมุดทุกตัวในเนื้อหาด้วยตาราง — ไม่มีหมุดคืนเนื้อหาเดิม */
export function fillVanSchedule(html: string, rows: VanRow[]): string {
  const marker = /<div[^>]*class="[^"]*\blive-van-schedule\b[^"]*"[^>]*>\s*<\/div>/g;
  return html.replace(marker, () => vanScheduleHtml(rows));
}
