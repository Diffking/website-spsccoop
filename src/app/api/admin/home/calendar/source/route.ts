import { NextResponse } from "next/server";
import { requireUser, requireWrite } from "@/lib/apiAuth";
import { canArea } from "@/lib/permissions";
import { officerSourceLabel } from "@/lib/officerEvents";
import { applyEventSync, previewEventSync } from "@/lib/officerEventSync";

/**
 * ปุ่มดึงกิจกรรมจากระบบสำนักงานในหลังบ้าน (ดู src/lib/officerEventSync.ts)
 *
 * GET  = ขอดูก่อนว่าจะเพิ่มอะไรบ้าง เวลาไม่ตรงกันตรงไหน — ยังไม่แตะฐาน
 * POST = เอาเข้าจริง
 *
 * แยกสองขั้นตั้งใจ หลักเดียวกับวันหยุด: ต้นทางเป็นระบบของคนอื่น เราไม่ได้คุมว่า
 * รายการไหนจะโผล่มา ให้เจ้าหน้าที่เห็นก่อนแล้วค่อยกดยืนยัน ดีกว่าเปลี่ยนเงียบ ๆ
 *
 * ตัวดึงอัตโนมัติอยู่คนละเส้นทาง (`/api/calendar/sync`) เพราะ /api/admin
 * เปิดได้เฉพาะโดเมนหลังบ้าน (src/proxy.ts) ซึ่งตัวตั้งเวลาในเน็ตเวิร์ก Docker ไม่ผ่าน
 */

export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  if (!canArea(auth.user, "home.calendar")) {
    return NextResponse.json({ error: "ส่วนนี้ไม่ได้อยู่ในความรับผิดชอบของคุณ" }, { status: 403 });
  }

  const result = await previewEventSync();
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  return NextResponse.json({
    from: officerSourceLabel(),
    items: result.items,
    missing: result.missing,
  });
}

export async function POST(request: Request) {
  const auth = await requireWrite("home.calendar");
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json().catch(() => ({}))) as { updateDetails?: boolean };
  const result = await applyEventSync(body.updateDetails === true);

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  return NextResponse.json({
    added: result.added,
    changed: result.changed,
    message: result.added || result.changed ? undefined : "ตรงกับระบบสำนักงานอยู่แล้ว",
  });
}
