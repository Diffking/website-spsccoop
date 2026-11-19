import { NextResponse } from "next/server";
import { requireWrite } from "@/lib/apiAuth";
import { VISITOR_HISTORY_YEARS, VISITOR_MANUAL_KEY } from "@/lib/analytics";
import { fiscalYearOf } from "@/lib/galleryShared";
import { getSetting, saveSetting } from "@/lib/settings";

/**
 * ยอดเข้าชมรายปีบัญชีที่ไอทีพิมพ์เอง — ADMIN เท่านั้น (เจ้าของเว็บสั่ง 19 พ.ย. 2569)
 * body = { year: 2566, value: 123456 | null } · null = ลบ กลับไปใช้ยอดที่ระบบนับ
 * รับเฉพาะ 5 ปีบัญชีย้อนหลัง — ปีปัจจุบันใช้ยอดที่ระบบนับสดเสมอ (ตรงกับตัวนับท้ายเว็บ)
 */
export async function PUT(request: Request) {
  const auth = await requireWrite();
  if (auth instanceof NextResponse) return auth;
  if (auth.user.role !== "ADMIN") return NextResponse.json({ error: "เฉพาะผู้ดูแลระบบ" }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as { year?: unknown; value?: unknown };
  const year = Number(body.year);
  const current = fiscalYearOf(new Date());
  if (!Number.isInteger(year) || year >= current || year < current - VISITOR_HISTORY_YEARS) {
    return NextResponse.json({ error: "ปีบัญชีไม่อยู่ในช่วงที่แก้ได้" }, { status: 400 });
  }

  let value: number | null = null;
  if (body.value !== null && body.value !== undefined && body.value !== "") {
    value = Number(String(body.value).replace(/[^\d]/g, ""));
    if (!Number.isSafeInteger(value) || value < 0 || String(body.value).replace(/[^\d]/g, "") === "") {
      return NextResponse.json({ error: "ใส่ได้เฉพาะตัวเลขจำนวนเต็ม" }, { status: 400 });
    }
  }

  const manual = { ...(await getSetting<Record<string, number>>(VISITOR_MANUAL_KEY, {})) };
  if (value === null) delete manual[String(year)];
  else manual[String(year)] = value;
  await saveSetting(VISITOR_MANUAL_KEY, manual);
  return NextResponse.json({ ok: true, year, value });
}
