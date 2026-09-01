import { NextResponse } from "next/server";
import { BRIDGE_HEADERS, noteRead, requireBridge } from "@/lib/bridgeGuard";
import { BRIDGE_NAME, BRIDGE_VERSION, getCalendar, siteBase } from "@/lib/coopBridge";

/**
 * กิจกรรมที่ลงไว้ในปฏิทินสหกรณ์ — รวมสองต้นทางให้แล้ว
 *   1. เมนู "ปฏิทินสหกรณ์" ในหลังบ้าน (ตาราง CalendarEvent)
 *   2. แบนเนอร์สไลด์ที่ใส่ "วันจัดกิจกรรม" ไว้ — ปักลงปฏิทินให้เองอยู่แล้วบนหน้าเว็บ
 *
 * เลือกเดือนได้ด้วย `?month=2026-09` · เลือกช่วงด้วย `?from=2026-09-01&to=2026-12-31`
 * ไม่ใส่ = ได้ทั้งหมด (หน้าแรกของเว็บโชว์ทีละเดือน แต่ที่นี่ไม่กรองให้ ระบบปลายทางเลือกเอง)
 *
 * ⚠️ วันที่เป็น "YYYY-MM-DD ตามเวลาไทย" แปลงให้เรียบร้อยแล้ว — ในฐานเก็บเป็น
 * เที่ยงคืนเวลาไทยซึ่งเท่ากับ 17:00Z ของวันก่อนหน้า อ่านดิบ ๆ จะได้วันก่อนหน้าไปหนึ่งวัน
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireBridge(request);
  if (auth instanceof NextResponse) return auth;

  const url = new URL(request.url);
  const month = (url.searchParams.get("month") ?? "").trim();
  const from = (url.searchParams.get("from") ?? "").trim();
  const to = (url.searchParams.get("to") ?? "").trim();

  let events = await getCalendar();

  // รายการเก่าที่มีแต่เลขวัน (ไม่มีวันที่เต็ม) ไม่ถูกกรองทิ้ง — มันขึ้นทุกเดือนอยู่แล้ว
  if (month) events = events.filter((e) => !e.date || e.date.startsWith(month));
  if (from) events = events.filter((e) => !e.date || e.date >= from);
  if (to) events = events.filter((e) => !e.date || e.date <= to);

  await noteRead("calendar", auth.ip);

  return NextResponse.json(
    {
      service: BRIDGE_NAME,
      version: BRIDGE_VERSION,
      dataset: "calendar",
      site: siteBase(),
      generatedAt: new Date().toISOString(),
      count: events.length,
      events,
    },
    { headers: BRIDGE_HEADERS },
  );
}
