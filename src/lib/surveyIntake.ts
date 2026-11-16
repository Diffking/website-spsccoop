import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { maskPhone, normalizePhone, phoneHash, readMembNo } from "@/lib/memberLookup";
import { publicSurvey, NOT_OPEN } from "@/lib/surveyPublic";
import { surveyStatus } from "@/lib/survey";
import { checkAnswers } from "@/lib/surveyAnswers";
import { verifyResponses } from "@/lib/surveyVerify";
import { createHash } from "node:crypto";
import { MIN_FILL_MS, POW_BITS, PROOF_MAX_AGE_MS, challengeOf, leadingZeroBits, readProof } from "@/lib/surveyBot";

/** ชื่อ-สกุลที่สมาชิกพิมพ์เอง — ต้องมีตัวอักษร ไม่มีลิงก์ ไม่ยาวเกิน */
function readSelfName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.replace(/\s+/g, " ").trim();
  if (name.length < 3 || name.length > 120) return null;
  if (!/[\u0E00-\u0E7Fa-zA-Z]/.test(name)) return null;
  if (/https?:|www\.|[<>{}]/i.test(name)) return null;
  return name;
}

/**
 * แบบ "ระบุตัวตนเอง" — เลขสมาชิก + ชื่อที่พิมพ์มา ไม่เทียบทะเบียน (เจ้าของเว็บกำหนด 16 พ.ย. 2569)
 * ผ่านด่านกันบอทครบ 3 ชั้นก่อนลงฐาน (ชั้นที่ 4 จำกัดต่อไอพีอยู่ที่ route) · ดู src/lib/surveyBot.ts
 * ⚠️ บอทไม่ผ่านตอบ 400 (ไม่ใช่ 5xx) — ของที่ดึงจาก Worker จะถูกเก็บเป็นรายการเสีย ไม่วนส่งซ้ำ
 */
async function acceptSelf(
  survey: { id: string; items: Parameters<typeof checkAnswers>[0] },
  code: string,
  body: Record<string, unknown>,
  submittedAt: Date,
  queueId: string | null,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const membNo = readMembNo(body.membNo);
  const name = readSelfName(body.name);
  if (!membNo || !name) {
    return { status: 400, body: { error: "กรุณากรอกเลขที่สมาชิก (ตัวเลข) และชื่อ-นามสกุลให้ครบ" } };
  }

  const proof = readProof(body.bot);
  const bot = { status: 400, body: { error: "ระบบตรวจสอบความปลอดภัยไม่ผ่าน กรุณาโหลดหน้าใหม่แล้วลองอีกครั้ง" } };
  if (!proof || proof.hp !== "") return bot;
  const sent = submittedAt.getTime();
  if (proof.ts > sent + 5 * 60_000 || sent - proof.ts > PROOF_MAX_AGE_MS) return bot;
  if (proof.ts - proof.startedAt < MIN_FILL_MS) return bot;
  const digest = createHash("sha256").update(`${challengeOf(code, membNo, proof.ts)}|${proof.nonce}`).digest();
  if (leadingZeroBits(new Uint8Array(digest)) < POW_BITS) return bot;

  const { answers, missing } = checkAnswers(survey.items, body.answers);
  if (missing.length) {
    return { status: 400, body: { error: `ยังตอบไม่ครบ ${missing.length} ข้อ`, missing } };
  }

  try {
    await db.surveyResponse.create({
      data: {
        surveyId: survey.id,
        membNo,
        name,
        answers: answers as Prisma.InputJsonValue,
        submittedAt,
        source: queueId ? "queued" : "live",
        queueId,
        claimedMembNo: membNo,
        claimedName: name,
        // ไม่มีอะไรให้เทียบ — นับใช้ได้เลย ตัวตรวจทะเบียนข้ามแบบ self ทั้งชุด (surveyVerify.ts)
        status: "verified",
        statusNote: "สมาชิกระบุตัวตนเอง (ไม่ได้เทียบทะเบียน)",
        checkedAt: new Date(),
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const target = JSON.stringify(e.meta?.target ?? "");
      if (target.includes("queueId")) return { status: 200, body: { ok: true, duplicate: true } };
      return {
        status: 409,
        body: {
          error: "เลขที่สมาชิกนี้ส่งคำทักท้วงไปแล้ว · หากไม่ได้ส่งเอง กรุณาติดต่อสหกรณ์",
          already: true,
        },
      };
    }
    throw e;
  }
  return { status: 200, body: { ok: true } };
}

/**
 * รับคำตอบแบบ "ฝากไว้ ตรวจทีหลัง" หนึ่งรายการ — ใช้ร่วมกันสองทาง
 *   1. POST /api/survey/<code>/queue/ — เบราว์เซอร์ส่งตรง (เครื่องเปิด แต่ทะเบียนสมาชิกไม่พร้อม)
 *   2. POST /api/survey/pull/ — ดึงของที่ Cloudflare Worker พักไว้ตอนเครื่องปิด (src/lib/surveyEdge.ts)
 *
 * body = { membNo, phone, answers } — เลขสมาชิกคู่กับเบอร์ เหมือนตอนยืนยันสด (สเปก sync-agent)
 * เบอร์ไม่เก็บตัวเต็ม: เก็บ HMAC ไว้เทียบ + แบบปิดบังไว้ให้เจ้าหน้าที่ดู
 *
 * คืน { status, body } ตามความหมายเดียวกับ HTTP:
 *   2xx = รับแล้ว (หรือเคยรับแล้ว) · 4xx = รายการเสีย ส่งซ้ำก็ไม่ผ่าน · ห้ามคืน 5xx กับของแบบนั้น
 *   5xx = ฝั่งเราไม่พร้อม (ยังไม่ได้ตั้ง EVAL_PHONE_PEPPER) — ตัวดึงจาก Worker เก็บไว้ลองรอบหน้า
 */
export async function acceptQueued(
  code: string,
  body: Record<string, unknown>,
  opts: { submittedAt?: Date; queueId?: string | null } = {},
): Promise<{ status: number; body: Record<string, unknown> }> {
  const survey = await publicSurvey(code);
  if (!survey) return { status: 404, body: { error: "ไม่พบแบบประเมินนี้" } };

  const submittedAt = opts.submittedAt ?? new Date();
  const statusThen = surveyStatus(
    { published: true, opensAt: survey.opensAt, closesAt: survey.closesAt, closedAt: survey.closedAt },
    submittedAt.getTime(),
  );
  if (statusThen !== "open") {
    return { status: 409, body: { error: NOT_OPEN[statusThen as "scheduled" | "closed"] } };
  }

  if (survey.identityMode === "self") {
    return acceptSelf(survey, code, body, submittedAt, opts.queueId ?? null);
  }

  const membNo = readMembNo(body.membNo);
  const phone = normalizePhone(body.phone);
  if (!membNo || !phone) {
    return { status: 400, body: { error: "กรุณากรอกเลขที่สมาชิกและเบอร์มือถือ 10 หลักให้ครบ" } };
  }
  const hash = phoneHash(phone);
  if (!hash) return { status: 503, body: { error: "ระบบรับคำตอบยังไม่พร้อม กรุณาลองใหม่ภายหลัง" } };

  const { answers, missing } = checkAnswers(survey.items, body.answers);
  if (missing.length) {
    return { status: 400, body: { error: `ยังตอบไม่ครบ ${missing.length} ข้อ`, missing } };
  }

  try {
    await db.surveyResponse.create({
      data: {
        surveyId: survey.id,
        answers: answers as Prisma.InputJsonValue,
        submittedAt,
        source: "queued",
        queueId: opts.queueId ?? null,
        claimedMembNo: membNo,
        claimedPhone: maskPhone(phone),
        claimedPhoneHash: hash,
        status: "pending",
      },
    });
  } catch (e) {
    // รายการเดิมถูกส่งซ้ำ (ครั้งก่อนบันทึกแล้วแต่คำตอบหายกลางทาง) — ถือว่าสำเร็จ ให้ลบออกจากกล่องได้
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { status: 200, body: { ok: true, duplicate: true } };
    }
    throw e;
  }

  // ลองตรวจทันที — ทะเบียนไม่พร้อมก็แค่ค้างไว้ ไม่ทำให้การรับคำตอบล้ม
  await verifyResponses({ surveyId: survey.id }).catch((e) => console.error("ตรวจคำตอบไม่สำเร็จ:", e));
  return { status: 200, body: { ok: true, queued: true } };
}
