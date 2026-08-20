import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

/**
 * ล็อกอินหลังบ้าน — เก็บ session ไว้ใน DB (ไม่ใช่ JWT)
 * เพราะแบบนี้ถอนสิทธิ์ได้ทันทีถ้าเครื่องหาย/คนออก แค่ลบแถวใน DB
 */

const COOKIE_NAME = "spsc_session";
/** คุกกี้ "มุมมองผู้ใช้" — ADMIN สวมมุมมองของเจ้าหน้าที่คนอื่นเพื่อดูว่าเขาเห็นอะไร */
const VIEW_AS_COOKIE = "spsc_viewas";
const SESSION_DAYS = 7;

export type SessionUser = {
  id: string;
  username: string;
  name: string;
  role: "ADMIN" | "EDITOR";
  /** พื้นที่รับผิดชอบ — ว่าง = ดูแลได้ทั้งเว็บ (ดู src/lib/permissions.ts) */
  areas: string[];
};

/**
 * ตัวตนที่ระบบใช้ตัดสินสิทธิ์ ณ ตอนนี้
 *
 * ปกติ user กับ real เป็นคนเดียวกัน จะต่างกันก็ต่อเมื่อ ADMIN กำลังเปิด "มุมมองผู้ใช้"
 * อยู่ — ตอนนั้น user คือคนที่ถูกสวมมุมมอง ส่วน real คือ ADMIN ตัวจริง และ viewing
 * เป็น true ซึ่งแปลว่า **ดูได้อย่างเดียว ห้ามเขียนอะไรทั้งสิ้น**
 */
export type AdminView = {
  user: SessionUser;
  real: SessionUser;
  viewing: boolean;
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

  return toSessionUser(user);
}

/** แถวใน DB → ตัวตนที่เอาไปใช้ตัดสินสิทธิ์ */
function toSessionUser(user: {
  id: string;
  username: string;
  name: string;
  role: "ADMIN" | "EDITOR";
  areas: string[];
}): SessionUser {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    areas: user.areas,
  };
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

/** คนที่ล็อกอินอยู่จริง ๆ — ไม่สนใจมุมมองผู้ใช้ */
async function sessionOwner(): Promise<SessionUser | null> {
  const store = await cookies();
  const sessionId = store.get(COOKIE_NAME)?.value;
  if (!sessionId) return null;

  const session = await db.session.findUnique({ where: { id: sessionId }, include: { user: true } });
  if (!session || session.expiresAt < new Date() || !session.user.active) {
    return null;
  }

  return toSessionUser(session.user);
}

/**
 * ตัวตนที่ใช้ตัดสินสิทธิ์ตอนนี้ พร้อมบอกว่ากำลังอยู่ในมุมมองผู้ใช้อื่นหรือเปล่า
 * null = ยังไม่ได้ล็อกอินหรือ session หมดอายุ
 *
 * มุมมองผู้ใช้เปิดได้เฉพาะ ADMIN — คุกกี้ค้างอยู่ในเครื่องของคนที่ไม่ใช่ ADMIN
 * ก็ไม่มีผล เพราะตรงนี้เช็คสิทธิ์ของ session จริงทุกครั้ง ไม่ได้เชื่อคุกกี้
 */
export async function currentView(): Promise<AdminView | null> {
  const real = await sessionOwner();
  if (!real) return null;

  const plain = { user: real, real, viewing: false };
  if (real.role !== "ADMIN") return plain;

  const store = await cookies();
  const targetId = store.get(VIEW_AS_COOKIE)?.value;
  if (!targetId || targetId === real.id) return plain;

  const target = await db.user.findUnique({ where: { id: targetId } });
  if (!target) return plain;

  return { user: toSessionUser(target), real, viewing: true };
}

/** ใครล็อกอินอยู่ — null ถ้ายังไม่ได้ล็อกอินหรือหมดอายุ (คืนตัวตนตามมุมมองที่เปิดอยู่) */
export async function currentUser(): Promise<SessionUser | null> {
  return (await currentView())?.user ?? null;
}

/** เปิดมุมมองของผู้ใช้คนหนึ่ง — คุกกี้อายุเท่ากับ session ไม่ต้องมาคอยล้างเอง */
export async function startViewAs(userId: string): Promise<void> {
  const store = await cookies();
  store.set(VIEW_AS_COOKIE, userId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
}

/** ออกจากมุมมองผู้ใช้ กลับมาเป็นตัวเอง */
export async function stopViewAs(): Promise<void> {
  const store = await cookies();
  store.delete(VIEW_AS_COOKIE);
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const sessionId = store.get(COOKIE_NAME)?.value;
  if (sessionId) {
    await db.session.deleteMany({ where: { id: sessionId } });
  }
  store.delete(COOKIE_NAME);
  // ออกจากระบบทั้งที ต้องไม่เหลือมุมมองผู้ใช้ค้างไว้ให้คนที่ล็อกอินคนต่อไป
  store.delete(VIEW_AS_COOKIE);
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
