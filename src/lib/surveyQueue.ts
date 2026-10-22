import { createDecipheriv, generateKeyPairSync, privateDecrypt, randomBytes, timingSafeEqual, constants } from "node:crypto";
import { db } from "@/lib/db";

/**
 * กล่องพักคำตอบบนโฮสต์ — ตอนเครื่องสำนักงานปิด สมาชิกยังส่งคำตอบได้
 *
 * ```
 * เครื่องปิด:  สมาชิก → www.spsccoop.com (PHP) → เข้ารหัส → พักใน MySQL spsccoop_cast
 * เครื่องเปิด: PHP ส่งรายการที่พักไว้มาที่ /api/survey/<code>/queue/ → รอตรวจ → ลบออกจากโฮสต์
 * ```
 *
 * **โฮสต์อ่านคำตอบที่พักไว้ไม่ได้** — PHP ได้แค่กุญแจสาธารณะ (ล็อกได้อย่างเดียว)
 * กุญแจไขอยู่ใน Setting["surveyQueue"] บนเครื่องนี้ที่เดียว (โฮสต์เป็นเครื่องเช่าใช้ร่วมกับเว็บอื่น)
 * เข้ารหัสแบบผสม: เนื้อหาด้วย AES-256-GCM · กุญแจ AES ด้วย RSA-OAEP (SHA-1 ตามค่าตั้งต้นของ PHP)
 *
 * โทเคนของกล่อง (token) ใช้ยืนยันว่ารายการที่ส่งมามาจากโฮสต์จริง — ถึงจะเชื่อ "เวลาที่ส่ง"
 * ที่โฮสต์บอกมาได้ (คำขอจากคนทั่วไปใช้เวลาที่มาถึงเครื่องนี้เสมอ ย้อนเวลาไม่ได้)
 *
 * ทั้งกุญแจและโทเคนสร้างเองครั้งแรกที่ใช้ แล้วหน้าแบบประเมินในหลังบ้านโชว์ให้คัดลอกไปใส่
 * config.php บนโฮสต์ · ไม่อยู่ใน .env เพราะ .env เป็นของเจ้าของเว็บ
 */

const KEY = "surveyQueue";

export type QueueKeys = { token: string; publicKey: string; privateKey: string };

let cached: QueueKeys | null = null;

export async function queueKeys(): Promise<QueueKeys> {
  if (cached) return cached;
  const row = await db.setting.findUnique({ where: { key: KEY } });
  const value = row?.value as Partial<QueueKeys> | undefined;
  if (value?.token && value.publicKey && value.privateKey) {
    cached = value as QueueKeys;
    return cached;
  }
  const pair = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  const fresh: QueueKeys = {
    token: randomBytes(24).toString("base64url"),
    publicKey: pair.publicKey,
    privateKey: pair.privateKey,
  };
  // สองคำขอพร้อมกันตอนเริ่มต้น — ใช้ชุดที่ลงฐานได้ก่อน
  await db.setting.upsert({ where: { key: KEY }, create: { key: KEY, value: fresh }, update: {} });
  const saved = (await db.setting.findUnique({ where: { key: KEY } }))?.value as QueueKeys;
  cached = saved;
  return saved;
}

/** รายการนี้มาจากโฮสต์จริงไหม */
export async function fromHost(request: Request): Promise<boolean> {
  const given = Buffer.from(request.headers.get("x-queue-token") ?? "");
  if (given.length === 0) return false;
  const expected = Buffer.from((await queueKeys()).token);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export type Sealed = { k: string; iv: string; tag: string; data: string };

/** ไขของที่โฮสต์ล็อกไว้ — คืน null ถ้าไม่ใช่ของเรา หรือถูกแก้กลางทาง (GCM ตรวจให้) */
export async function openSealed(sealed: unknown): Promise<string | null> {
  const s = sealed as Partial<Sealed> | null;
  if (!s?.k || !s.iv || !s.tag || !s.data) return null;
  try {
    const { privateKey } = await queueKeys();
    const key = privateDecrypt(
      { key: privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha1" },
      Buffer.from(s.k, "base64"),
    );
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(s.iv, "base64"));
    decipher.setAuthTag(Buffer.from(s.tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(s.data, "base64")), decipher.final()]).toString("utf-8");
  } catch {
    return null;
  }
}
