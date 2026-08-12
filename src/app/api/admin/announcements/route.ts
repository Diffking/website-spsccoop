import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/apiAuth";
import { isKind } from "@/lib/announcementKinds";

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json().catch(() => ({}))) as {
    number?: string;
    title?: string;
    publishedAt?: string;
    fileUrl?: string;
    kind?: string;
    badge?: string;
  };

  const number = body.number?.trim() ?? "";
  const title = body.title?.trim() ?? "";
  if (!number || !title) {
    return NextResponse.json({ error: "กรุณาใส่เลขที่ประกาศและชื่อเรื่อง" }, { status: 400 });
  }

  const publishedAt = body.publishedAt ? new Date(body.publishedAt) : new Date();
  if (Number.isNaN(publishedAt.getTime())) {
    return NextResponse.json({ error: "วันที่ไม่ถูกต้อง" }, { status: 400 });
  }

  const item = await db.announcement.create({
    data: {
      number,
      title,
      publishedAt,
      fileUrl: body.fileUrl?.trim() || null,
      badge: body.badge?.trim().slice(0, 16) || null,
      // ไม่ส่งมา/ส่งค่าแปลก = ประกาศ ตามเดิม
      kind: isKind(body.kind) ? body.kind : "ANNOUNCEMENT",
    },
  });
  return NextResponse.json({ item }, { status: 201 });
}
