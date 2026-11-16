import { NextResponse } from "next/server";
import { requireWrite } from "@/lib/apiAuth";
import { db } from "@/lib/db";
import { parseThaiDate } from "@/app/api/admin/holidays/route";
import { readAlbumBody } from "@/lib/galleryInput";

type Params = { params: Promise<{ id: string }> };

/** แก้อัลบั้ม — ส่งมาเฉพาะช่องที่เปลี่ยน */
export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireWrite("gallery");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const existing = await db.galleryAlbum.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "ไม่พบอัลบั้มนี้" }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const read = readAlbumBody(body, parseThaiDate, false);
  if ("error" in read) return NextResponse.json({ error: read.error }, { status: 400 });

  const item = await db.galleryAlbum.update({ where: { id }, data: read.data });
  return NextResponse.json({ item });
}

/**
 * ลบอัลบั้ม — ลบแค่แถวในฐาน ไฟล์ภาพเด่นใน uploads/ ยังอยู่
 * (หลักเดียวกับรูปสไลด์ · ไฟล์เดียวไม่กี่ร้อย KB และสำเนาบนโฮสต์อาจยังอ้างถึงอยู่)
 */
export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireWrite("gallery");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  await db.galleryAlbum.deleteMany({ where: { id } });
  return NextResponse.json({ ok: true });
}
