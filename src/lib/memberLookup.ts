import { createHmac } from "node:crypto";
import { db } from "@/lib/db";

/**
 * ทะเบียนสมาชิกสำหรับยืนยันตัวตนผู้ตอบแบบประเมิน — อ่านจากตาราง Member ในฐานของเว็บ
 *
 * ต้นทางคือ sync-agent (192.168.100.142) **เป็นฝ่ายส่งมาหาเรา** วันละ 2 รอบ (08:50 / 16:50)
 * ผ่าน POST /api/eval/members/ (src/lib/memberSync.ts) — เว็บไม่ต่อฐานทะเบียนหลักเลย
 * สเปกของผู้ดูแล sync-agent: ยืนยันด้วย **เลขสมาชิกคู่กับเบอร์มือถือ** เสมอ · ห้ามมีที่ใส่เลขแล้วเห็นชื่อ
 *
 * เบอร์จริงไม่มีในฐาน — ทะเบียนเก็บแค่ HMAC-SHA256(เบอร์, EVAL_PHONE_PEPPER)
 * เบอร์ที่สมาชิกกรอกจึงต้อง normalize ด้วยกติกาเดียวกับ sync-agent แล้ว HMAC มาเทียบ
 * ⚠️ EVAL_PHONE_PEPPER อยู่ใน .env เท่านั้น ห้ามเก็บลงฐาน (ฐานหลุด + pepper ไม่หลุด = ย้อนหาเบอร์ไม่ได้)
 *
 * ⚠️ **ยังไม่มีทะเบียน / ไม่มี pepper = ปฏิเสธเสมอ (fail closed)** ห้ามเปลี่ยนเป็น "ให้ผ่านไปก่อน"
 */

export type Member = {
  membNo: string;
  /** ชื่อเต็มพร้อมคำนำหน้า */
  name: string;
  /** ไม่มีเบอร์จริงแล้ว — คงช่องไว้ให้แถวคำตอบเดิมเข้ากันได้ */
  phone: string | null;
  /** กลุ่มเรียกเก็บ (dept_name) */
  department: string | null;
  /** เพศ · ช่วงอายุ · ประเภทสมาชิก · เป็นพนักงานสหกรณ์ — ลงแถวคำตอบไว้แยกผล/ตัดสิทธิ์ */
  profile: Record<string, unknown>;
};

export type LookupResult =
  | { ok: true; member: Member }
  | { ok: false; reason: "notfound" | "unavailable" };

/** เลขสมาชิก: ตัวเลขล้วน ไม่เกิน 8 หลัก */
export function readMembNo(raw: unknown): string | null {
  const digits = typeof raw === "string" ? raw.replace(/\D/g, "") : "";
  return /^\d{1,8}$/.test(digits) ? digits : null;
}

/** คีย์ของเลขสมาชิก — ตัด 0 นำหน้า "07337" กับ "7337" คือคนเดียวกัน */
export const membKey = (membNo: string) => membNo.replace(/^0+/, "") || "0";

/**
 * normalize เบอร์ตามสเปก sync-agent ข้อ 4 — ต้องตรงกันเป๊ะ ไม่งั้นเบอร์ถูกก็เทียบไม่ผ่าน
 * ตัดช่องว่าง - ( ) . → ตัด + นำหน้า → 66 + 9 หลัก = 0 + 9 หลัก → ต้องได้ 10 หลักขึ้นต้น 0
 */
export function normalizePhone(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let s = raw.replace(/[\s\-().]/g, "").replace(/^\+/, "");
  if (s.startsWith("66") && s.length === 11) s = `0${s.slice(2)}`;
  return /^0\d{9}$/.test(s) ? s : null;
}

const pepper = () => process.env.EVAL_PHONE_PEPPER ?? "";

/** HMAC ของเบอร์ที่ normalize แล้ว — ไม่มี pepper = null (เทียบไม่ได้) */
export function phoneHash(phone: string): string | null {
  const key = pepper();
  return key ? createHmac("sha256", key).update(phone).digest("hex") : null;
}

/** "0812345678" → "081-xxx-5678" ไว้ให้เจ้าหน้าที่ดูว่าสมาชิกกรอกอะไรมา โดยไม่เก็บเบอร์เต็ม */
export const maskPhone = (phone: string) => `${phone.slice(0, 3)}-xxx-${phone.slice(-4)}`;

/** ยืนยันตัวตนได้ไหม — มี pepper และมีทะเบียนอย่างน้อยหนึ่งคน */
export async function memberSourceReady(): Promise<boolean> {
  if (!pepper()) return false;
  try {
    return (await db.member.count({ take: 1 })) > 0;
  } catch {
    return false;
  }
}

const SEX: Record<string, string> = { M: "ชาย", F: "หญิง" };

type MemberRow = {
  membNo: string;
  name: string;
  deptName: string;
  memberType: string;
  isStaff: boolean;
  sex: string;
  ageGroup: string;
  phoneHashes: string[];
};

function toMember(m: MemberRow): Member {
  return {
    membNo: m.membNo,
    name: m.name,
    phone: null,
    department: m.deptName || null,
    // ชื่อช่องตรงกับ PROFILE_DIMS ใน surveyReport.ts และ isStaff ใน surveyDraw.ts
    profile: {
      gender: SEX[m.sex] ?? "",
      ageRange: m.ageGroup,
      memberType: m.memberType,
      isStaff: m.isStaff,
    },
  };
}

/** ค้นจากเลขสมาชิก — ใช้ฝั่งเซิร์ฟเวอร์เท่านั้น (หลังยืนยันตัวตน · ตรวจซ้ำ · เจ้าหน้าที่ผูกให้) */
export async function lookupMember(membNo: string): Promise<LookupResult> {
  if (!(await memberSourceReady())) return { ok: false, reason: "unavailable" };
  const row = await db.member.findUnique({ where: { key: membKey(membNo) } });
  return row ? { ok: true, member: toMember(row) } : { ok: false, reason: "notfound" };
}

/** ค้นจากเบอร์ (HMAC) — เฉพาะหลังบ้าน ให้เจ้าหน้าที่หาคนตอนแก้คำตอบ */
export async function lookupByPhone(phone: string): Promise<LookupResult> {
  const hash = phoneHash(phone);
  if (!hash || !(await memberSourceReady())) return { ok: false, reason: "unavailable" };
  const row = await db.member.findFirst({ where: { phoneHashes: { has: hash } } });
  return row ? { ok: true, member: toMember(row) } : { ok: false, reason: "notfound" };
}

export type CheckResult =
  | { ok: true; member: Member }
  | { ok: false; reason: "unavailable" }
  /** notfound = ไม่มีเลขนี้ (ไม่ใช่สมาชิกปัจจุบัน) · mismatch = มีเลข แต่เบอร์ไม่ตรง — ใช้ในหมายเหตุหลังบ้านเท่านั้น
   *  ⚠️ ห้ามบอกสมาชิกว่าผิดช่องไหน (สเปก sync-agent ข้อ 6) */
  | { ok: false; reason: "notfound" | "mismatch" };

/** ยืนยันตัวตน = เลขสมาชิกคู่กับ HMAC ของเบอร์ ต้องตรงทั้งคู่ */
export async function checkMember(membNo: string, phoneHashHex: string): Promise<CheckResult> {
  if (!(await memberSourceReady())) return { ok: false, reason: "unavailable" };
  const row = await db.member.findUnique({ where: { key: membKey(membNo) } });
  if (!row) return { ok: false, reason: "notfound" };
  if (!row.phoneHashes.includes(phoneHashHex)) return { ok: false, reason: "mismatch" };
  return { ok: true, member: toMember(row) };
}

/* ------------------------------------------------------------- ปิดบังชื่อ */

const TITLES = ["นางสาว", "น.ส.", "นาย", "นาง", "ด.ช.", "ด.ญ.", "ว่าที่ร้อยตรี", "ว่าที่ ร.ต."];

/** แบ่งเป็นตัวอักษรที่คนเห็น — สระบน/ล่าง/วรรณยุกต์ไม่หลุดออกจากพยัญชนะตัวหน้า */
function graphemes(text: string): string[] {
  const seg = new Intl.Segmenter("th", { granularity: "grapheme" });
  return Array.from(seg.segment(text), (s) => s.segment);
}

const hide = (word: string) => {
  const chars = graphemes(word);
  return chars.length <= 2 ? `${chars[0] ?? ""}***` : `${chars.slice(0, 2).join("")}***`;
};

/**
 * "นายไพฑูรย์ ผิวทอง" → "นาย ไพ*** ผิว***"  (2 ตัวอักษรที่ตาเห็น — "ผิ" นับเป็นตัวเดียว)
 * โชว์ได้เฉพาะหลังยืนยันเลขสมาชิก + เบอร์ผ่านแล้ว
 */
export function maskName(full: string): string {
  let rest = full.trim();
  const title = TITLES.find((t) => rest.startsWith(t)) ?? "";
  rest = rest.slice(title.length).trim();
  const words = rest.split(/\s+/).filter(Boolean);
  return [title, ...words.map(hide)].filter(Boolean).join(" ");
}

/** "07337" → "07**7" — เห็นต้นกับท้ายพอให้เจ้าตัวจำได้ */
export function maskMembNo(membNo: string): string {
  const s = membNo.trim();
  if (s.length <= 3) return `${"*".repeat(Math.max(s.length - 1, 1))}${s.slice(-1)}`;
  return `${s.slice(0, 2)}${"*".repeat(s.length - 3)}${s.slice(-1)}`;
}
