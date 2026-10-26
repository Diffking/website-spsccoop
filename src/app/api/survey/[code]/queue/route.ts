import { NextResponse } from "next/server";
import { allowQueue, visitorIp } from "@/lib/surveyGuard";
import { acceptQueued } from "@/lib/surveyIntake";

type Params = { params: Promise<{ code: string }> };

/**
 * รับคำตอบแบบ "ฝากไว้ ตรวจทีหลัง" จากเบราว์เซอร์ — เครื่องนี้เปิดอยู่ แต่ยืนยันตัวตนสดไม่ได้
 * (ฐานสมาชิกไม่พร้อม) · body = { phone, name, answers }
 *
 * ตอนเครื่องนี้ปิด คำขอนี้มาไม่ถึง — Cloudflare Worker ที่ survey.spsccoop.org พักไว้แทน
 * แล้วเครื่องนี้ไปดึงเองทีหลัง (POST /api/survey/pull · src/lib/surveyEdge.ts) — ไม่มี PHP เกี่ยวข้อง
 *
 * เวลาที่ส่ง = เวลาที่มาถึงเครื่องนี้เสมอ คนทั่วไปย้อนเวลาเข้าแบบประเมินที่ปิดแล้วไม่ได้
 */
export async function POST(request: Request, { params }: Params) {
  const { code } = await params;
  if (!allowQueue(visitorIp(request))) {
    return NextResponse.json({ error: "ส่งหลายครั้งเกินไป กรุณารอสัก 15 นาทีแล้วลองใหม่" }, { status: 429 });
  }
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const result = await acceptQueued(code, body);
  return NextResponse.json(result.body, { status: result.status });
}
