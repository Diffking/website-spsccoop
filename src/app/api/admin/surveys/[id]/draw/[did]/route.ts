import { NextResponse } from "next/server";
import { requireWrite } from "@/lib/apiAuth";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string; did: string }> };

/**
 * สละสิทธิ์ / ติดต่อไม่ได้ — { reason } · แถวไม่ถูกลบ แค่ขีดฆ่า แล้วจับแทนได้หนึ่งที่
 * คนที่สละสิทธิ์ไม่กลับเข้ากองผู้มีสิทธิ์ (หนึ่งคนถูกจับได้ครั้งเดียว)
 */
export async function POST(request: Request, { params }: Params) {
  const auth = await requireWrite("surveys");
  if (auth instanceof NextResponse) return auth;

  const { id, did } = await params;
  const body = (await request.json().catch(() => ({}))) as { reason?: unknown };
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 300) : "";
  if (!reason) return NextResponse.json({ error: "ใส่เหตุผล เช่น สละสิทธิ์ · ติดต่อไม่ได้" }, { status: 400 });

  const draw = await db.surveyDraw.findFirst({ where: { id: did, surveyId: id } });
  if (!draw) return NextResponse.json({ error: "ไม่พบรายการนี้" }, { status: 404 });
  if (draw.voided) return NextResponse.json({ error: "รายการนี้สละสิทธิ์ไปแล้ว" }, { status: 409 });

  await db.surveyDraw.update({
    where: { id: did },
    data: { voided: true, voidReason: reason, voidedAt: new Date(), voidedByName: auth.user.name },
  });
  return NextResponse.json({ ok: true });
}
