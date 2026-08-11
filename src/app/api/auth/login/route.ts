import { NextResponse } from "next/server";
import { createSession, purgeExpiredSessions, verifyPassword } from "@/lib/auth";

/**
 * เข้าสู่ระบบหลังบ้าน
 *
 * กันเดารหัส: ผิดเกิน 5 ครั้งจาก IP เดิม ล็อก 15 นาที
 * เก็บในหน่วยความจำของ process พอ เพราะรัน container เดียว รีสตาร์ทแล้วรีเซ็ตก็ไม่เสียหาย
 */

const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60_000;

const attempts = new Map<string, { count: number; firstAt: number }>();

function rateLimit(ip: string): { blocked: boolean; retryInMinutes: number } {
  const record = attempts.get(ip);
  if (!record) return { blocked: false, retryInMinutes: 0 };

  const elapsed = Date.now() - record.firstAt;
  if (elapsed > LOCK_MS) {
    attempts.delete(ip);
    return { blocked: false, retryInMinutes: 0 };
  }
  if (record.count >= MAX_ATTEMPTS) {
    return { blocked: true, retryInMinutes: Math.ceil((LOCK_MS - elapsed) / 60_000) };
  }
  return { blocked: false, retryInMinutes: 0 };
}

function recordFailure(ip: string): void {
  const record = attempts.get(ip);
  if (record && Date.now() - record.firstAt <= LOCK_MS) {
    record.count += 1;
  } else {
    attempts.set(ip, { count: 1, firstAt: Date.now() });
  }
}

export async function POST(request: Request) {
  const ip =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    "unknown";

  const limit = rateLimit(ip);
  if (limit.blocked) {
    return NextResponse.json(
      { error: `ใส่รหัสผิดหลายครั้งเกินไป กรุณารออีก ${limit.retryInMinutes} นาที` },
      { status: 429 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as { username?: string; password?: string };
  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!username || !password) {
    return NextResponse.json({ error: "กรุณากรอกชื่อผู้ใช้และรหัสผ่าน" }, { status: 400 });
  }

  const user = await verifyPassword(username, password);
  if (!user) {
    recordFailure(ip);
    return NextResponse.json({ error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" }, { status: 401 });
  }

  attempts.delete(ip);
  await createSession(user.id);
  await purgeExpiredSessions();

  return NextResponse.json({ user });
}
