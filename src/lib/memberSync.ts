import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { membKey } from "@/lib/memberLookup";

/**
 * รับทะเบียนสมาชิกที่ sync-agent ส่งมา (สเปก docs/EVAL_RECEIVER.md ของผู้ดูแล sync-agent)
 *
 *   ลายเซ็น: X-Eval-Signature = hex(HMAC-SHA256(EVAL_API_KEY, "<X-Eval-Timestamp>." + raw body))
 *   ⚠️ คำนวณจาก raw body ที่ได้รับ ห้าม parse แล้ว encode ใหม่ · เทียบแบบ constant-time · เวลาห่างได้ไม่เกิน 300 วิ
 *   ⚠️ ไม่ผ่าน = 401 และห้าม log body
 *
 *   ผ่าน → แทนที่ทั้งชุดใน transaction เดียว (คนพ้นสภาพหายเอง)
 *   row_count ไม่ตรง / น้อยกว่า MIN_ROWS = ปฏิเสธด้วย 4xx (ไม่ใช่ 5xx — ไม่งั้น sync-agent ส่งซ้ำทุก 5 นาทีเปล่า ๆ)
 *
 * สถานะรอบล่าสุดเก็บใน Setting["memberSync"] ให้หลังบ้านโชว์ว่าทะเบียนสดแค่ไหน
 */

/** น้อยกว่านี้ถือว่าผิดปกติ (sync-agent ดึงทะเบียนมาไม่ครบ) ไม่ทับของเดิม — สมาชิกจริงราว 5,800 คน */
export const MIN_ROWS = 5000;
const MAX_SKEW = 300;
const HEX64 = /^[0-9a-f]{64}$/;

export type SyncState = {
  receivedAt: string;
  generatedAt: string;
  rowCount: number;
  skipped: number;
};

/** ตรวจลายเซ็น — คืน true เมื่อผ่านทุกข้อ */
export function signatureOk(ts: string | null, sig: string | null, raw: Buffer): boolean {
  const key = process.env.EVAL_API_KEY;
  if (!key || !ts || !sig || !/^\d{1,12}$/.test(ts)) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > MAX_SKEW) return false;
  const expected = createHmac("sha256", key).update(`${ts}.`).update(raw).digest();
  const given = /^[0-9a-fA-F]{64}$/.test(sig) ? Buffer.from(sig, "hex") : null;
  return given !== null && given.length === expected.length && timingSafeEqual(given, expected);
}

const str = (v: unknown, max = 300) => (typeof v === "string" ? v.trim().slice(0, max) : "");

type Row = {
  key: string;
  membNo: string;
  name: string;
  deptCode: string;
  deptName: string;
  memberTypeCode: string;
  memberType: string;
  isStaff: boolean;
  sex: string;
  ageGroup: string;
  phoneHashes: string[];
};

/** อ่านแถวหนึ่ง — ไม่มีเลขสมาชิก/ชื่อ = ข้าม */
function readRow(raw: unknown): Row | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const membNo = str(r.memb_no, 20);
  const name = str(r.full_name, 200);
  if (!/^\d{1,8}$/.test(membNo) || !name) return null;
  const sex = str(r.sex, 1).toUpperCase();
  return {
    key: membKey(membNo),
    membNo,
    name,
    deptCode: str(r.dept_code, 40),
    deptName: str(r.dept_name, 200),
    memberTypeCode: str(r.member_type_code, 20),
    memberType: str(r.member_type, 100),
    isStaff: r.is_staff === true,
    sex: sex === "M" || sex === "F" ? sex : "",
    ageGroup: str(r.age_group, 10),
    phoneHashes: Array.isArray(r.phone_hashes)
      ? [...new Set(r.phone_hashes.map((h) => str(h, 64).toLowerCase()).filter((h) => HEX64.test(h)))].slice(0, 4)
      : [],
  };
}

export type ImportResult = { status: number; body: Record<string, unknown> };

/** อ่าน body ที่ผ่านลายเซ็นแล้ว ตรวจรูปร่าง แล้วแทนที่ทั้งชุด */
export async function importMembers(raw: Buffer): Promise<ImportResult> {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw.toString("utf-8")) as Record<string, unknown>;
  } catch {
    return { status: 400, body: { error: "body ไม่ใช่ JSON" } };
  }
  if (data.service !== "CoopEvalMembers" || data.version !== 1 || !Array.isArray(data.rows)) {
    return { status: 422, body: { error: "รูปแบบข้อมูลไม่ตรงกับ CoopEvalMembers v1" } };
  }
  if (data.row_count !== data.rows.length) {
    return { status: 422, body: { error: `row_count (${String(data.row_count)}) ไม่เท่ากับจำนวน rows (${data.rows.length})` } };
  }

  // เลขซ้ำในชุดเดียวกัน — เก็บแถวแรก
  const rows = new Map<string, Row>();
  let skipped = 0;
  for (const item of data.rows) {
    const row = readRow(item);
    if (!row || rows.has(row.key)) skipped += 1;
    else rows.set(row.key, row);
  }
  if (rows.size < MIN_ROWS) {
    return { status: 422, body: { error: `สมาชิกที่อ่านได้ ${rows.size} คน น้อยกว่า ${MIN_ROWS} — ไม่ทับชุดเดิม` } };
  }

  const state: SyncState = {
    receivedAt: new Date().toISOString(),
    generatedAt: str(data.generated_at, 40),
    rowCount: rows.size,
    skipped,
  };
  const list = [...rows.values()];
  await db.$transaction(
    async (tx) => {
      await tx.member.deleteMany({});
      for (let i = 0; i < list.length; i += 1000) await tx.member.createMany({ data: list.slice(i, i + 1000) });
      await tx.setting.upsert({
        where: { key: "memberSync" },
        create: { key: "memberSync", value: state },
        update: { value: state },
      });
    },
    { timeout: 60_000 },
  );
  return { status: 200, body: { ok: true, rows: rows.size, skipped } };
}

/** สถานะรอบล่าสุด + จำนวนในตาราง — ไว้โชว์ในหลังบ้าน */
export async function syncStatus(): Promise<{ state: SyncState | null; count: number; configured: boolean; stale: boolean }> {
  const [setting, count] = await Promise.all([
    db.setting.findUnique({ where: { key: "memberSync" } }),
    db.member.count(),
  ]);
  const state = (setting?.value as SyncState | undefined) ?? null;
  const received = state ? new Date(state.receivedAt).getTime() : 0;
  return {
    state,
    count,
    configured: Boolean(process.env.EVAL_API_KEY && process.env.EVAL_PHONE_PEPPER),
    // รอบส่งวันละ 2 ครั้ง — เกิน 3 วันไม่มีของใหม่ (เผื่อเสาร์อาทิตย์ที่เครื่องปิด) = sync-agent น่าจะหยุดส่ง
    stale: !received || Date.now() - received > 3 * 86400_000,
  };
}

/** จบการประเมินแล้ว — ลบทะเบียนทั้งชุด (สเปกข้อ 5) · คำตอบที่ตรวจแล้วเก็บข้อมูลของตัวเองไว้ ไม่กระทบ */
export async function clearMembers(): Promise<number> {
  const { count } = await db.member.deleteMany({});
  await db.setting.deleteMany({ where: { key: "memberSync" } });
  return count;
}
