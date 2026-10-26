import { NextResponse } from "next/server";
import { pullQueue, warmEdge } from "@/lib/surveyEdge";

/**
 * service `survey-verify` เรียกทุก 10 นาที — คุยกับ Cloudflare Worker ที่ survey.spsccoop.org
 *   1. ดึงคำตอบที่ Worker พักไว้ตอนเครื่องปิด เข้ามาเป็น "รอตรวจ"
 *   2. ให้ Worker เก็บสำเนาหน้าแบบประเมินที่เปิดรับอยู่ (เปิดได้ตอนเครื่องปิด)
 * ทิศทาง เครื่องนี้ → Cloudflare เท่านั้น ไม่แตะโฮสต์ spsccoop.com
 *
 * ด่านคือโทเคนตัวเดียวกับตัวดึงวันหยุด (HOLIDAY_SYNC_TOKEN) ไม่ตั้ง = 404
 */
export async function POST(request: Request) {
  const expected = (process.env.HOLIDAY_SYNC_TOKEN ?? "").trim();
  if (!expected) return NextResponse.json({ error: "ไม่พบเส้นทางนี้" }, { status: 404 });
  if ((request.headers.get("x-sync-token") ?? "") !== expected) {
    return NextResponse.json({ error: "โทเคนไม่ถูกต้อง" }, { status: 401 });
  }
  const queue = await pullQueue();
  const warm = await warmEdge();
  return NextResponse.json({ queue, warm });
}
