import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireWrite } from "@/lib/apiAuth";
import { db } from "@/lib/db";
import { dayEnd, dayStart, readAgendas } from "@/lib/objection";

type Params = { params: Promise<{ id: string }> };

/** แก้รอบ — { title, opensAt, closesAt, agendas, published } ส่งเฉพาะช่องที่เปลี่ยนก็ได้ */
export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireWrite("objections");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const existing = await db.objectionRound.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "ไม่พบรอบนี้" }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const data: Prisma.ObjectionRoundUpdateInput = {};

  if (body.title !== undefined) {
    const title = String(body.title ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
    if (!title) return NextResponse.json({ error: "หัวเรื่องห้ามว่าง" }, { status: 400 });
    data.title = title;
  }
  if (body.opensAt !== undefined) {
    const d = dayStart(String(body.opensAt ?? ""));
    if (!d) return NextResponse.json({ error: "วันเริ่มรับไม่ถูกต้อง" }, { status: 400 });
    data.opensAt = d;
  }
  if (body.closesAt !== undefined) {
    const d = dayEnd(String(body.closesAt ?? ""));
    if (!d) return NextResponse.json({ error: "วันปิดรับไม่ถูกต้อง" }, { status: 400 });
    data.closesAt = d;
  }
  const opens = (data.opensAt as Date | undefined) ?? existing.opensAt;
  const closes = (data.closesAt as Date | undefined) ?? existing.closesAt;
  if (closes <= opens) return NextResponse.json({ error: "วันปิดรับต้องอยู่หลังวันเริ่มรับ" }, { status: 400 });

  if (body.agendas !== undefined) data.agendas = readAgendas(body.agendas) as Prisma.InputJsonValue;
  if (body.published !== undefined) data.published = Boolean(body.published);

  await db.objectionRound.update({ where: { id }, data });
  return NextResponse.json({ ok: true });
}

/** ลบรอบ — ได้เฉพาะรอบที่ยังไม่มีคำทักท้วง (กันลบข้อมูลสมาชิกทิ้งทั้งปีโดยไม่ตั้งใจ) */
export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireWrite("objections");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const count = await db.objection.count({ where: { roundId: id } });
  if (count > 0) {
    return NextResponse.json({ error: `รอบนี้มีคำทักท้วงแล้ว ${count} รายการ ลบรอบไม่ได้` }, { status: 409 });
  }
  await db.objectionRound.deleteMany({ where: { id } });
  return NextResponse.json({ ok: true });
}
