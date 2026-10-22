import { db } from "@/lib/db";
import { readItems, surveyStatus, type SurveyItem, type SurveyStatus } from "@/lib/survey";
import { noonCutoff, type ResponseForReport } from "@/lib/surveyReport";
import type { Answers } from "@/lib/surveyAnswers";

/**
 * อ่านแบบประเมิน + คำตอบที่ใช้คำนวณผล
 *
 * ⚠️ **เฉพาะ status = "verified"** — ข้อมูลที่ใช้ต่อต้องตรงกับฐานสมาชิก 100% (เจ้าของเว็บกำหนด)
 * เปิดรับอยู่ = ตัดที่เที่ยงล่าสุด (noonCutoff) · ปิดแล้ว = ทั้งหมด
 */
export async function loadReportData(surveyId: string, opts: { live?: boolean } = {}) {
  const survey = await db.survey.findUnique({ where: { id: surveyId } });
  if (!survey) return null;

  const status: SurveyStatus = surveyStatus(survey);
  const cutoff = opts.live ? null : noonCutoff(status === "open" || status === "scheduled");

  const [rows, pending, review] = await Promise.all([
    db.surveyResponse.findMany({
      where: { surveyId, status: "verified", ...(cutoff ? { submittedAt: { lte: cutoff } } : {}) },
      orderBy: { submittedAt: "asc" },
      select: { answers: true, submittedAt: true, department: true, profile: true },
    }),
    db.surveyResponse.count({ where: { surveyId, status: "pending" } }),
    db.surveyResponse.count({ where: { surveyId, status: "review" } }),
  ]);

  const responses: ResponseForReport[] = rows.map((r) => ({
    answers: (r.answers ?? {}) as Answers,
    submittedAt: r.submittedAt,
    department: r.department,
    profile: (r.profile ?? {}) as Record<string, unknown>,
  }));

  return {
    survey,
    items: readItems(survey.questions) as SurveyItem[],
    status,
    cutoff,
    responses,
    /** ยังไม่นับในผล — บอกไว้บนหัว Dashboard จะได้ไม่งงว่าทำไมตัวเลขไม่ตรงกับจำนวนคนที่ส่ง */
    excluded: { pending, review },
  };
}

/** ข้อความหัวรายงาน — "ผล ณ 22 ต.ค. 2569 เวลา 12:00 น." หรือ "ผลสุดท้าย" */
export function cutoffLabel(cutoff: Date | null): string {
  if (!cutoff) return "ผลสุดท้าย (ปิดรับคำตอบแล้ว)";
  const d = new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(cutoff);
  return `ผล ณ ${d} เวลา 12:00 น.`;
}
