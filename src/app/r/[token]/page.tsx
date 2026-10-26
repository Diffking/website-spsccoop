import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getBrand } from "@/lib/nav";
import { localAsset } from "@/lib/assetFallback";
import { inlineSvg } from "@/lib/inlineSvg";
import { svgWithClass } from "@/lib/svg";
import { breakdown, buildReport, dimensions } from "@/lib/surveyReport";
import { cutoffLabel, loadReportData } from "@/lib/surveyReportData";
import {
  BreakdownTable,
  DailyBars,
  FeedbackSummaryList,
  ItemCard,
  KpiTiles,
  MeanBars,
  type FeedbackGroup,
} from "@/components/admin/SurveyCharts";
import PrintButton from "@/components/admin/PrintButton";

/**
 * ผลสรุปแบบประเมินสำหรับกรรมการ — เปิดได้โดยไม่ต้องมีบัญชีหลังบ้าน (ผ่าน Cloudflare Worker)
 *
 * ⚠️ หน้านี้ถูกเก็บสำเนาบนโฮสต์ จึง**ห้ามมีข้อมูลรายคนเด็ดขาด**:
 *   ไม่มีชื่อ เบอร์ เลขสมาชิก · ไม่มีข้อความที่สมาชิกพิมพ์เอง (มีแค่สรุปกลุ่มที่เจ้าหน้าที่ตรวจแล้ว)
 *   ตารางแยกกลุ่ม: กลุ่มที่มีผู้ตอบไม่ถึง 5 คนรวมเป็น "อื่น ๆ" — ไม่งั้นรู้ได้ว่าใครให้คะแนนเท่าไร
 * ไม่ติดตัวนับผู้เข้าชม · noindex
 */

export const dynamic = "force-dynamic";
const MIN_GROUP = 5;

type Params = { params: Promise<{ token: string }> };

async function surveyFor(token: string) {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;
  const s = await db.survey.findUnique({ where: { shareToken: token }, select: { id: true, published: true, shareExpiresAt: true } });
  if (!s || !s.published) return null;
  if (s.shareExpiresAt && s.shareExpiresAt.getTime() <= Date.now()) return null;
  return s;
}

export const metadata: Metadata = { title: "ผลการประเมินความพึงพอใจ", robots: { index: false, follow: false } };

export default async function CommitteeReportPage({ params }: Params) {
  const { token } = await params;
  const s = await surveyFor(token);
  if (!s) notFound();
  const data = await loadReportData(s.id);
  if (!data) notFound();

  const brand = await getBrand();
  const raw = await inlineSvg(localAsset(brand.logoUrl));
  const logo = raw ? svgWithClass(raw, "h-9 w-9 object-contain", brand.name) : null;

  const report = buildReport(data.items, data.responses);
  // แยกกลุ่มเฉพาะข้อมูลจากทะเบียน (หน่วยงาน · เพศ · อายุ · ประเภท) ไม่เอาข้อในแบบประเมิน
  const tables = dimensions(data.items, data.responses)
    .filter((d) => !d.key.startsWith("q:"))
    .map((d) => breakdown(data.items, data.responses, d, MIN_GROUP));
  const feedback = (Array.isArray(data.survey.feedbackSummary) ? data.survey.feedbackSummary : []) as FeedbackGroup[];
  const card = "rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 break-inside-avoid";

  return (
    <main className="min-h-screen bg-sky-soft print:bg-white">
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-5">
        <div className="flex items-center gap-2.5">
          {logo && <span className="shrink-0" dangerouslySetInnerHTML={{ __html: logo }} />}
          <span className="min-w-0 flex-1 text-sm font-semibold text-brand-800">{brand.name}</span>
          <span className="print:hidden">
            <PrintButton />
          </span>
        </div>

        <header className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
          <div className="h-2 bg-linear-to-r from-brand-600 to-sky-400" />
          <div className="p-5">
            <p className="text-xs font-semibold text-brand-700">{cutoffLabel(data.cutoff)}</p>
            <h1 className="mt-1 text-xl font-bold text-brand-900 sm:text-2xl">ผลการประเมิน · {data.survey.title}</h1>
            <p className="mt-1 text-sm text-gray-600">
              ผู้ตอบที่ตรวจสอบกับทะเบียนสมาชิกแล้ว {report.n.toLocaleString("th-TH")} คน
            </p>
            <p className="mt-2 text-xs text-gray-500">
              เกณฑ์แปลผล (เต็ม 5): 4.51–5.00 มากที่สุด · 3.51–4.50 มาก · 2.51–3.50 ปานกลาง · 1.51–2.50 น้อย · 1.00–1.50 น้อยที่สุด
            </p>
          </div>
        </header>

        {report.n > 0 && (
          <>
            <KpiTiles report={report} />
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
              <section className={card}>
                <h2 className="mb-3 font-semibold text-gray-800">ความพึงพอใจแต่ละด้าน</h2>
                <MeanBars rows={report.aspects.map((a) => ({ label: a.title, s: a.overall }))} />
              </section>
              <section className={card}>
                <h2 className="mb-3 font-semibold text-gray-800">ผู้ตอบรายวัน</h2>
                <DailyBars daily={report.daily} />
              </section>
            </div>

            {feedback.length > 0 && (
              <section className={card}>
                <h2 className="font-semibold text-gray-800">ข้อเสนอแนะที่สมาชิกพูดถึงบ่อย</h2>
                <p className="mb-3 text-xs text-gray-500">จัดกลุ่มความเห็นที่พูดเรื่องเดียวกัน</p>
                <FeedbackSummaryList groups={feedback} />
              </section>
            )}

            {report.items.map((item) =>
              item.kind === "text" ? null : <ItemCard key={item.id} item={item} hideTexts />,
            )}

            {tables.map((t) => (
              <section key={t.label} className={card}>
                <h2 className="font-semibold text-gray-800">เปรียบเทียบตาม{t.label}</h2>
                <p className="mb-3 text-xs text-gray-500">กลุ่มที่มีผู้ตอบไม่ถึง {MIN_GROUP} คนรวมไว้เป็น &quot;อื่น ๆ&quot;</p>
                <BreakdownTable data={t} />
              </section>
            ))}
          </>
        )}
      </div>
    </main>
  );
}
