import { NextResponse } from "next/server";
import { requireWrite } from "@/lib/apiAuth";
import { verifyResponses } from "@/lib/surveyVerify";

type Params = { params: Promise<{ id: string }> };

/**
 * ปุ่ม "ตรวจกับฐานสมาชิกอีกครั้ง"
 *   { }               ตรวจเฉพาะที่รอตรวจ
 *   { recheck: true } ตรวจซ้ำทั้งชุด รวมคนที่ผ่านแล้ว (เผื่อพ้นสภาพสมาชิกระหว่างเปิดรับ)
 */
export async function POST(request: Request, { params }: Params) {
  const auth = await requireWrite("surveys");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { recheck?: boolean };
  const report = await verifyResponses({ surveyId: id, recheck: body.recheck === true });
  if (!report.ready) {
    return NextResponse.json({ error: "ยังไม่ได้เชื่อมฐานสมาชิก — ตรวจไม่ได้", report }, { status: 503 });
  }
  return NextResponse.json({ report });
}
