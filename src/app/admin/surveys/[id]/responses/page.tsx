import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { ADMIN_HOME, canArea } from "@/lib/permissions";
import { db } from "@/lib/db";
import { memberSourceReady } from "@/lib/memberLookup";
import { statusCounts } from "@/lib/surveyVerify";
import SurveyResponsesManager from "@/components/admin/SurveyResponsesManager";

type Params = { params: Promise<{ id: string }> };

/**
 * ผู้ตอบแบบประเมิน — ดูสถานะการตรวจรายคน และให้เจ้าหน้าที่แก้/ตัดรายการที่ระบบตรวจไม่ลงตัว
 * มีข้อมูลส่วนบุคคลเต็ม (ชื่อ เบอร์ หน่วยงาน) เปิดได้เฉพาะคนที่ดูแลแบบประเมิน
 */
export default async function SurveyResponsesPage({ params }: Params) {
  const user = await currentUser();
  if (!user) redirect("/login/");
  if (!canArea(user, "surveys")) redirect(ADMIN_HOME);

  const { id } = await params;
  const survey = await db.survey.findUnique({ where: { id }, select: { id: true, title: true } });
  if (!survey) notFound();

  const [rows, counts] = await Promise.all([
    db.surveyResponse.findMany({
      where: { surveyId: id },
      orderBy: { submittedAt: "desc" },
      select: {
        id: true,
        membNo: true,
        name: true,
        phone: true,
        department: true,
        submittedAt: true,
        source: true,
        claimedMembNo: true,
        claimedPhone: true,
        claimedName: true,
        status: true,
        statusNote: true,
        checkedAt: true,
        reviewedByName: true,
        reviewedAt: true,
      },
    }),
    statusCounts([id]),
  ]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <SurveyResponsesManager
        surveyId={survey.id}
        title={survey.title}
        sourceReady={await memberSourceReady()}
        counts={counts[id]}
        rows={rows.map((r) => ({
          ...r,
          submittedAt: r.submittedAt.toISOString(),
          checkedAt: r.checkedAt?.toISOString() ?? null,
          reviewedAt: r.reviewedAt?.toISOString() ?? null,
        }))}
      />
    </main>
  );
}
