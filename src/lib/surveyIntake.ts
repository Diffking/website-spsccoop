import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { readIdentifier } from "@/lib/memberLookup";
import { publicSurvey, NOT_OPEN } from "@/lib/surveyPublic";
import { surveyStatus } from "@/lib/survey";
import { checkAnswers } from "@/lib/surveyAnswers";
import { verifyResponses } from "@/lib/surveyVerify";

/**
 * รับคำตอบแบบ "ฝากไว้ ตรวจทีหลัง" หนึ่งรายการ — ใช้ร่วมกันสองทาง
 *   1. POST /api/survey/<code>/queue/ — เบราว์เซอร์ส่งตรง (เครื่องเปิด แต่ฐานสมาชิกไม่พร้อม)
 *   2. POST /api/survey/pull/ — ดึงของที่ Cloudflare Worker พักไว้ตอนเครื่องปิด (src/lib/surveyEdge.ts)
 *
 * คืน { status, body } ตามความหมายเดียวกับ HTTP:
 *   2xx = รับแล้ว (หรือเคยรับแล้ว) · 4xx = รายการเสีย ส่งซ้ำก็ไม่ผ่าน · ห้ามคืน 5xx กับของแบบนั้น
 *   (ตัวดึงจาก Worker ใช้ตัดสินว่าจะลบออกจากกล่อง / เก็บเป็นรายการเสีย / ลองใหม่)
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

  const phone = typeof body.phone === "string" ? body.phone : "";
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 200) : "";
  const id = readIdentifier(phone);
  if (!id || !name) {
    return { status: 400, body: { error: "กรุณากรอกเบอร์มือถือ (หรือเลขที่สมาชิก) และชื่อ-สกุล" } };
  }

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
        claimedPhone: id.value,
        claimedName: name,
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

  // ลองตรวจทันที — ฐานไม่พร้อมก็แค่ค้างไว้ ไม่ทำให้การรับคำตอบล้ม
  await verifyResponses({ surveyId: survey.id }).catch((e) => console.error("ตรวจคำตอบไม่สำเร็จ:", e));
  return { status: 200, body: { ok: true, queued: true } };
}
