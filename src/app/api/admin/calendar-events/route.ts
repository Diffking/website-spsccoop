import { NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { db } from "@/lib/db";

/** เพิ่มกิจกรรมบนปฏิทินหน้าแรก */
export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const day = Number(body.day);
  const title = String(body.title ?? "").trim();
  const type = body.type === "mobile" ? "mobile" : "project";

  if (!Number.isInteger(day) || day < 1 || day > 31) {
    return NextResponse.json({ error: "วันที่ต้องเป็นตัวเลข 1-31" }, { status: 400 });
  }
  if (!title) {
    return NextResponse.json({ error: "ชื่อกิจกรรมห้ามว่าง" }, { status: 400 });
  }

  const item = await db.calendarEvent.create({
    data: {
      day,
      type,
      title,
      place: String(body.place ?? "").trim() || null,
      time: String(body.time ?? "").trim() || null,
    },
  });

  return NextResponse.json({ item }, { status: 201 });
}
