import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireWrite } from "@/lib/apiAuth";
import { purgeEverySite } from "@/lib/mirrorPurge";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireWrite("home.ticker");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    text?: string;
    published?: boolean;
    sortOrder?: number;
  };

  const data: { text?: string; published?: boolean; sortOrder?: number } = {};
  if (typeof body.text === "string") {
    const text = body.text.trim();
    if (!text) return NextResponse.json({ error: "ข้อความห้ามว่าง" }, { status: 400 });
    data.text = text;
  }
  if (typeof body.published === "boolean") data.published = body.published;
  if (typeof body.sortOrder === "number") data.sortOrder = body.sortOrder;

  const item = await db.newsTicker.update({ where: { id }, data });
  // สมาชิกจะได้เห็นของใหม่ทันที ไม่ต้องรอสำเนาบนโฮสต์หมดอายุ
  purgeEverySite();
  return NextResponse.json({ item });
}

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireWrite("home.ticker");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  await db.newsTicker.deleteMany({ where: { id } });
  // สมาชิกจะได้เห็นของใหม่ทันที ไม่ต้องรอสำเนาบนโฮสต์หมดอายุ
  purgeEverySite();
  return NextResponse.json({ ok: true });
}
