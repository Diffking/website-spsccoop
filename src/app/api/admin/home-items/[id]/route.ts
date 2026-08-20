import { NextResponse } from "next/server";
import { requireWrite } from "@/lib/apiAuth";
import { SECTION_AREA } from "@/lib/homeSectionAreas";
import { db } from "@/lib/db";
import { purgeEverySite } from "@/lib/mirrorPurge";

type Params = { params: Promise<{ id: string }> };

/** แก้รายการ — ส่งเฉพาะช่องที่เปลี่ยน · move = สลับลำดับกับตัวข้างเคียงในส่วนเดียวกัน */
export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const existing = await db.homeItem.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "ไม่พบรายการนี้" }, { status: 404 });

  // สิทธิ์ขึ้นกับว่ารายการนี้อยู่ส่วนไหนของหน้าแรก จึงต้องอ่านของเดิมมาก่อน
  const auth = await requireWrite(SECTION_AREA[existing.section]);
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  if (body.move === "up" || body.move === "down") {
    const neighbour = await db.homeItem.findFirst({
      where: {
        section: existing.section,
        sortOrder:
          body.move === "up" ? { lt: existing.sortOrder } : { gt: existing.sortOrder },
      },
      orderBy: { sortOrder: body.move === "up" ? "desc" : "asc" },
    });
    if (neighbour) {
      await db.$transaction([
        db.homeItem.update({ where: { id: existing.id }, data: { sortOrder: neighbour.sortOrder } }),
        db.homeItem.update({ where: { id: neighbour.id }, data: { sortOrder: existing.sortOrder } }),
      ]);
    }
    // สมาชิกจะได้เห็นของใหม่ทันที ไม่ต้องรอสำเนาบนโฮสต์หมดอายุ
    purgeEverySite();
    return NextResponse.json({ ok: true });
  }

  const text = (key: string) =>
    body[key] === undefined ? undefined : String(body[key] ?? "").trim() || null;

  const title = body.title === undefined ? undefined : String(body.title).trim();
  if (title !== undefined && !title) {
    return NextResponse.json({ error: "ชื่อรายการห้ามว่าง" }, { status: 400 });
  }

  const item = await db.homeItem.update({
    where: { id },
    data: {
      ...(title !== undefined ? { title } : {}),
      ...(body.subtitle !== undefined ? { subtitle: text("subtitle") } : {}),
      ...(body.icon !== undefined ? { icon: text("icon") } : {}),
      ...(body.href !== undefined ? { href: text("href") } : {}),
      ...(body.imageUrl !== undefined ? { imageUrl: text("imageUrl") } : {}),
      ...(body.theme !== undefined ? { theme: text("theme") } : {}),
      ...(body.category !== undefined ? { category: text("category") } : {}),
      ...(body.published !== undefined ? { published: Boolean(body.published) } : {}),
    },
  });

  // สมาชิกจะได้เห็นของใหม่ทันที ไม่ต้องรอสำเนาบนโฮสต์หมดอายุ
  purgeEverySite();
  return NextResponse.json({ item });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const existing = await db.homeItem.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ ok: true });

  const auth = await requireWrite(SECTION_AREA[existing.section]);
  if (auth instanceof NextResponse) return auth;

  await db.homeItem.deleteMany({ where: { id } });
  // สมาชิกจะได้เห็นของใหม่ทันที ไม่ต้องรอสำเนาบนโฮสต์หมดอายุ
  purgeEverySite();
  return NextResponse.json({ ok: true });
}
