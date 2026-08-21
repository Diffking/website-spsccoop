import { NextResponse } from "next/server";
import { createSession, purgeExpiredSessions, verifyPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { lineReady } from "@/lib/line";

/**
 * เข้าสู่ระบบหลังบ้าน
 *
 * **กันเดารหัสสองชั้น: นับทั้งตามไอพี และตามชื่อผู้ใช้**
 *
 * นับตามไอพีอย่างเดียวไม่พอ เพราะไอพีที่เห็นมาจากหัวคำขอ (`cf-connecting-ip` /
 * `x-forwarded-for`) ซึ่งคนยิงตั้งเองได้ถ้าต่อตรงเข้าเครื่องนี้โดยไม่ผ่าน Cloudflare
 * — เปลี่ยนหัวทุกครั้งก็เดาได้ไม่จำกัด (ทดสอบแล้วว่าทะลุจริง 20 ส.ค. 2026)
 *
 * ชั้นที่กันไม่ได้คือ **ชื่อผู้ใช้** เพราะคนจะเดารหัสของใครก็ต้องส่งชื่อคนนั้นมาเสมอ
 * เรื่องนี้สำคัญเป็นพิเศษกับระบบนี้ เพราะรหัสผ่านคือเลข 4 ตัวท้ายเบอร์โทร
 * = ความเป็นไปได้แค่หมื่นแบบ ถ้าปล่อยให้ยิงรัวได้ก็เดาเจอในไม่กี่นาที
 *
 * ผลข้างเคียงที่ยอมรับ: คนอื่นแกล้งใส่รหัสผิดใส่ชื่อเรา จะทำให้เราเข้าไม่ได้ 15 นาที
 * — ยอมแลกกับการกันเดารหัส และ 15 นาทีก็หายเอง ไม่ต้องให้ใครมาปลดให้
 *
 * เก็บในหน่วยความจำของ process พอ เพราะรัน container เดียว รีสตาร์ทแล้วรีเซ็ตก็ไม่เสียหาย
 */

const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60_000;

/** คีย์เป็น "ip:<ไอพี>" หรือ "user:<ชื่อผู้ใช้>" — ใช้ตารางเดียวกันทั้งสองชั้น */
const attempts = new Map<string, { count: number; firstAt: number }>();

function blockedFor(key: string): number {
  const record = attempts.get(key);
  if (!record) return 0;

  const elapsed = Date.now() - record.firstAt;
  if (elapsed > LOCK_MS) {
    attempts.delete(key);
    return 0;
  }
  return record.count >= MAX_ATTEMPTS ? Math.ceil((LOCK_MS - elapsed) / 60_000) : 0;
}

function recordFailure(key: string): void {
  const record = attempts.get(key);
  if (record && Date.now() - record.firstAt <= LOCK_MS) {
    record.count += 1;
  } else {
    attempts.set(key, { count: 1, firstAt: Date.now() });
  }
}

/*
 * ตารางนี้โตได้เรื่อย ๆ ถ้ามีคนยิงด้วยชื่อสุ่ม — เก็บกวาดของหมดอายุทุกครั้งที่มีคนล็อกอิน
 * ไม่ต้องตั้งตัวจับเวลาแยก และจำนวนผู้ใช้จริงมีไม่กี่คน ตารางจึงเล็กเสมอ
 */
function purgeOldAttempts(): void {
  const now = Date.now();
  for (const [key, record] of attempts) {
    if (now - record.firstAt > LOCK_MS) attempts.delete(key);
  }
}

export async function POST(request: Request) {
  const ip =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    "unknown";

  purgeOldAttempts();

  const body = (await request.json().catch(() => ({}))) as { username?: string; password?: string };
  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!username || !password) {
    return NextResponse.json({ error: "กรุณากรอกชื่อผู้ใช้และรหัสผ่าน" }, { status: 400 });
  }

  // ต้องเช็คชั้นชื่อผู้ใช้ด้วย จึงอ่าน body ก่อนแล้วค่อยตัดสิน
  const wait = Math.max(blockedFor(`ip:${ip}`), blockedFor(`user:${username.toLowerCase()}`));
  if (wait > 0) {
    return NextResponse.json(
      { error: `ใส่รหัสผิดหลายครั้งเกินไป กรุณารออีก ${wait} นาที` },
      { status: 429 },
    );
  }

  const user = await verifyPassword(username, password);
  if (!user) {
    recordFailure(`ip:${ip}`);
    recordFailure(`user:${username.toLowerCase()}`);
    return NextResponse.json({ error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" }, { status: 401 });
  }

  /*
   * ผูก LINE แล้ว = เลิกใช้รหัสผ่านบนโดเมนสาธารณะ
   *
   * รหัสผ่านของระบบนี้อ่อนโดยธรรมชาติ (ตั้งต้นเป็นเลข 4 ตัวท้ายเบอร์ ซึ่งคนในสำนักงาน
   * รู้กันหมด) พอผูก LINE แล้วก็ไม่มีเหตุผลจะเปิดทางที่อ่อนกว่าค้างไว้อีก
   *
   * **ยกเว้น localhost เสมอ** — เครื่องนี้เท่านั้นที่เปิดได้ ต้องมีทางเข้าที่ไม่พึ่ง LINE
   * เผื่อวันที่ LINE ล่ม ช่องถูกปิด หรือตั้งค่าผิดจนกดปุ่มแล้วไม่ไปไหน (หลักเดียวกับ
   * src/proxy.ts ที่เปิด localhost ไว้เสมอ — ตั้งค่าโดเมนพังแล้วต้องไม่ล็อกตัวเองออก)
   *
   * ไม่ได้ตั้งค่า LINE ไว้ก็ข้ามด่านนี้ไป ระบบเดิมทำงานเหมือนเดิมทุกอย่าง
   */
  const host = request.headers.get("host")?.split(":")[0].toLowerCase() ?? "";
  const onThisMachine = host === "localhost" || host === "127.0.0.1";
  if (lineReady() && !onThisMachine) {
    const row = await db.user.findUnique({
      where: { id: user.id },
      select: { lineUserId: true },
    });
    if (row?.lineUserId) {
      return NextResponse.json(
        { error: "บัญชีนี้ผูกกับ LINE แล้ว กรุณากดปุ่ม “เข้าสู่ระบบด้วย LINE”", useLine: true },
        { status: 403 },
      );
    }
  }

  attempts.delete(`ip:${ip}`);
  attempts.delete(`user:${username.toLowerCase()}`);
  await createSession(user.id);
  await purgeExpiredSessions();

  return NextResponse.json({ user });
}
