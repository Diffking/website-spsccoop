import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { ADMIN_HOME, canArea } from "@/lib/permissions";
import { getBrand } from "@/lib/nav";
import { buildReport } from "@/lib/surveyReport";
import { cutoffLabel, loadReportData } from "@/lib/surveyReportData";
import SurveyReportDoc from "@/components/survey/SurveyReportDoc";
import PrintButton from "@/components/admin/PrintButton";
import type { FeedbackGroup } from "@/components/admin/SurveyCharts";

type Params = { params: Promise<{ id: string }> };

/**
 * รายงาน PDF แบบราชการ — กด "พิมพ์" แล้วเลือก "บันทึกเป็น PDF"
 * ระหว่างเปิดรับพิมพ์ได้ (ผล ณ 12:00) แต่ขึ้นแถบเตือนว่าเป็นผลระหว่างทาง · ฉบับจริงพิมพ์หลังปิด
 */
export default async function SurveyReportPage({ params }: Params) {
  const user = await currentUser();
  if (!user) redirect("/login/");
  if (!canArea(user, "surveys")) redirect(ADMIN_HOME);

  const { id } = await params;
  const data = await loadReportData(id);
  if (!data) notFound();
  const brand = await getBrand();
  const report = buildReport(data.items, data.responses);
  const feedback = (Array.isArray(data.survey.feedbackSummary) ? data.survey.feedbackSummary : []) as FeedbackGroup[];

  return (
    <main className="min-h-screen bg-gray-100 py-6 print:bg-white print:py-0">
      <style>{"@page { size: A4; margin: 15mm 15mm 18mm }"}</style>
      <div className="mx-auto mb-4 flex max-w-[210mm] flex-wrap items-center justify-between gap-2 px-4 print:hidden">
        {data.status !== "closed" ? (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-amber-200">
            ยังเปิดรับอยู่ — นี่คือผลระหว่างทาง ({cutoffLabel(data.cutoff)}) ฉบับจริงพิมพ์หลังสิ้นสุดการประเมิน
          </p>
        ) : (
          <span />
        )}
        <PrintButton />
      </div>
      <div className="mx-auto w-full max-w-[210mm] bg-white px-[15mm] py-[15mm] shadow-lg print:max-w-none print:p-0 print:shadow-none">
        <SurveyReportDoc
          coopName={brand.name}
          title={data.survey.title}
          period={cutoffLabel(data.cutoff)}
          report={report}
          feedback={feedback}
        />
      </div>
    </main>
  );
}
