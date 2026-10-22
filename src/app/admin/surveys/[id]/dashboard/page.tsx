import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Download, FileText, Info, Users } from "lucide-react";
import { currentUser } from "@/lib/auth";
import { ADMIN_HOME, canArea } from "@/lib/permissions";
import { STATUS_LABEL, shareUrl } from "@/lib/survey";
import { AI_READY } from "@/lib/ai";
import { applyFilters, breakdown, buildReport, dimensions } from "@/lib/surveyReport";
import { cutoffLabel, loadReportData } from "@/lib/surveyReportData";
import {
  BreakdownTable,
  DailyBars,
  ItemCard,
  KpiTiles,
  MeanBars,
  type FeedbackGroup,
} from "@/components/admin/SurveyCharts";
import { BreakdownPicker, FeedbackEditor, FilterBar, SharePanel } from "@/components/admin/SurveyDashboardControls";
import { STATUS_TONE } from "@/components/admin/SurveysList";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const card = "rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5";

/**
 * Dashboard สรุปผลแบบประเมิน — ไฮไลต์ที่เจ้าของเว็บย้ำ (22 ต.ค. 2569)
 *
 * ใช้เฉพาะคำตอบ "ตรวจแล้ว" · ระหว่างเปิดรับ = ผล ณ 12:00 ล่าสุด · ปิดแล้ว = ผลสุดท้าย
 * ตัวกรองอยู่ใน URL (?f.<มิติ>=ค่า) — หน้าคิดใหม่ฝั่งเซิร์ฟเวอร์ทุกครั้ง
 */
export default async function SurveyDashboardPage({ params, searchParams }: Props) {
  const user = await currentUser();
  if (!user) redirect("/login/");
  if (!canArea(user, "surveys")) redirect(ADMIN_HOME);

  const { id } = await params;
  const sp = await searchParams;
  const data = await loadReportData(id);
  if (!data) notFound();

  const { survey, items, status, cutoff, responses, excluded } = data;
  const dims = dimensions(items, responses);
  const filters: Record<string, string> = {};
  for (const d of dims) {
    const v = sp[`f.${d.key}`];
    if (typeof v === "string" && v) filters[d.key] = v;
  }
  const filtered = applyFilters(responses, filters);
  const report = buildReport(items, filtered);
  const byKey = typeof sp.by === "string" && dims.some((d) => d.key === sp.by) ? sp.by : dims[0]?.key;
  const byDim = dims.find((d) => d.key === byKey);
  const table = byDim ? breakdown(items, filtered, byDim) : null;
  const closed = status === "closed";
  const textCount = report.items.reduce((n, i) => n + (i.kind === "text" ? i.texts.length : 0), 0);
  const feedback = (Array.isArray(survey.feedbackSummary) ? survey.feedbackSummary : []) as FeedbackGroup[];
  const firstNoon = cutoff && survey.opensAt && survey.opensAt > cutoff;

  return (
    <main className="mx-auto max-w-5xl space-y-4 px-4 py-6">
      <Link href={`/admin/surveys/${id}/`} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-700">
        <ArrowLeft className="h-4 w-4" /> กลับไปหน้าแบบประเมิน
      </Link>

      {/* ---------- หัว ---------- */}
      <section className={card}>
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 text-xs">
              <span className={`rounded-full px-2 py-0.5 font-medium ${STATUS_TONE[status]}`}>{STATUS_LABEL[status]}</span>
              <span className="font-semibold text-brand-700">{cutoffLabel(cutoff)}</span>
            </p>
            <h1 className="mt-1 text-xl font-bold text-gray-900">Dashboard · {survey.title}</h1>
            <p className="mt-1 flex items-start gap-1.5 text-xs text-gray-500">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                นับเฉพาะผู้ตอบที่ตรวจกับทะเบียนสมาชิกแล้ว
                {(excluded.pending > 0 || excluded.review > 0) && (
                  <>
                    {" "}· ยังไม่นับ: รอตรวจ {excluded.pending} · ให้เจ้าหน้าที่ดู {excluded.review} (
                    <Link href={`/admin/surveys/${id}/responses/`} className="text-brand-700 underline">
                      ไปตรวจ
                    </Link>
                    )
                  </>
                )}
                {cutoff && " · ระหว่างเปิดรับ ตัวเลขขยับวันละครั้งตอน 12:00 (ก่อนเที่ยงแสดงผลเที่ยงเมื่อวาน)"}
              </span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/admin/surveys/${id}/report/`}
              target="_blank"
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              <FileText className="h-4 w-4" /> รายงาน PDF
            </Link>
            {closed ? (
              <>
                <a href={`/api/admin/surveys/${id}/export/?kind=summary`} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50">
                  <Download className="h-4 w-4" /> CSV สรุป
                </a>
                <a href={`/api/admin/surveys/${id}/export/?kind=raw`} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50" title="เบอร์โทรปิดบังบางส่วน">
                  <Download className="h-4 w-4" /> CSV ข้อมูลดิบ
                </a>
              </>
            ) : (
              <span className="self-center text-xs text-gray-400">ส่งออก CSV ได้หลังสิ้นสุดการประเมิน</span>
            )}
          </div>
        </div>
        <div className="mt-3 border-t border-gray-100 pt-3">
          <FilterBar dims={dims} />
          {Object.keys(filters).length > 0 && (
            <p className="mt-2 text-xs text-brand-700">
              กำลังกรองอยู่ — แสดง {filtered.length} จาก {responses.length} คน
            </p>
          )}
        </div>
      </section>

      {firstNoon && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200">
          ผลชุดแรกจะออกเวลา 12:00 น. หลังวันเริ่มเปิดรับ
        </p>
      )}

      {report.n === 0 ? (
        <section className={`${card} grid place-items-center gap-2 py-12 text-center text-sm text-gray-400`}>
          <Users className="h-6 w-6 text-gray-300" /> ยังไม่มีผู้ตอบที่ตรวจแล้ว{Object.keys(filters).length ? "ในกลุ่มที่กรอง" : ""}
        </section>
      ) : (
        <>
          <KpiTiles report={report} />

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <section className={card}>
              <h2 className="font-semibold text-gray-800">ความพึงพอใจแต่ละด้าน</h2>
              <p className="mb-3 text-xs text-gray-500">ค่าเฉลี่ยเต็ม 5 · ช่อง &quot;ไม่ประเมิน&quot; ไม่นำมาคิด</p>
              <MeanBars rows={report.aspects.map((a) => ({ label: a.title, s: a.overall }))} />
            </section>
            <section className={card}>
              <h2 className="font-semibold text-gray-800">ผู้ตอบรายวัน</h2>
              <p className="mb-3 text-xs text-gray-500">ดูว่าประชาสัมพันธ์วันไหนได้ผล</p>
              <DailyBars daily={report.daily} />
            </section>
          </div>

          <div className="grid gap-4">
            {report.items.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>

          {table && dims.length > 0 && (
            <section id="breakdown" className={`${card} scroll-mt-4`}>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <h2 className="font-semibold text-gray-800">เปรียบเทียบตามกลุ่ม</h2>
                <BreakdownPicker dims={dims} current={byKey!} />
              </div>
              <BreakdownTable data={table} />
            </section>
          )}
        </>
      )}

      {/* ---------- ข้อเสนอแนะที่พูดซ้ำ ---------- */}
      <section className={card}>
        <h2 className="font-semibold text-gray-800">ข้อเสนอแนะที่พูดถึงบ่อย</h2>
        <p className="mb-3 text-xs text-gray-500">จัดกลุ่มความเห็นที่พูดเรื่องเดียวกัน · กรรมการเห็นฉบับนี้ในลิงก์ (ไม่เห็นข้อความรายคน)</p>
        <FeedbackEditor
          surveyId={id}
          initial={feedback}
          at={survey.feedbackSummaryAt?.toISOString() ?? null}
          aiReady={AI_READY}
          textCount={textCount}
        />
      </section>

      {/* ---------- ลิงก์กรรมการ ---------- */}
      <section className={card}>
        <h2 className="font-semibold text-gray-800">ลิงก์สำหรับกรรมการ</h2>
        <p className="mb-3 text-xs text-gray-500">
          ดูผลสรุปและกราฟได้โดยไม่ต้องมีบัญชีหลังบ้าน · กลุ่มที่มีผู้ตอบไม่ถึง 5 คนถูกรวมเป็น &quot;อื่น ๆ&quot;
        </p>
        <SharePanel
          surveyId={id}
          closed={closed}
          url={survey.shareToken ? shareUrl(survey.shareToken, process.env.SURVEY_PUBLIC_URL) : null}
          expiresAt={survey.shareExpiresAt?.toISOString() ?? null}
        />
      </section>
    </main>
  );
}
