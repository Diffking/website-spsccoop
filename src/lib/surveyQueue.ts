import { createDecipheriv, generateKeyPairSync, privateDecrypt, randomBytes, timingSafeEqual, constants } from "node:crypto";
import { db } from "@/lib/db";

/**
 * กุญแจของกล่องพักคำตอบ — Cloudflare Worker ที่ survey.spsccoop.org (cloudflare/survey-edge/)
 *
 * ```
 * เครื่องปิด:  สมาชิก → Worker → เข้ารหัส → พักใน Cloudflare D1
 * เครื่องเปิด: เครื่องนี้ไปดึงเองทุก 10 นาที (src/lib/surveyEdge.ts) → รอตรวจ → สั่ง Worker ลบ
 * ```
 *
 * **Cloudflare อ่านคำตอบที่พักไว้ไม่ได้** — Worker ได้แค่กุญแจสาธารณะ (ล็อกได้อย่างเดียว)
 * กุญแจไขอยู่ใน Setting["surveyQueue"] บนเครื่องนี้ที่เดียว
 * เข้ารหัสแบบผสม: เนื้อหาด้วย AES-256-GCM · กุญแจ AES ด้วย RSA-OAEP (SHA-1)
 *
 * โทเคน (token) ใช้ยืนยันกันทั้งสองทาง — เครื่องนี้ขอรายการ/สั่งลบกับ Worker ได้ คนอื่นไม่ได้
 * ทั้งกุญแจและโทเคนสร้างเองครั้งแรกที่ใช้ แล้วหน้าแบบประเมินในหลังบ้านโชว์ให้ ADMIN คัดลอกไปตั้ง
 * เป็น secret ของ Worker · ไม่อยู่ใน .env เพราะ .env เป็นของเจ้าของเว็บ
 *
 * ⚠️ เดิมกล่องนี้อยู่บนโฮสต์ PHP + MySQL — เจ้าของเว็บสั่งเลิกใช้ PHP 26 ต.ค. 2569 ย้ายมา Worker
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

/** โทเคนตรงไหม — เทียบแบบเวลาคงที่ */
export async function tokenOk(given: string | null | undefined): Promise<boolean> {
  const g = Buffer.from(given ?? "");
  const expected = Buffer.from((await queueKeys()).token);
  return g.length === expected.length && g.length > 0 && timingSafeEqual(g, expected);
}

export type Sealed = { k: string; iv: string; tag: string; data: string };

/** ไขของที่ Worker ล็อกไว้ — คืน null ถ้าไม่ใช่ของเรา หรือถูกแก้กลางทาง (GCM ตรวจให้) */
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
