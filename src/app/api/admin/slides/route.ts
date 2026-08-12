import { NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { db } from "@/lib/db";

/** "YYYY-MM-DD" จากช่องเลือกวัน → เที่ยงคืนเวลาไทย · ว่าง = ไม่จำกัด */
export function parseDay(value?: string): Date | null {
  const text = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const date = new Date(`${text}T00:00:00+07:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** เพิ่มสไลด์แบนเนอร์หน้าแรก */
export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json().catch(() => ({}))) as {
    imageUrl?: string;
    title?: string;
    caption?: string;
    href?: string;
    startsAt?: string;
    endsAt?: string;
  };

  const imageUrl = String(body.imageUrl ?? "").trim();
  const title = String(body.title ?? "").trim();

  if (!imageUrl) return NextResponse.json({ error: "กรุณาเลือกรูป" }, { status: 400 });
  if (!title) return NextResponse.json({ error: "หัวข้อห้ามว่าง" }, { status: 400 });

  // ต่อท้ายเสมอ — เรียงใหม่ได้ทีหลังด้วยการลาก หรือปุ่มขึ้น/ลง
  const last = await db.slide.findFirst({ orderBy: { sortOrder: "desc" } });

  const item = await db.slide.create({
    data: {
      imageUrl,
      title,
      caption: String(body.caption ?? "").trim() || null,
      href: String(body.href ?? "").trim() || null,
      startsAt: parseDay(body.startsAt),
      endsAt: parseDay(body.endsAt),
      sortOrder: (last?.sortOrder ?? 0) + 1,
    },
  });

  return NextResponse.json({ item }, { status: 201 });
}

/**
 * จัดลำดับสไลด์ใหม่ทั้งชุด — รับ id เรียงตามลำดับที่ต้องการให้แสดง
 *
 * เขียน sortOrder ใหม่ทั้งตารางในธุรกรรมเดียว ไม่ใช่สลับทีละคู่ เพราะการลากย้ายข้ามหลายตำแหน่ง
 * ถ้าทยอยสลับจะมีจังหวะที่ลำดับกลาง ๆ ผิดอยู่ชั่วขณะ ถ้าขาดกลางคันจะค้างสภาพนั้น
 */
export async function PUT(request: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json().catch(() => ({}))) as { order?: unknown };
  const order = Array.isArray(body.order) ? body.order.filter((v): v is string => typeof v === "string") : [];

  if (order.length === 0) {
    return NextResponse.json({ error: "ไม่ได้ส่งลำดับมา" }, { status: 400 });
  }

  // ต้องครบทุกตัวและไม่ซ้ำ ไม่งั้นจะมีสไลด์ที่ sortOrder ค้างของเดิมแล้วลำดับเพี้ยน
  const existing = await db.slide.findMany({ select: { id: true } });
  const ids = new Set(existing.map((s) => s.id));
  const unique = new Set(order);

  if (unique.size !== order.length || order.length !== ids.size || order.some((id) => !ids.has(id))) {
    return NextResponse.json({ error: "รายการที่ส่งมาไม่ตรงกับสไลด์ที่มีอยู่ ลองโหลดหน้าใหม่" }, { status: 409 });
  }

  await db.$transaction(
    order.map((id, index) => db.slide.update({ where: { id }, data: { sortOrder: index } })),
  );

  return NextResponse.json({ ok: true });
}
