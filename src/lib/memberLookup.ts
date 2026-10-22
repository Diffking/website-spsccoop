import { readFile } from "node:fs/promises";

/**
 * ค้นสมาชิกจากเบอร์มือถือหรือเลขที่สมาชิก — ใช้ยืนยันตัวตนก่อนตอบแบบประเมิน
 *
 * ต้นทางจริงคือฐานทะเบียนสมาชิก SQL Server ที่ 192.168.100.200 (ODBC DSN "coop")
 * — **ยังไม่ได้ต่อ** รอรหัสผ่านกับชื่อตารางจากเจ้าของเว็บ (เฟส 1 ของงานแบบประเมิน)
 * ทุกอย่างที่เรียกใช้ผ่านไฟล์นี้ทางเดียว พอต่อฐานจริงแล้วแก้ที่นี่ที่เดียว
 *
 * ⚠️ **ยังไม่มีต้นทาง = ปฏิเสธเสมอ (fail closed)** ห้ามเปลี่ยนเป็น "ให้ผ่านไปก่อน"
 * ไม่งั้นใครก็ตอบแทนใครได้ แล้วไปมีชื่อในรายชื่อจับรางวัล
 *
 * MEMBER_MOCK_FILE = ไฟล์ JSON รายชื่อสมาชิกสมมุติ ใช้ทดสอบบนเครื่องเท่านั้น
 * ⚠️ **ห้ามใส่ใน .env** — คอนเทนเนอร์เว็บจริงอ่าน .env ด้วย ใส่แล้วเว็บจริงจะเชื่อรายชื่อปลอม
 * ตั้งตอนสั่งรันเฉพาะครั้งนั้นแทน เช่น `MEMBER_MOCK_FILE=... npx next start`
 */

export type Member = {
  membNo: string;
  /** ชื่อเต็มพร้อมคำนำหน้า เช่น "นายไพฑูรย์ ผิวทอง" */
  name: string;
  phone: string | null;
  department: string | null;
  /** เพศ · ช่วงอายุ · ประเภทสมาชิก · เป็นเจ้าหน้าที่ — รูปร่างจริงกำหนดตอนต่อฐาน (เฟส 1) */
  profile: Record<string, unknown>;
};

export type LookupResult =
  | { ok: true; member: Member }
  | { ok: false; reason: "notfound" | "unavailable" };

/** แยกว่าที่พิมพ์มาเป็นเบอร์มือถือหรือเลขที่สมาชิก */
export function readIdentifier(raw: string): { kind: "phone" | "membNo"; value: string } | null {
  const digits = raw.replace(/\D/g, "");
  if (/^0[689]\d{8}$/.test(digits)) return { kind: "phone", value: digits };
  // เลขที่สมาชิกเป็นตัวเลขล้วน ยาวไม่เกิน 8 หลัก (เช่น 07337) — ยาวกว่านั้นไม่ใช่ทั้งสองอย่าง
  if (/^\d{1,8}$/.test(digits)) return { kind: "membNo", value: digits };
  return null;
}

/** มีต้นทางให้ค้นไหม — ไม่มี = หน้าตอบปิดขั้นยืนยันตัวตนไว้ ขึ้นข้อความว่ายังไม่พร้อม */
export function memberSourceReady(): boolean {
  return Boolean(process.env.MEMBER_MOCK_FILE);
}

/** เลขสมาชิกเทียบแบบไม่สนเลข 0 นำหน้า — "7337" กับ "07337" คือคนเดียวกัน */
const sameMembNo = (a: string, b: string) => a.replace(/^0+/, "") === b.replace(/^0+/, "");

async function fromMockFile(id: { kind: "phone" | "membNo"; value: string }): Promise<LookupResult> {
  try {
    const list = JSON.parse(await readFile(process.env.MEMBER_MOCK_FILE!, "utf-8")) as Member[];
    const hit = list.find((m) =>
      id.kind === "phone" ? (m.phone ?? "").replace(/\D/g, "") === id.value : sameMembNo(m.membNo, id.value),
    );
    return hit ? { ok: true, member: { ...hit, profile: hit.profile ?? {} } } : { ok: false, reason: "notfound" };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

export async function lookupMember(id: { kind: "phone" | "membNo"; value: string }): Promise<LookupResult> {
  if (process.env.MEMBER_MOCK_FILE) return fromMockFile(id);
  // TODO เฟส 1: ค้นจาก SQL Server 192.168.100.200 (อ่านอย่างเดียว)
  return { ok: false, reason: "unavailable" };
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
 *
 * พอให้เจ้าตัวจำได้ว่าใช่ตัวเอง แต่คนที่ไล่สุ่มเบอร์ไม่ได้ชื่อเต็มของใครไป
 * (ถ้าโชว์ชื่อเต็ม ช่องนี้จะกลายเป็นเครื่องมือค้นชื่อสมาชิกจากเบอร์โทรทันที)
 */
export function maskName(full: string): string {
  let rest = full.trim();
  const title = TITLES.find((t) => rest.startsWith(t)) ?? "";
  rest = rest.slice(title.length).trim();
  const words = rest.split(/\s+/).filter(Boolean);
  return [title, ...words.map(hide)].filter(Boolean).join(" ");
}
