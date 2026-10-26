import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { maskPhone, normalizePhone, phoneHash, readMembNo } from "@/lib/memberLookup";
import { publicSurvey, NOT_OPEN } from "@/lib/surveyPublic";
import { surveyStatus } from "@/lib/survey";
import { checkAnswers } from "@/lib/surveyAnswers";
import { verifyResponses } from "@/lib/surveyVerify";

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
