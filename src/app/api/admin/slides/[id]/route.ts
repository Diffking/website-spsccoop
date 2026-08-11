import { NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

/** แก้สไลด์ — ส่งมาเฉพาะช่องที่เปลี่ยนก็ได้ · move = สลับลำดับกับตัวข้างเคียง */
export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const existing = await db.slide.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "ไม่พบสไลด์นี้" }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as {
    title?: string;
    caption?: string;
    href?: string;
    imageUrl?: string;
    published?: boolean;
    move?: "up" | "down";
  };

  if (body.move) {
    // หาตัวที่อยู่ติดกันในทิศที่จะย้าย แล้วสลับ sortOrder กัน
    const neighbour = await db.slide.findFirst({
      where:
        body.move === "up"
          ? { sortOrder: { lt: existing.sortOrder } }
          : { sortOrder: { gt: existing.sortOrder } },
      orderBy: { sortOrder: body.move === "up" ? "desc" : "asc" },
    });
    if (neighbour) {
      await db.$transaction([
        db.slide.update({ where: { id: existing.id }, data: { sortOrder: neighbour.sortOrder } }),
        db.slide.update({ where: { id: neighbour.id }, data: { sortOrder: existing.sortOrder } }),
      ]);
    }
    return NextResponse.json({ ok: true });
  }

  const data: {
    title?: string;
    caption?: string | null;
    href?: string | null;
    imageUrl?: string;
    published?: boolean;
  } = {};

  if (body.title !== undefined) {
    const title = body.title.trim();
    if (!title) return NextResponse.json({ error: "หัวข้อห้ามว่าง" }, { status: 400 });
    data.title = title;
  }
  if (body.imageUrl !== undefined) {
    const imageUrl = body.imageUrl.trim();
    if (!imageUrl) return NextResponse.json({ error: "รูปห้ามว่าง" }, { status: 400 });
    data.imageUrl = imageUrl;
  }
  if (body.caption !== undefined) data.caption = body.caption.trim() || null;
  if (body.href !== undefined) data.href = body.href.trim() || null;
  if (body.published !== undefined) data.published = body.published;

  const item = await db.slide.update({ where: { id }, data });
  return NextResponse.json({ item });
}

/** ลบสไลด์ */
export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  await db.slide.deleteMany({ where: { id } });
  return NextResponse.json({ ok: true });
}
