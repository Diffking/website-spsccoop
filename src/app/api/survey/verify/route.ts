import { NextResponse } from "next/server";
import { verifyResponses } from "@/lib/surveyVerify";

/**
 * ตัวตรวจคำตอบอัตโนมัติเรียกที่นี่ทุก 10 นาที — service `survey-verify` ใน docker-compose.yml
 *
 * ตรวจเฉพาะคำตอบที่ "รอตรวจ" (ฝากมาตอนระบบไม่พร้อม) กับฐานสมาชิก
 * ไม่มีอะไรรอ หรือฐานยังต่อไม่ได้ = ไม่ทำอะไร ตอบ checked:0 (ตัวเรียกเงียบ ไม่ขึ้น log)
 * วิ่งไปฐานสมาชิกในวงแลนเท่านั้น ไม่แตะโฮสต์ spsccoop.com
 *
 * ด่านคือโทเคนตัวเดียวกับตัวดึงวันหยุด (HOLIDAY_SYNC_TOKEN) — หลักเดียวกับ /api/holidays/sync
 * ไม่ตั้ง = ตอบ 404 เหมือนไม่มีเส้นทางนี้
 */
export async function POST(request: Request) {
  const expected = (process.env.HOLIDAY_SYNC_TOKEN ?? "").trim();
  if (!expected) {
    return NextResponse.json({ error: "ไม่พบเส้นทางนี้" }, { status: 404 });
  }
  if ((request.headers.get("x-sync-token") ?? "") !== expected) {
    return NextResponse.json({ error: "โทเคนไม่ถูกต้อง" }, { status: 401 });
  }

  const report = await verifyResponses();
  return NextResponse.json(report);
}
