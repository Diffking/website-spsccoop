import { NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { db } from "@/lib/db";
import { isEventType } from "@/lib/homeItems";
import { parseThaiDate } from "@/app/api/admin/holidays/route";
import { purgeEverySite } from "@/lib/mirrorPurge";

/** เพิ่มกิจกรรมบนปฏิทินหน้าแรก */
export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const title = String(body.title ?? "").trim();
  const type = isEventType(body.type) ? body.type : "project";

  // เก็บวันที่เต็ม แล้วแยกเลขวันไว้ให้ปฏิทินหน้าแรกใช้วางลงช่อง — คิดตามเวลาไทยเสมอ
  const date = parseThaiDate(String(body.date ?? ""));
  if (!date) {
    return NextResponse.json({ error: "เลือกวันที่ก่อน" }, { status: 400 });
  }
  const day = Number(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", day: "numeric" }).format(date),
  );

  if (!title) {
    return NextResponse.json({ error: "ชื่อกิจกรรมห้ามว่าง" }, { status: 400 });
  }

  const item = await db.calendarEvent.create({
    data: {
      day,
      date,
      type,
      title,
      place: String(body.place ?? "").trim() || null,
      time: String(body.time ?? "").trim() || null,
    },
  });

  // สมาชิกจะได้เห็นของใหม่ทันที ไม่ต้องรอสำเนาบนโฮสต์หมดอายุ
  purgeEverySite();
  return NextResponse.json({ item }, { status: 201 });
}
