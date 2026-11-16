import { NextResponse } from "next/server";
import { requireWrite } from "@/lib/apiAuth";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string; itemId: string }> };

/** ลบคำทักท้วงหนึ่งรายการ (เช่น ส่งซ้ำ/คนอื่นใช้เลขของสมาชิก) — เจ้าของเลขส่งใหม่ได้หลังลบ */
export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireWrite("objections");
  if (auth instanceof NextResponse) return auth;

  const { id, itemId } = await params;
  await db.objection.deleteMany({ where: { id: itemId, roundId: id } });
  return NextResponse.json({ ok: true });
}
