import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

/**
 * ล็อกอินหลังบ้าน — เก็บ session ไว้ใน DB (ไม่ใช่ JWT)
 * เพราะแบบนี้ถอนสิทธิ์ได้ทันทีถ้าเครื่องหาย/คนออก แค่ลบแถวใน DB
 */

const COOKIE_NAME = "spsc_session";
const SESSION_DAYS = 7;

export type SessionUser = {
  id: string;
  username: string;
  name: string;
  role: "ADMIN" | "EDITOR";
};

/** ตรวจรหัสผ่าน — คืน null ถ้าไม่ผ่าน (ไม่บอกว่าผิดตรงไหน กันเดาชื่อผู้ใช้) */
export async function verifyPassword(username: string, password: string): Promise<SessionUser | null> {
  const user = await db.user.findUnique({ where: { username } });

  // เทียบ hash หลอกๆ เมื่อไม่เจอผู้ใช้ ให้เวลาตอบพอๆ กัน จะได้เดาไม่ได้ว่าชื่อนี้มีจริงไหม
  if (!user || !user.active) {
    await bcrypt.compare(password, "$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin");
    return null;
  }

  if (!(await bcrypt.compare(password, user.passwordHash))) {
    return null;
  }

  return { id: user.id, username: user.username, name: user.name, role: user.role };
}

/** สร้าง session ใหม่แล้วตั้งคุกกี้ */
export async function createSession(userId: string): Promise<void> {
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  const session = await db.session.create({ data: { userId, expiresAt } });
  await db.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });

  const store = await cookies();
  store.set(COOKIE_NAME, session.id, {
    httpOnly: true, // JS อ่านไม่ได้ กัน XSS ขโมย session
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/** ใครล็อกอินอยู่ — null ถ้ายังไม่ได้ล็อกอินหรือหมดอายุ */
export async function currentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const sessionId = store.get(COOKIE_NAME)?.value;
  if (!sessionId) return null;

  const session = await db.session.findUnique({ where: { id: sessionId }, include: { user: true } });
  if (!session || session.expiresAt < new Date() || !session.user.active) {
    return null;
  }

  const { user } = session;
  return { id: user.id, username: user.username, name: user.name, role: user.role };
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const sessionId = store.get(COOKIE_NAME)?.value;
  if (sessionId) {
    await db.session.deleteMany({ where: { id: sessionId } });
  }
  store.delete(COOKIE_NAME);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

/**
 * รหัสผ่านของระบบ = เลข 4 ตัวท้ายของเบอร์โทร (ตามที่สหกรณ์กำหนด)
 * คืน null ถ้าเบอร์มีตัวเลขไม่ถึง 4 ตัว
 *
 * เก็บลง DB เป็น bcrypt hash เสมอ — ไม่เคยเก็บรหัสเป็นตัวเลขล้วน
 */
export function passwordFromPhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 4 ? digits.slice(-4) : null;
}

/** ลบ session ที่หมดอายุทิ้ง — เรียกตอนล็อกอิน ไม่ต้องตั้ง cron */
export async function purgeExpiredSessions(): Promise<void> {
  await db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
}
