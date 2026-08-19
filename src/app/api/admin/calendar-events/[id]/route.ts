import { NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { db } from "@/lib/db";
import { isEventType } from "@/lib/homeItems";
import { parseThaiDate } from "@/app/api/admin/holidays/route";
import { purgeEverySite } from "@/lib/mirrorPurge";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const existing = await db.calendarEvent.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "ไม่พบกิจกรรมนี้" }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const data: Record<string, unknown> = {};

  if (body.date !== undefined) {
    const date = parseThaiDate(String(body.date ?? ""));
    if (!date) return NextResponse.json({ error: "วันที่ไม่ถูกต้อง" }, { status: 400 });
    data.date = date;
    // เลขวันต้องตามวันที่เต็มเสมอ ไม่งั้นปฏิทินหน้าแรกจะวางผิดช่อง
    data.day = Number(
      new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", day: "numeric" }).format(date),
    );
  }
  if (body.title !== undefined) {
    const title = String(body.title).trim();
    if (!title) return NextResponse.json({ error: "ชื่อกิจกรรมห้ามว่าง" }, { status: 400 });
    data.title = title;
  }
  if (body.type !== undefined) data.type = isEventType(body.type) ? body.type : "project";
  if (body.place !== undefined) data.place = String(body.place ?? "").trim() || null;
  if (body.time !== undefined) data.time = String(body.time ?? "").trim() || null;
  if (body.published !== undefined) data.published = Boolean(body.published);

  const item = await db.calendarEvent.update({ where: { id }, data });
  // สมาชิกจะได้เห็นของใหม่ทันที ไม่ต้องรอสำเนาบนโฮสต์หมดอายุ
  purgeEverySite();
  return NextResponse.json({ item });
}

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  await db.calendarEvent.deleteMany({ where: { id } });
  // สมาชิกจะได้เห็นของใหม่ทันที ไม่ต้องรอสำเนาบนโฮสต์หมดอายุ
  purgeEverySite();
  return NextResponse.json({ ok: true });
}
