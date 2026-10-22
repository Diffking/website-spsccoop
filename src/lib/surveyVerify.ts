import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { lookupMember, memberSourceReady, readIdentifier, type Member } from "@/lib/memberLookup";

/**
 * ตรวจคำตอบกับฐานสมาชิก — ข้อมูลที่เอาไปใช้ต่อต้องตรงกับฐาน 100% (เจ้าของเว็บกำหนด 22 ต.ค. 2569)
 *
 * สถานะของคำตอบ:
 *   verified  ตรงกับฐาน — ใช้ต่อได้ (Dashboard · ส่งออก · จับรางวัล)
 *   pending   ฝากมาตอนระบบไม่พร้อม ยังไม่ได้เทียบ
 *   review    เทียบแล้วไม่ลงตัว (ชื่อไม่ตรง · ไม่พบเบอร์ · ไม่พบในฐานแล้ว) — ให้เจ้าหน้าที่ดูรายคน
 *   rejected  ไม่ผ่าน (ตอบซ้ำ · เจ้าหน้าที่ตัดทิ้ง) — เก็บไว้ตรวจย้อนได้ ไม่ใช้ต่อ
 *
 * ⚠️ ระบบไม่เคยตัดทิ้งเอง ยกเว้น "ตอบซ้ำ" ที่ชัดเจน — เคสกำกวมทุกเคสไปที่ review
 *    ให้คนตัดสิน (เจ้าของเว็บสั่ง: เจ้าหน้าที่ดูรายคน แก้ให้ตรงระบบ หรือตัดทิ้งตามสมควร)
 * ⚠️ ชื่อ · เบอร์ · หน่วยงานที่เก็บ มาจาก **ฐานสมาชิก** เสมอ ไม่ใช่ที่สมาชิกพิมพ์
 */

export type VerifyStatus = "verified" | "pending" | "review" | "rejected";

export const VERIFY_LABEL: Record<VerifyStatus, string> = {
  verified: "ตรวจแล้ว",
  pending: "รอตรวจ",
  review: "ให้เจ้าหน้าที่ดู",
  rejected: "ไม่ผ่าน",
};

const TITLES = /^(นางสาว|น\.ส\.|นาย|นาง|ด\.ช\.|ด\.ญ\.|ว่าที่\s*ร\.?\s*ต\.?|ว่าที่ร้อยตรี|ดร\.|นพ\.|พญ\.|ทพ\.|ทพญ\.|ภก\.|ภญ\.)\s*/;

/** ชื่อสำหรับเทียบ — ตัดคำนำหน้า ช่องว่าง และอักขระที่มองไม่เห็นทิ้ง */
export function nameKey(name: string): string {
  return name
    .normalize("NFC")
    .replace(/[​-‍﻿]/g, "")
    .trim()
    .replace(TITLES, "")
    .replace(/\s+/g, "");
}

export const sameName = (a: string, b: string) => nameKey(a) !== "" && nameKey(a) === nameKey(b);

/** ข้อมูลจากฐานที่ลงในแถวคำตอบตอนตรวจผ่าน */
export function memberFields(m: Member) {
  return {
    membNo: m.membNo,
    name: m.name,
    phone: m.phone,
    department: m.department,
    profile: m.profile as Prisma.InputJsonValue,
  };
}

const isUniqueClash = (e: unknown) =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";

type Row = {
  id: string;
  surveyId: string;
  membNo: string | null;
  claimedPhone: string | null;
  claimedName: string | null;
  status: string;
};

/**
 * ตรวจคำตอบที่ฝากไว้หนึ่งแถว — คืนสถานะใหม่ หรือ null ถ้าฐานสมาชิกต่อไม่ได้ (ไว้ลองรอบหน้า)
 */
async function verifyClaim(row: Row): Promise<VerifyStatus | null> {
  const id = readIdentifier(row.claimedPhone ?? "");
  const now = new Date();
  if (!id) {
    await db.surveyResponse.update({
      where: { id: row.id },
      data: { status: "review", statusNote: "เบอร์/เลขสมาชิกที่กรอกมาไม่ถูกรูปแบบ", checkedAt: now },
    });
    return "review";
  }

  const found = await lookupMember(id);
  if (!found.ok && found.reason === "unavailable") return null;
  if (!found.ok) {
    await db.surveyResponse.update({
      where: { id: row.id },
      data: {
        status: "review",
        statusNote: id.kind === "phone" ? "ไม่พบเบอร์นี้ในทะเบียนสมาชิก" : "ไม่พบเลขที่สมาชิกนี้",
        checkedAt: now,
      },
    });
    return "review";
  }

  const { member } = found;
  if (!sameName(member.name, row.claimedName ?? "")) {
    // เก็บเลขที่เจอไว้ในหมายเหตุ เจ้าหน้าที่จะได้เทียบได้ทันที — แต่ยังไม่ผูกตัวจนกว่าคนจะยืนยัน
    await db.surveyResponse.update({
      where: { id: row.id },
      data: {
        status: "review",
        statusNote: `ชื่อที่กรอกไม่ตรงกับฐาน — เบอร์นี้เป็นของสมาชิกเลขที่ ${member.membNo}`,
        checkedAt: now,
      },
    });
    return "review";
  }

  try {
    await db.surveyResponse.update({
      where: { id: row.id },
      data: { ...memberFields(member), status: "verified", statusNote: null, checkedAt: now },
    });
    return "verified";
  } catch (e) {
    if (!isUniqueClash(e)) throw e;
    // คนนี้มีคำตอบที่ใช้ได้อยู่แล้ว — เก็บอันแรก (ตามเวลาที่ส่ง) อันนี้ตอบซ้ำ
    await db.surveyResponse.update({
      where: { id: row.id },
      data: { status: "rejected", statusNote: `ตอบซ้ำ — สมาชิกเลขที่ ${member.membNo} มีคำตอบอยู่แล้ว`, checkedAt: now },
    });
    return "rejected";
  }
}

/** ตรวจซ้ำคนที่ผ่านไปแล้ว — ยังอยู่ในทะเบียนไหม (เผื่อพ้นสภาพสมาชิกระหว่างเปิดรับ) */
async function recheckVerified(row: Row): Promise<VerifyStatus | null> {
  const found = await lookupMember({ kind: "membNo", value: row.membNo ?? "" });
  if (!found.ok && found.reason === "unavailable") return null;
  const now = new Date();
  if (!found.ok) {
    await db.surveyResponse.update({
      where: { id: row.id },
      data: { status: "review", statusNote: "ตรวจซ้ำแล้วไม่พบเลขที่สมาชิกนี้ในทะเบียน", checkedAt: now },
    });
    return "review";
  }
  // ชื่อ/หน่วยงานไม่ทับ — เก็บตามวันที่ตอบ (แยกผลตามหน่วยงานต้องตรงกับตอนนั้น)
  await db.surveyResponse.update({ where: { id: row.id }, data: { checkedAt: now } });
  return "verified";
}

export type VerifyReport = {
  ready: boolean;
  checked: number;
  verified: number;
  review: number;
  rejected: number;
  /** ต่อฐานไม่ได้กลางทาง — ที่เหลือรอรอบหน้า */
  stopped: boolean;
};

/**
 * ตรวจคำตอบที่รอตรวจ (และถ้าสั่ง ตรวจซ้ำคนที่ผ่านแล้วด้วย)
 *
 * ไล่ตามเวลาที่ส่ง เก่าก่อนใหม่ — ตอบซ้ำแล้วอันแรกได้สิทธิ์เสมอ
 * ฐานสมาชิกต่อไม่ได้กลางทาง = หยุดทันที ไม่แตะแถวที่เหลือ (ไม่ตัดใครทิ้งเพราะระบบล่ม)
 */
export async function verifyResponses(opts: { surveyId?: string; recheck?: boolean } = {}): Promise<VerifyReport> {
  const report: VerifyReport = { ready: memberSourceReady(), checked: 0, verified: 0, review: 0, rejected: 0, stopped: false };
  if (!report.ready) return report;

  const statuses = opts.recheck ? ["pending", "verified"] : ["pending"];
  const rows = await db.surveyResponse.findMany({
    where: { status: { in: statuses }, ...(opts.surveyId ? { surveyId: opts.surveyId } : {}) },
    orderBy: { submittedAt: "asc" },
    select: { id: true, surveyId: true, membNo: true, claimedPhone: true, claimedName: true, status: true },
  });

  for (const row of rows) {
    const result = row.status === "verified" ? await recheckVerified(row) : await verifyClaim(row);
    if (result === null) {
      report.stopped = true;
      break;
    }
    report.checked += 1;
    if (result === "verified") report.verified += 1;
    else if (result === "review") report.review += 1;
    else if (result === "rejected") report.rejected += 1;
  }
  return report;
}

/** ตัวนับสถานะของแต่ละแบบประเมิน — โชว์ที่หัวหน้าแก้ไขกับรายการ */
export async function statusCounts(surveyIds: string[]): Promise<Record<string, Record<VerifyStatus, number>>> {
  const groups = await db.surveyResponse.groupBy({
    by: ["surveyId", "status"],
    where: { surveyId: { in: surveyIds } },
    _count: { _all: true },
  });
  const out: Record<string, Record<VerifyStatus, number>> = {};
  for (const id of surveyIds) out[id] = { verified: 0, pending: 0, review: 0, rejected: 0 };
  for (const g of groups) {
    const s = g.status as VerifyStatus;
    if (out[g.surveyId] && s in out[g.surveyId]) out[g.surveyId][s] = g._count._all;
  }
  return out;
}
