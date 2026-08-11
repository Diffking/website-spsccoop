import { NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const existing = await db.calendarEvent.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "ไม่พบกิจกรรมนี้" }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const data: Record<string, unknown> = {};

  if (body.day !== undefined) {
    const day = Number(body.day);
    if (!Number.isInteger(day) || day < 1 || day > 31) {
      return NextResponse.json({ error: "วันที่ต้องเป็นตัวเลข 1-31" }, { status: 400 });
    }
    data.day = day;
  }
  if (body.title !== undefined) {
    const title = String(body.title).trim();
    if (!title) return NextResponse.json({ error: "ชื่อกิจกรรมห้ามว่าง" }, { status: 400 });
    data.title = title;
  }
  if (body.type !== undefined) data.type = body.type === "mobile" ? "mobile" : "project";
  if (body.place !== undefined) data.place = String(body.place ?? "").trim() || null;
  if (body.time !== undefined) data.time = String(body.time ?? "").trim() || null;
  if (body.published !== undefined) data.published = Boolean(body.published);

  const item = await db.calendarEvent.update({ where: { id }, data });
  return NextResponse.json({ item });
}

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  await db.calendarEvent.deleteMany({ where: { id } });
  return NextResponse.json({ ok: true });
}
