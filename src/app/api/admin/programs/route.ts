import { NextResponse } from "next/server";
import { requireWrite } from "@/lib/apiAuth";
import { saveSetting } from "@/lib/settings";
import { CHECKUP_IMAGES_KEY } from "@/lib/programPages";
import { CHECKUP_QUESTIONS } from "@/lib/financialCheckup";
import { purgeEverySite } from "@/lib/mirrorPurge";

/**
 * ตั้งค่าของ "หน้าโปรแกรม" — ตอนนี้มีอย่างเดียวคือภาพประกอบคำถามของโปรแกรมตรวจสุขภาพการเงิน
 *
 * เก็บเป็น { รหัสคำถาม: ที่อยู่รูป } ใน Setting["checkupImages"]
 * ⚠️ **รับเฉพาะรหัสคำถามที่มีอยู่จริง** ไม่งั้นยิงค่ามั่ว ๆ เข้ามาก็สะสมขยะในฐานได้ไม่จำกัด
 * ⚠️ **รับเฉพาะที่อยู่รูปในเว็บนี้** (`/uploads/…`) กันคนฝังที่อยู่รูปจากเว็บอื่นมาโผล่ในหน้าเรา
 */
export async function PUT(request: Request) {
  const auth = await requireWrite("programs");
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json().catch(() => ({}))) as { checkupImages?: Record<string, unknown> };
  if (!body.checkupImages || typeof body.checkupImages !== "object") {
    return NextResponse.json({ error: "ไม่ได้ส่งข้อมูลมา" }, { status: 400 });
  }

  const known = new Set(CHECKUP_QUESTIONS.map((q) => q.id));
  const clean: Record<string, string> = {};
  for (const [id, url] of Object.entries(body.checkupImages)) {
    if (!known.has(id)) continue;
    const value = String(url ?? "").trim();
    // ค่าว่าง = เอาภาพออก จึงไม่เก็บลงไป
    if (value.startsWith("/uploads/")) clean[id] = value;
  }

  await saveSetting(CHECKUP_IMAGES_KEY, clean);
  // สมาชิกจะได้เห็นภาพใหม่ทันที ไม่ต้องรอสำเนาบนโฮสต์หมดอายุ
  purgeEverySite();
  return NextResponse.json({ ok: true, count: Object.keys(clean).length });
}
