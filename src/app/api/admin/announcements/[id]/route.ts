import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireWrite } from "@/lib/apiAuth";
import { isKind, type Kind } from "@/lib/announcementKinds";
import { purgeEverySite } from "@/lib/mirrorPurge";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireWrite("home.announcements");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    number?: string;
    title?: string;
    publishedAt?: string;
    fileUrl?: string;
    published?: boolean;
    kind?: string;
    badge?: string;
    hideNumber?: boolean;
  };

  const data: {
    kind?: Kind;
    badge?: string | null;
    hideNumber?: boolean;
    number?: string;
    title?: string;
    publishedAt?: Date;
    fileUrl?: string | null;
    published?: boolean;
  } = {};

  if (typeof body.number === "string") {
    if (!body.number.trim()) return NextResponse.json({ error: "เลขที่ประกาศห้ามว่าง" }, { status: 400 });
    data.number = body.number.trim();
  }
  if (typeof body.title === "string") {
    if (!body.title.trim()) return NextResponse.json({ error: "ชื่อเรื่องห้ามว่าง" }, { status: 400 });
    data.title = body.title.trim();
  }
  if (typeof body.hideNumber === "boolean") data.hideNumber = body.hideNumber;
  // ส่งค่าว่างมา = เอาป้ายออก
  if (body.badge !== undefined) data.badge = body.badge.trim().slice(0, 16) || null;
  if (body.kind !== undefined) {
    if (!isKind(body.kind)) return NextResponse.json({ error: "หมวดไม่ถูกต้อง" }, { status: 400 });
    data.kind = body.kind;
  }
  if (typeof body.publishedAt === "string") {
    const date = new Date(body.publishedAt);
    if (Number.isNaN(date.getTime())) return NextResponse.json({ error: "วันที่ไม่ถูกต้อง" }, { status: 400 });
    data.publishedAt = date;
  }
  if (typeof body.fileUrl === "string") data.fileUrl = body.fileUrl.trim() || null;
  if (typeof body.published === "boolean") data.published = body.published;

  const item = await db.announcement.update({ where: { id }, data });
  // สมาชิกจะได้เห็นของใหม่ทันที ไม่ต้องรอสำเนาบนโฮสต์หมดอายุ
  purgeEverySite();
  return NextResponse.json({ item });
}

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireWrite("home.announcements");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  await db.announcement.deleteMany({ where: { id } });
  // สมาชิกจะได้เห็นของใหม่ทันที ไม่ต้องรอสำเนาบนโฮสต์หมดอายุ
  purgeEverySite();
  return NextResponse.json({ ok: true });
}
