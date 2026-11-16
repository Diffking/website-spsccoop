import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { MIN_FILL_MS, POW_BITS, PROOF_MAX_AGE_MS, challengeOf, leadingZeroBits, readProof } from "@/lib/botGuard";
import {
  AGENDA_COUNT,
  DETAIL_MAX,
  membKey,
  readMembNo,
  readName,
  roundStatus,
} from "@/lib/objection";
import { visitorIp } from "@/lib/surveyGuard";

/**
 * รับคำทักท้วงรายงานการประชุมใหญ่ — เปิดให้คนทั่วไปส่ง (ไม่ต้องล็อกอิน) จึงอยู่นอก /api/admin
 *
 * body = { roundId, membNo, name, items: [{ no, detail }], bot: { ts, nonce, startedAt, hp } }
 * ผ่านด่านกันบอทครบก่อนแตะฐาน (src/lib/botGuard.ts) · ส่งได้เลขที่สมาชิกละครั้งต่อรอบ
 *
 * ตอนเครื่องสำนักงานปิด คำขอผ่าน www.spsccoop.com มาไม่ถึง — ตัวมิเรอร์ตอบ 204 เปล่า
 * หน้าจอจึงบอกให้ส่งใหม่ในเวลาทำการ (ดู ObjectionForm)
 */

/** ไอพีละ 10 ครั้ง / 15 นาที — ในหน่วยความจำของโปรเซส เริ่มนับใหม่เมื่อ restart */
const WINDOW_MS = 15 * 60_000;
const hits = new Map<string, { count: number; firstAt: number }>();
function allow(ip: string): boolean {
  const now = Date.now();
  for (const [k, v] of hits) if (now - v.firstAt > WINDOW_MS) hits.delete(k);
  const rec = hits.get(ip) ?? { count: 0, firstAt: now };
  rec.count += 1;
  hits.set(ip, rec);
  return rec.count <= 10;
}

const fail = (status: number, error: string, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ error, ...extra }, { status });

export async function POST(request: Request) {
  if (!allow(visitorIp(request))) return fail(429, "ส่งหลายครั้งเกินไป กรุณารอสัก 15 นาทีแล้วลองใหม่");

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const roundId = typeof body.roundId === "string" ? body.roundId : "";
  const round = roundId ? await db.objectionRound.findUnique({ where: { id: roundId } }) : null;
  if (!round) return fail(404, "ไม่พบรอบรับคำทักท้วงนี้ กรุณาโหลดหน้าใหม่");
  const status = roundStatus(round);
  if (status !== "open") {
    return fail(409, status === "closed" ? "ปิดรับคำทักท้วงแล้ว" : "ยังไม่เปิดรับคำทักท้วง");
  }

  const membNo = readMembNo(body.membNo);
  const name = readName(body.name);
  if (!membNo || !name) return fail(400, "กรุณากรอกเลขที่สมาชิก (ตัวเลข) และชื่อ-นามสกุลให้ครบ");

  // ด่านกันบอท — ไม่ผ่านตอบข้อความเดียวกันทุกกรณี ไม่บอกว่าติดด่านไหน
  const proof = readProof(body.bot);
  const now = Date.now();
  const botFail = () => fail(400, "ระบบตรวจสอบความปลอดภัยไม่ผ่าน กรุณาโหลดหน้าใหม่แล้วลองอีกครั้ง");
  if (!proof || proof.hp !== "") return botFail();
  if (proof.ts > now + 2 * 60_000 || now - proof.ts > PROOF_MAX_AGE_MS) return botFail();
  if (proof.ts - proof.startedAt < MIN_FILL_MS) return botFail();
  const digest = createHash("sha256").update(`${challengeOf(round.id, membNo, proof.ts)}|${proof.nonce}`).digest();
  if (leadingZeroBits(new Uint8Array(digest)) < POW_BITS) return botFail();

  const raw = Array.isArray(body.items) ? body.items : [];
  const seen = new Set<number>();
  const items: { no: number; detail: string }[] = [];
  for (const o of raw) {
    const no = Number((o as { no?: unknown })?.no);
    const detail = String((o as { detail?: unknown })?.detail ?? "").trim();
    if (!Number.isInteger(no) || no < 1 || no > AGENDA_COUNT || seen.has(no)) continue;
    if (detail.length < 3) return fail(400, `กรุณาใส่รายละเอียดของระเบียบวาระที่ ${no}`, { agenda: no });
    if (detail.length > DETAIL_MAX) return fail(400, `รายละเอียดวาระที่ ${no} ยาวเกิน ${DETAIL_MAX} ตัวอักษร`, { agenda: no });
    seen.add(no);
    items.push({ no, detail });
  }
  if (items.length === 0) return fail(400, "กรุณาเลือกระเบียบวาระที่ต้องการทักท้วงอย่างน้อย 1 วาระ");
  items.sort((a, b) => a.no - b.no);

  try {
    const saved = await db.objection.create({
      data: {
        roundId: round.id,
        membNo,
        membKey: membKey(membNo),
        name,
        items: items as Prisma.InputJsonValue,
      },
    });
    return NextResponse.json({ ok: true, at: saved.createdAt.toISOString() }, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return fail(409, "เลขที่สมาชิกนี้ส่งคำทักท้วงของปีนี้ไปแล้ว · หากต้องการแก้ไขหรือไม่ได้ส่งเอง กรุณาติดต่อสหกรณ์", {
        already: true,
      });
    }
    throw e;
  }
}
