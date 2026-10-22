import { db } from "@/lib/db";
import { readItems, surveyStatus, type SurveyItem, type SurveyStatus } from "@/lib/survey";

/**
 * อ่านแบบประเมินจากรหัสในลิงก์ — ใช้ร่วมกันทั้งหน้าตอบและ API สาธารณะ
 * ร่างคืน null เสมอ (ทำเหมือนไม่มีอยู่จริง ลิงก์ที่ยังไม่เผยแพร่ต้องเปิดไม่ได้)
 */
export async function publicSurvey(code: string): Promise<{
  id: string;
  title: string;
  description: string;
  items: SurveyItem[];
  status: SurveyStatus;
  opensAt: Date | null;
  closesAt: Date | null;
} | null> {
  if (!/^[a-z0-9]{4,12}$/.test(code)) return null;
  const survey = await db.survey.findUnique({ where: { code } });
  if (!survey || !survey.published) return null;
  return {
    id: survey.id,
    title: survey.title,
    description: survey.description,
    items: readItems(survey.questions),
    status: surveyStatus(survey),
    opensAt: survey.opensAt,
    closesAt: survey.closesAt,
  };
}

/** ข้อความเมื่อตอบไม่ได้ — ใช้ทั้งหน้าจอและ API ให้พูดเหมือนกัน */
export const NOT_OPEN: Record<Exclude<SurveyStatus, "open" | "draft">, string> = {
  scheduled: "แบบประเมินนี้ยังไม่เปิดรับคำตอบ",
  closed: "แบบประเมินนี้ปิดรับคำตอบแล้ว ขอบคุณที่ให้ความสนใจ",
};
