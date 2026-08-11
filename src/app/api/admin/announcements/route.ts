import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/apiAuth";

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json().catch(() => ({}))) as {
    number?: string;
    title?: string;
    publishedAt?: string;
    fileUrl?: string;
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
    data: { number, title, publishedAt, fileUrl: body.fileUrl?.trim() || null },
  });
  return NextResponse.json({ item }, { status: 201 });
}
