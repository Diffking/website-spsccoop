import { NextResponse } from "next/server";
import { requireUser, requireWrite } from "@/lib/apiAuth";
import { canArea } from "@/lib/permissions";
import { db } from "@/lib/db";
import { compareHolidays, fetchHolidaySource, holidaySourceLabel } from "@/lib/holidaySource";
import { purgeEverySite } from "@/lib/mirrorPurge";
import { parseThaiDate } from "../route";

/**
 * ดึงวันหยุดจากระบบสำนักงานในวงแลน (ดู src/lib/holidaySource.ts)
 *
 * GET  = ขอดูก่อนว่าจะเพิ่มอะไรบ้าง ชนกับอะไรบ้าง — ยังไม่แตะฐาน
 * POST = เอาเข้าจริง
 *
 * แยกสองขั้นตั้งใจ: ต้นทางเป็นระบบของคนอื่น เราไม่ได้คุมว่าวันไหนจะโผล่มา
 * ให้เจ้าหน้าที่เห็นก่อนว่าจะเปลี่ยนอะไร แล้วค่อยกดยืนยัน ดีกว่าเปลี่ยนเงียบ ๆ
 */

/** วันที่ของวันหยุดในฐาน เป็น "YYYY-MM-DD" ตามเวลาไทย (ที่เก็บเป็นเที่ยงคืนไทย = 17:00Z วันก่อน) */
const thaiYmd = (date: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(date);

async function currentHolidays() {
  const rows = await db.holiday.findMany({ select: { date: true, title: true } });
  return rows.map((row) => ({ date: thaiYmd(row.date), title: row.title }));
}

export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  if (!canArea(auth.user, "holidays")) {
    return NextResponse.json({ error: "ส่วนนี้ไม่ได้อยู่ในความรับผิดชอบของคุณ" }, { status: 403 });
  }

  const source = await fetchHolidaySource();
  if (!source.ok) {
    return NextResponse.json({ error: source.error }, { status: 502 });
  }

  return NextResponse.json({
    from: holidaySourceLabel(),
    enabled: source.enabled,
    items: compareHolidays(source.holidays, await currentHolidays()),
  });
}

export async function POST(request: Request) {
  const auth = await requireWrite("holidays");
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json().catch(() => ({}))) as { updateNames?: boolean };

  const source = await fetchHolidaySource();
  if (!source.ok) {
    return NextResponse.json({ error: source.error }, { status: 502 });
  }
  /*
   * ต้นทางปิดระบบวันหยุดอยู่ = รายการที่ได้มาอาจเป็นของค้างหรือว่างเปล่า
   * เอาเข้ามาทับตอนนี้เสี่ยงได้ของผิด — ให้ไปเปิดที่ต้นทางก่อน
   */
  if (!source.enabled) {
    return NextResponse.json(
      { error: "ระบบต้นทางปิดการใช้งานวันหยุดอยู่ — เปิดที่ระบบสำนักงานก่อนแล้วค่อยดึงอีกครั้ง" },
      { status: 409 },
    );
  }

  const compared = compareHolidays(source.holidays, await currentHolidays());

  const toAdd = compared.filter((item) => item.status === "new");
  const toRename = body.updateNames === true
    ? compared.filter((item) => item.status === "renamed")
    : [];

  if (toAdd.length === 0 && toRename.length === 0) {
    return NextResponse.json({ added: 0, renamed: 0, message: "ตรงกับระบบสำนักงานอยู่แล้ว" });
  }

  for (const item of toAdd) {
    const date = parseThaiDate(item.date);
    if (!date) continue;
    // วันหยุดราชการเป็นข้อมูลจริงที่สมาชิกต้องรู้ เผยแพร่เลย (ซ่อนทีหลังได้ถ้าไม่ต้องการ)
    await db.holiday.create({ data: { date, title: item.title } });
  }

  for (const item of toRename) {
    const date = parseThaiDate(item.date);
    if (!date) continue;
    // แก้เฉพาะชื่อ ไม่แตะหมายเหตุกับสถานะเผยแพร่ที่เจ้าหน้าที่ตั้งไว้เอง
    await db.holiday.updateMany({ where: { date }, data: { title: item.title } });
  }

  // สมาชิกจะได้เห็นของใหม่ทันที ไม่ต้องรอสำเนาบนโฮสต์หมดอายุ
  purgeEverySite();
  return NextResponse.json({ added: toAdd.length, renamed: toRename.length });
}
