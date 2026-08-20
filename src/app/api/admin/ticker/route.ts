import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireWrite } from "@/lib/apiAuth";
import { purgeEverySite } from "@/lib/mirrorPurge";

export async function POST(request: Request) {
  const auth = await requireWrite("home.ticker");
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json().catch(() => ({}))) as { text?: string };
  const text = body.text?.trim() ?? "";
  if (!text) {
    return NextResponse.json({ error: "กรุณาใส่ข้อความ" }, { status: 400 });
  }

  const last = await db.newsTicker.findFirst({ orderBy: { sortOrder: "desc" } });
  const item = await db.newsTicker.create({
    data: { text, sortOrder: (last?.sortOrder ?? 0) + 1 },
  });
  // สมาชิกจะได้เห็นของใหม่ทันที ไม่ต้องรอสำเนาบนโฮสต์หมดอายุ
  purgeEverySite();
  return NextResponse.json({ item }, { status: 201 });
}
