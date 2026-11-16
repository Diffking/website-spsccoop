/**
 * ด่านกันบอทของแบบที่ "สมาชิกระบุตัวตนเอง" (identityMode = "self" · เจ้าของเว็บขอ 16 พ.ย. 2569)
 *
 * โหมดนี้ไม่ได้เทียบเลขสมาชิกกับทะเบียน ใครก็พิมพ์อะไรก็ได้ — จึงต้องกันสคริปต์ยิงขยะรัว ๆ
 * กันไว้ 4 ชั้น (ไม่พึ่งบริการภายนอก เพราะตอนเครื่องสำนักงานปิด คำขอยังต้องฝากผ่าน Worker ได้):
 *
 *   1. ช่องดักบอท (honeypot) — ช่องซ่อนที่คนมองไม่เห็น บอทกรอกทุกช่องเลยติดกับ
 *   2. เวลากรอกขั้นต่ำ — เปิดหน้าจนกดส่งเร็วกว่าคนจริงทำได้ = บอท
 *   3. โจทย์คำนวณ (proof-of-work) — เบราว์เซอร์ต้องหาเลขที่ทำให้ SHA-256 ขึ้นต้นด้วยศูนย์
 *      POW_BITS บิต (~1 วินาทีบนมือถือ) ส่งทีละรายการไม่รู้สึก แต่ยิงทีละพันรายการต้องเผาเครื่องเอง
 *      โจทย์ผูกกับรหัสแบบ + เลขสมาชิก + เวลา จึงเอาคำตอบเดิมไปใช้ซ้ำกับเลขอื่นไม่ได้
 *   4. จำกัดจำนวนต่อไอพี — allowQueue() ของเดิม (และ Worker จำกัดไอพีละ 10/ชม. อีกชั้น)
 *
 * ไฟล์นี้ใช้ได้ทั้งเบราว์เซอร์และเซิร์ฟเวอร์ (ไม่ import ของ node) — ตัวตรวจฝั่งเซิร์ฟเวอร์อยู่ใน surveyIntake.ts
 */

export const POW_BITS = 14;
/** เปิดหน้าจนกดส่งต้องไม่เร็วกว่านี้ — คนจริงอ่านคำถาม + พิมพ์รายละเอียดไม่มีทางทันใน 4 วินาที */
export const MIN_FILL_MS = 4000;
/** โจทย์ที่แก้แล้วใช้ได้นานเท่านี้ (เผื่อฝากไว้ที่ Worker ตอนเครื่องปิดแล้วดึงทีหลัง เวลาเทียบกับเวลาที่ฝาก) */
export const PROOF_MAX_AGE_MS = 3 * 60 * 60 * 1000;

export type BotProof = {
  /** เวลาที่แก้โจทย์ (ms) */
  ts: number;
  nonce: number;
  /** เวลาที่เปิดหน้า (ms) */
  startedAt: number;
  /** ช่องดักบอท — ต้องว่าง */
  hp: string;
};

/** เวลาที่ใช้ผูกโจทย์ — แยกออกมาให้คอมโพเนนต์เรียกตอนกดส่งได้ (กฎ react-hooks/purity ห้ามเรียก Date.now ตรง ๆ) */
export const proofTime = () => Date.now();

export const challengeOf = (code: string, membNo: string, ts: number) => `spsc|${code}|${membNo}|${ts}`;

/** จำนวนบิตศูนย์นำหน้าของผลแฮช */
export function leadingZeroBits(bytes: Uint8Array): number {
  let bits = 0;
  for (const b of bytes) {
    if (b === 0) {
      bits += 8;
      continue;
    }
    return bits + Math.clz32(b) - 24;
  }
  return bits;
}

/** แก้โจทย์ในเบราว์เซอร์ — คืนเลขแรกที่ผ่าน */
export async function solvePow(challenge: string, bits = POW_BITS): Promise<number> {
  const enc = new TextEncoder();
  for (let nonce = 0; nonce < 50_000_000; nonce++) {
    const digest = await crypto.subtle.digest("SHA-256", enc.encode(`${challenge}|${nonce}`));
    if (leadingZeroBits(new Uint8Array(digest)) >= bits) return nonce;
  }
  throw new Error("pow");
}

/** อ่านก้อน bot จากคำขอ — รูปไม่ครบ = null */
export function readProof(raw: unknown): BotProof | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const ts = Number(o.ts);
  const nonce = Number(o.nonce);
  const startedAt = Number(o.startedAt);
  if (![ts, nonce, startedAt].every((n) => Number.isFinite(n) && Number.isInteger(n) && n >= 0)) return null;
  return { ts, nonce, startedAt, hp: typeof o.hp === "string" ? o.hp : "" };
}
