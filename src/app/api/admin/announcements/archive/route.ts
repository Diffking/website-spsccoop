import { NextResponse } from "next/server";
import { requireWrite } from "@/lib/apiAuth";
import { db } from "@/lib/db";

/**
 * จัดเก็บประกาศเข้าคลังปีบัญชี / ย้ายกลับ (16 พ.ย. 2569)
 *
 *   { action: "archive", year: 2569, from: 1, to: 30 }
 *       จัดเก็บ "ประกาศ" (เฉพาะหมวดประกาศ) เลขที่ from–to ของปี year เช่น 1/2569 – 30/2569
 *       เข้าคลังปีบัญชี year · ตัวที่จัดเก็บไปแล้วไม่ถูกแตะ
 *   { action: "restore", id }
 *       ย้ายกลับมาเป็นประกาศปัจจุบัน (ขึ้นหน้าแรกอีกครั้ง)
 *   { action: "delete", id } · { action: "deleteYear", year }
 *       ลบประกาศในคลังทิ้งถาวร ทีละฉบับ / ทั้งปีบัญชี (เจ้าของเว็บขอ 16 พ.ย. 2569)
 *       ⚠️ ลบได้เฉพาะแถวที่จัดเก็บแล้ว (archiveYear มีค่า) ประกาศปัจจุบันลบทางนี้ไม่ได้
 *       ลบแค่แถวในฐาน ไฟล์ใน uploads/ ยังอยู่ (หลักเดียวกับปุ่มลบประกาศเดิม) · กู้ได้จากไฟล์สำรองรายวัน
 */
export async function POST(request: Request) {
  const auth = await requireWrite("home.announcements");
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  if (body.action === "restore") {
    const id = typeof body.id === "string" ? body.id : "";
    const updated = await db.announcement.updateMany({ where: { id }, data: { archiveYear: null, sortOrder: 0 } });
    return NextResponse.json({ ok: true, count: updated.count });
  }

  if (body.action === "delete") {
    const id = typeof body.id === "string" ? body.id : "";
    const removed = await db.announcement.deleteMany({ where: { id, archiveYear: { not: null } } });
    return NextResponse.json({ ok: true, count: removed.count });
  }

  if (body.action === "deleteYear") {
    const year = Math.trunc(Number(body.year));
    if (!(year >= 2560 && year <= 2700)) {
      return NextResponse.json({ error: "ปีไม่ถูกต้อง" }, { status: 400 });
    }
    const removed = await db.announcement.deleteMany({ where: { archiveYear: year } });
    return NextResponse.json({ ok: true, count: removed.count });
  }

  if (body.action === "archive") {
    const year = Math.trunc(Number(body.year));
    const from = Math.trunc(Number(body.from));
    const to = Math.trunc(Number(body.to));
    if (!(year >= 2560 && year <= 2700) || !(from >= 1) || !(to >= from) || to > 9999) {
      return NextResponse.json({ error: "ปี หรือช่วงเลขที่ไม่ถูกต้อง" }, { status: 400 });
    }
    const rows = await db.announcement.findMany({
      where: { kind: "ANNOUNCEMENT", archiveYear: null },
      select: { id: true, number: true },
    });
    const pick = rows.filter((r) => {
      const m = /^\s*(\d+)\s*\/\s*(\d{4})\s*$/.exec(r.number);
      return m !== null && Number(m[2]) === year && Number(m[1]) >= from && Number(m[1]) <= to;
    });
    if (pick.length === 0) {
      return NextResponse.json({ error: `ไม่พบประกาศเลขที่ ${from}/${year} – ${to}/${year} ที่ยังไม่จัดเก็บ` }, { status: 404 });
    }
    await db.announcement.updateMany({ where: { id: { in: pick.map((p) => p.id) } }, data: { archiveYear: year } });
    return NextResponse.json({ ok: true, count: pick.length });
  }

  return NextResponse.json({ error: "ไม่รู้จักคำสั่ง" }, { status: 400 });
}
