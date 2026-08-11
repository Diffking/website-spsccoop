import { NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { db } from "@/lib/db";

/** วันที่ล้วนจากช่อง input (YYYY-MM-DD) — ตรึงเป็นเที่ยงคืนเวลาไทย ไม่ให้เลื่อนวันตามโซนเวลาเซิร์ฟเวอร์ */
export function parseThaiDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00+07:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** เพิ่มวันหยุดทำการ */
export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json().catch(() => ({}))) as {
    date?: string;
    title?: string;
    note?: string;
  };

  const date = parseThaiDate(String(body.date ?? ""));
  const title = String(body.title ?? "").trim();

  if (!date) {
    return NextResponse.json({ error: "วันที่ไม่ถูกต้อง" }, { status: 400 });
  }
  if (!title) {
    return NextResponse.json({ error: "ชื่อวันหยุดห้ามว่าง" }, { status: 400 });
  }

  const item = await db.holiday.create({
    data: { date, title, note: String(body.note ?? "").trim() || null },
  });

  return NextResponse.json({ item }, { status: 201 });
}
