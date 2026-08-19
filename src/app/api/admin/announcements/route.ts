import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/apiAuth";
import { isKind } from "@/lib/announcementKinds";
import { purgeEverySite } from "@/lib/mirrorPurge";

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
    hideNumber?: boolean;
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

  const kind = isKind(body.kind) ? body.kind : "ANNOUNCEMENT";
  // เอกสารใหม่ควรอยู่บนสุดของหมวดตัวเอง จึงให้ลำดับน้อยกว่าตัวที่บนสุดอยู่ตอนนี้
  const top = await db.announcement.findFirst({
    where: { kind },
    orderBy: { sortOrder: "asc" },
    select: { sortOrder: true },
  });

  const item = await db.announcement.create({
    data: {
      number,
      title,
      publishedAt,
      fileUrl: body.fileUrl?.trim() || null,
      badge: body.badge?.trim().slice(0, 16) || null,
      hideNumber: body.hideNumber === true,
      kind,
      sortOrder: (top?.sortOrder ?? 0) - 1,
    },
  });
  // สมาชิกจะได้เห็นของใหม่ทันที ไม่ต้องรอสำเนาบนโฮสต์หมดอายุ
  purgeEverySite();
  return NextResponse.json({ item }, { status: 201 });
}

/**
 * จัดลำดับใหม่ทั้งหมวด — รับ id เรียงตามลำดับที่ต้องการให้แสดง
 * เขียน sortOrder ใหม่ทั้งชุดในธุรกรรมเดียว เหมือนที่ทำกับแบนเนอร์สไลด์
 */
export async function PUT(request: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json().catch(() => ({}))) as { kind?: unknown; order?: unknown };
  if (!isKind(body.kind)) {
    return NextResponse.json({ error: "ไม่รู้จักหมวดที่จะจัดลำดับ" }, { status: 400 });
  }
  const order = Array.isArray(body.order)
    ? body.order.filter((v): v is string => typeof v === "string")
    : [];
  if (order.length === 0) {
    return NextResponse.json({ error: "ไม่ได้ส่งลำดับมา" }, { status: 400 });
  }

  // ต้องครบทุกตัวในหมวดนั้นและไม่ซ้ำ ไม่งั้นจะมีตัวที่ sortOrder ค้างของเดิมแล้วลำดับเพี้ยน
  const existing = await db.announcement.findMany({ where: { kind: body.kind }, select: { id: true } });
  const ids = new Set(existing.map((a) => a.id));
  if (new Set(order).size !== order.length || order.length !== ids.size || order.some((id) => !ids.has(id))) {
    // สมาชิกจะได้เห็นของใหม่ทันที ไม่ต้องรอสำเนาบนโฮสต์หมดอายุ
    purgeEverySite();
    return NextResponse.json(
      { error: "รายการที่ส่งมาไม่ตรงกับที่มีอยู่ ลองโหลดหน้าใหม่" },
      { status: 409 },
    );
  }

  await db.$transaction(
    order.map((id, index) => db.announcement.update({ where: { id }, data: { sortOrder: index } })),
  );

  // สมาชิกจะได้เห็นของใหม่ทันที ไม่ต้องรอสำเนาบนโฮสต์หมดอายุ
  purgeEverySite();
  return NextResponse.json({ ok: true });
}
