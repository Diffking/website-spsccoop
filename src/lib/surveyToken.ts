import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";

/**
 * บัตรผ่านหลังยืนยันตัวตน — ยืนยันแล้วได้บัตรไปแนบตอนส่งคำตอบ
 *
 * ไม่ได้ให้หน้าจอส่งเลขสมาชิกมาตอนส่งคำตอบตรง ๆ เพราะใครก็แก้เลขในคำขอได้
 * บัตรนี้เซ็นด้วยกุญแจลับฝั่งเซิร์ฟเวอร์ ปลอมไม่ได้ และผูกกับแบบประเมินชุดเดียว
 *
 * อายุ 2 ชั่วโมง — แบบประเมิน 19 ข้อพร้อมตาราง 50 แถวใช้เวลาตอบจริงไม่ถึงครึ่งชั่วโมง
 * เผื่อคนที่วางมือถือไปทำอย่างอื่นแล้วกลับมาตอบต่อ
 *
 * กุญแจเก็บในฐาน (Setting "surveySecret") สร้างเองครั้งแรกที่ใช้ — ไม่ต้องให้ใครไปตั้งใน .env
 * (หลักเดียวกับโทเคน CoopBridge) · ลบแถวนั้นทิ้ง = บัตรที่ออกไปแล้วใช้ไม่ได้ทั้งหมด
 */

const TTL_MS = 2 * 60 * 60_000;
const SECRET_KEY = "surveySecret";

let cached: Buffer | null = null;

async function secret(): Promise<Buffer> {
  if (cached) return cached;
  const row = await db.setting.findUnique({ where: { key: SECRET_KEY } });
  let value = typeof row?.value === "string" ? row.value : "";
  if (!value) {
    value = randomBytes(32).toString("base64url");
    // สองคำขอพร้อมกันตอนเริ่มต้นอาจสร้างคนละค่า — ใช้ค่าที่ลงฐานได้ก่อน
    await db.setting.upsert({ where: { key: SECRET_KEY }, create: { key: SECRET_KEY, value }, update: {} });
    const saved = await db.setting.findUnique({ where: { key: SECRET_KEY } });
    value = String(saved?.value ?? value);
  }
  cached = Buffer.from(value);
  return cached;
}

const sign = (body: string, key: Buffer) => createHmac("sha256", key).update(body).digest("base64url");

export async function issueToken(surveyId: string, membNo: string): Promise<string> {
  const body = Buffer.from(JSON.stringify({ s: surveyId, m: membNo, e: Date.now() + TTL_MS })).toString("base64url");
  return `${body}.${sign(body, await secret())}`;
}

/** คืนเลขสมาชิก ถ้าบัตรถูกต้อง ยังไม่หมดอายุ และออกให้แบบประเมินชุดนี้ */
export async function readToken(token: unknown, surveyId: string): Promise<string | null> {
  if (typeof token !== "string") return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;

  const expected = Buffer.from(sign(body, await secret()));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf-8")) as { s: string; m: string; e: number };
    if (data.s !== surveyId || typeof data.m !== "string" || !(data.e > Date.now())) return null;
    return data.m;
  } catch {
    return null;
  }
}
