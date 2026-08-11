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

  // ต่อท้ายเสมอ — เรียงใหม่ได้ทีหลังด้วยปุ่มขึ้น/ลง
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
