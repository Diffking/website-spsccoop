import { createHash, randomInt } from "node:crypto";
import { db } from "@/lib/db";
import { memberSourceReady } from "@/lib/memberLookup";
import { surveyStatus } from "@/lib/survey";

/**
 * จับรางวัลจากผู้ตอบแบบประเมิน — เฟส 6 (ตกลงกับเจ้าของเว็บ 26 ต.ค. 2569)
 *
 * ผู้มีสิทธิ์ = คำตอบ "ตรวจแล้ว" · ไม่ใช่เจ้าหน้าที่ · ยังไม่เคยถูกจับได้ (รวมคนที่สละสิทธิ์)
 * จับได้เมื่อ: ปิดรับแล้ว · ไม่มีรายการรอตรวจ/ให้เจ้าหน้าที่ดูค้าง
 *
 * สุ่มด้วย crypto.randomInt (ตัวสุ่มระดับเข้ารหัส) บนเซิร์ฟเวอร์ ทุกคนโอกาสเท่ากันเป๊ะ
 * ไม่ไล่ลำดับใด ๆ (ลำดับคนตอบ · เลขสมาชิก · หน่วยงาน) · หน้าจอแค่แสดงผล ผลตัดสินตอนกดปุ่ม
 *
 * ลายนิ้วมือรายชื่อ (poolHash) = SHA-256 ของเลขสมาชิกผู้มีสิทธิ์ทั้งหมดที่เรียงแล้ว
 * จอโชว์ก่อนกด · กดแล้วเซิร์ฟเวอร์คิดใหม่ ถ้าไม่ตรง = รายชื่อเปลี่ยนระหว่างนั้น ไม่จับให้
 */

/** พนักงานสหกรณ์ — is_staff จากทะเบียน sync-agent (ประเภท 3 และ A) ลงแถวคำตอบเป็น profile.isStaff */
export const isStaff = (profile: unknown) => (profile as Record<string, unknown> | null)?.isStaff === true;

export function poolHashOf(membNos: string[]): string {
  return createHash("sha256").update([...membNos].sort().join("\n")).digest("hex");
}

/** ลายนิ้วมือฉบับอ่านออกเสียงได้ — 12 ตัวแรก แบ่งเป็น 3 ก้อน (กรรมการจดหรือถ่ายรูปเก็บ) */
export const shortHash = (hash: string) => hash.slice(0, 12).toUpperCase().replace(/(.{4})(?=.)/g, "$1-");

/**
 * สุ่มเลือก k คนจาก n คน ไม่ซ้ำกัน — Fisher–Yates แบบสลับเฉพาะ k ตำแหน่งแรก
 * ทุกชุดของ k คนมีโอกาสเท่ากัน (crypto.randomInt ไม่มีอคติแบบ Math.random() % n)
 */
export function pickIndexes(n: number, k: number): number[] {
  const idx = Array.from({ length: n }, (_, i) => i);
  const take = Math.min(k, n);
  for (let i = 0; i < take; i++) {
    const j = randomInt(i, n);
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx.slice(0, take);
}

export type PoolMember = {
  responseId: string;
  membNo: string;
  name: string;
  phone: string | null;
  department: string | null;
};

/** สถานะทั้งหมดของการจับรางวัลหนึ่งแบบประเมิน — ใช้ทั้งหน้าจอและตอนกดจับ (คิดสดทุกครั้ง) */
export async function drawState(surveyId: string) {
  const survey = await db.survey.findUnique({ where: { id: surveyId } });
  if (!survey) return null;

  const [responses, prizes, draws, pending, review] = await Promise.all([
    db.surveyResponse.findMany({
      where: { surveyId, status: "verified", membNo: { not: null } },
      select: { id: true, membNo: true, name: true, phone: true, department: true, profile: true },
    }),
    db.surveyPrize.findMany({ where: { surveyId }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    db.surveyDraw.findMany({ where: { surveyId }, orderBy: { drawnAt: "asc" } }),
    db.surveyResponse.count({ where: { surveyId, status: "pending" } }),
    db.surveyResponse.count({ where: { surveyId, status: "review" } }),
  ]);

  // ใครเคยถูกจับได้แล้ว (รวมสละสิทธิ์) ไม่มีสิทธิ์ซ้ำ — หนึ่งคนได้รางวัลเดียว ข้ามทุกรอบ
  const drawn = new Set(draws.map((d) => d.membNo));
  let staff = 0;
  let won = 0;
  const pool: PoolMember[] = [];
  for (const r of responses) {
    if (isStaff(r.profile)) staff += 1;
    else if (drawn.has(r.membNo!)) won += 1;
    else pool.push({ responseId: r.id, membNo: r.membNo!, name: r.name ?? "", phone: r.phone, department: r.department });
  }
  // เรียงตามเลขสมาชิกให้ลำดับนิ่ง — ลำดับนี้ไม่มีผลกับโอกาส (สุ่มจากทั้งก้อน) แต่ทำให้ลายนิ้วมือคิดซ้ำได้ตรง
  pool.sort((a, b) => a.membNo.localeCompare(b.membNo));

  const status = surveyStatus(survey);
  const blockers: string[] = [];
  if (status !== "closed") blockers.push("ยังไม่ได้กด \"สิ้นสุดการประเมิน\"");
  if (pending > 0) blockers.push(`มีคำตอบรอตรวจกับทะเบียน ${pending} รายการ`);
  if (review > 0) blockers.push(`มีรายการให้เจ้าหน้าที่ดู ${review} รายการ`);
  if (!(await memberSourceReady())) blockers.push("ยังไม่ได้รับทะเบียนสมาชิกจาก sync-agent");

  // รอบ: จับไปแล้วแต่มีการเปิดรับต่อแล้วปิดใหม่ (closedAt ใหม่กว่าการจับล่าสุด) = รอบถัดไป
  const last = draws[draws.length - 1];
  const lastRound = last?.round ?? 0;
  const round = !last ? 1 : survey.closedAt && survey.closedAt > last.drawnAt ? lastRound + 1 : lastRound;

  return {
    survey,
    status,
    blockers,
    pool,
    poolHash: poolHashOf(pool.map((p) => p.membNo)),
    excluded: { staff, won },
    round,
    prizes: prizes.map((p) => {
      const got = draws.filter((d) => d.prizeId === p.id && !d.voided).length;
      return { ...p, drawn: got, remaining: Math.max(0, p.quantity - got) };
    }),
    draws,
  };
}

/** กันกดซ้อน (สองแท็บ/กดเบิ้ล) — จับได้ทีละคำขอต่อแบบประเมิน (คอนเทนเนอร์เดียว ใช้หน่วยความจำพอ) */
const running = new Set<string>();
export async function withDrawLock<T>(surveyId: string, fn: () => Promise<T>): Promise<T | "busy"> {
  if (running.has(surveyId)) return "busy";
  running.add(surveyId);
  try {
    return await fn();
  } finally {
    running.delete(surveyId);
  }
}
