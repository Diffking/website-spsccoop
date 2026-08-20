import { NextResponse } from "next/server";
import { requireUser, requireWrite } from "@/lib/apiAuth";
import { canArea } from "@/lib/permissions";
import { holidaySourceLabel } from "@/lib/holidaySource";
import { applyHolidaySync, previewHolidaySync } from "@/lib/holidaySync";

/**
 * ปุ่มดึงวันหยุดจากระบบสำนักงานในหลังบ้าน (ดู src/lib/holidaySync.ts)
 *
 * GET  = ขอดูก่อนว่าจะเพิ่มอะไรบ้าง ชนกับอะไรบ้าง — ยังไม่แตะฐาน
 * POST = เอาเข้าจริง
 *
 * แยกสองขั้นตั้งใจ: ต้นทางเป็นระบบของคนอื่น เราไม่ได้คุมว่าวันไหนจะโผล่มา
 * ให้เจ้าหน้าที่เห็นก่อนว่าจะเปลี่ยนอะไร แล้วค่อยกดยืนยัน ดีกว่าเปลี่ยนเงียบ ๆ
 *
 * ตัวดึงอัตโนมัติอยู่คนละเส้นทาง (`/api/holidays/sync`) เพราะ /api/admin
 * เปิดได้เฉพาะโดเมนหลังบ้าน (src/proxy.ts) ซึ่งตัวตั้งเวลาในเน็ตเวิร์ก Docker ไม่ผ่าน
 */

export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  if (!canArea(auth.user, "holidays")) {
    return NextResponse.json({ error: "ส่วนนี้ไม่ได้อยู่ในความรับผิดชอบของคุณ" }, { status: 403 });
  }

  const result = await previewHolidaySync();
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  return NextResponse.json({
    from: holidaySourceLabel(),
    enabled: result.enabled,
    items: result.items,
  });
}

export async function POST(request: Request) {
  const auth = await requireWrite("holidays");
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json().catch(() => ({}))) as { updateNames?: boolean };
  const result = await applyHolidaySync(body.updateNames === true);

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  return NextResponse.json({
    added: result.added,
    renamed: result.renamed,
    message: result.added || result.renamed ? undefined : "ตรงกับระบบสำนักงานอยู่แล้ว",
  });
}
