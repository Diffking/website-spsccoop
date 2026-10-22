import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { ADMIN_HOME, canArea } from "@/lib/permissions";
import { db } from "@/lib/db";
import { readItems, surveyStatus, surveyUrl } from "@/lib/survey";
import { TEMPLATES } from "@/lib/surveyTemplates";
import SurveysList from "@/components/admin/SurveysList";

export default async function AdminSurveysPage() {
  const user = await currentUser();
  if (!user) redirect("/login/");
  // ไม่ได้ดูแลส่วนนี้ก็ไม่ต้องเห็น — เมนูซ่อนให้แล้ว ตรงนี้กันคนพิมพ์ที่อยู่เข้ามาเอง
  if (!canArea(user, "surveys")) redirect(ADMIN_HOME);

  const surveys = await db.survey.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { responses: true } } },
  });

  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="mb-1 text-xl font-bold text-gray-800">แบบประเมิน</h1>
      <p className="mb-5 text-sm text-gray-500">
        ตั้งคำถามความพึงพอใจ แล้วส่งลิงก์ให้สมาชิกตอบ · สมาชิกยืนยันตัวตนด้วยเบอร์มือถือหรือเลขที่สมาชิกก่อนตอบ
      </p>

      <SurveysList
        templates={TEMPLATES.map((t) => ({ key: t.key, label: t.label, hint: t.hint }))}
        items={surveys.map((s) => ({
          id: s.id,
          title: s.title,
          url: surveyUrl(s.code, process.env.SURVEY_PUBLIC_URL),
          status: surveyStatus(s),
          opensAt: s.opensAt?.toISOString() ?? null,
          closesAt: s.closesAt?.toISOString() ?? null,
          closedAt: s.closedAt?.toISOString() ?? null,
          questions: readItems(s.questions).filter((q) => q.kind !== "section" && !q.hidden).length,
          responses: s._count.responses,
        }))}
      />
    </main>
  );
}
