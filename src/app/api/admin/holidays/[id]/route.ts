import { NextResponse } from "next/server";
import { requireWrite } from "@/lib/apiAuth";
import { db } from "@/lib/db";
import { parseThaiDate } from "../route";
import { purgeEverySite } from "@/lib/mirrorPurge";

type Params = { params: Promise<{ id: string }> };

/** แก้วันหยุด — ส่งมาเฉพาะช่องที่จะเปลี่ยนก็ได้ */
export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireWrite("holidays");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const existing = await db.holiday.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "ไม่พบวันหยุดนี้" }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    date?: string;
    title?: string;
    note?: string;
    published?: boolean;
  };

  const data: { date?: Date; title?: string; note?: string | null; published?: boolean } = {};

  if (body.date !== undefined) {
    const date = parseThaiDate(body.date);
    if (!date) return NextResponse.json({ error: "วันที่ไม่ถูกต้อง" }, { status: 400 });
    data.date = date;
  }
  if (body.title !== undefined) {
    const title = body.title.trim();
    if (!title) return NextResponse.json({ error: "ชื่อวันหยุดห้ามว่าง" }, { status: 400 });
    data.title = title;
  }
  if (body.note !== undefined) data.note = body.note.trim() || null;
  if (body.published !== undefined) data.published = body.published;

  const item = await db.holiday.update({ where: { id }, data });
  // สมาชิกจะได้เห็นของใหม่ทันที ไม่ต้องรอสำเนาบนโฮสต์หมดอายุ
  purgeEverySite();
  return NextResponse.json({ item });
}

/** ลบวันหยุด */
export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireWrite("holidays");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  await db.holiday.deleteMany({ where: { id } });
  // สมาชิกจะได้เห็นของใหม่ทันที ไม่ต้องรอสำเนาบนโฮสต์หมดอายุ
  purgeEverySite();
  return NextResponse.json({ ok: true });
}
