import { NextResponse } from "next/server";
import { requireWrite } from "@/lib/apiAuth";
import { db } from "@/lib/db";
import { parseThaiDate } from "@/app/api/admin/holidays/route";
import { readAlbumBody } from "@/lib/galleryInput";

/** เพิ่มอัลบั้มภาพกิจกรรม */
export async function POST(request: Request) {
  const auth = await requireWrite("gallery");
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const read = readAlbumBody(body, parseThaiDate, true);
  if ("error" in read) return NextResponse.json({ error: read.error }, { status: 400 });

  const d = read.data;
  const item = await db.galleryAlbum.create({
    data: {
      title: d.title!,
      eventDate: d.eventDate!,
      coverUrl: d.coverUrl!,
      albumUrl: d.albumUrl!,
      place: d.place ?? null,
      caption: d.caption ?? null,
      photoCount: d.photoCount ?? null,
      showOnHome: d.showOnHome ?? true,
      published: d.published ?? true,
    },
  });
  return NextResponse.json({ item }, { status: 201 });
}
