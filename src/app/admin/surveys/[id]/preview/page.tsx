import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { ADMIN_HOME, canArea } from "@/lib/permissions";
import { db } from "@/lib/db";
import { readItems } from "@/lib/survey";
import SurveyForm from "@/components/survey/SurveyForm";

type Params = { params: Promise<{ id: string }> };

/**
 * ดูตัวอย่างหน้าตอบ — เห็นแบบที่สมาชิกเห็น แม้ยังเป็นร่าง
 * ข้ามขั้นยืนยันตัวตน และกดส่งจริงไม่ได้ (ไม่มีคำตอบทดสอบหลุดเข้าผลสรุป)
 * แสดงตามที่ "บันทึกแล้ว" — แก้ค้างไว้ยังไม่กดบันทึก จะยังไม่เห็นในหน้านี้
 */
export default async function SurveyPreviewPage({ params }: Params) {
  const user = await currentUser();
  if (!user) redirect("/login/");
  if (!canArea(user, "surveys")) redirect(ADMIN_HOME);

  const { id } = await params;
  const survey = await db.survey.findUnique({ where: { id } });
  if (!survey) notFound();

  return (
    <main className="min-h-screen bg-sky-soft">
      <div className="mx-auto max-w-2xl px-4 py-5">
        <SurveyForm
          code={survey.code}
          title={survey.title}
          description={survey.description}
          items={readItems(survey.questions).filter((i) => !i.hidden)}
          preview
        />
      </div>
    </main>
  );
}
