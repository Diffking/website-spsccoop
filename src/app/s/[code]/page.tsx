import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarClock, Lock } from "lucide-react";
import SurveyForm from "@/components/survey/SurveyForm";
import { getBrand } from "@/lib/nav";
import { localAsset } from "@/lib/assetFallback";
import { inlineSvg } from "@/lib/inlineSvg";
import { svgWithClass } from "@/lib/svg";
import { NOT_OPEN, publicSurvey } from "@/lib/surveyPublic";
import { memberSourceReady } from "@/lib/memberLookup";
import { thaiDateTime } from "@/lib/surveyTime";

/**
 * หน้าตอบแบบประเมินสำหรับสมาชิก — ลิงก์และ QR ที่แจกชี้มาที่นี่ (ผ่าน www.spsccoop.com)
 *
 * หน้านี้ไม่มีข้อมูลส่วนตัวของใครเลย มีแต่คำถาม — ตัวมิเรอร์บนโฮสต์เก็บสำเนาไปได้ปลอดภัย
 * ชื่อสมาชิกขึ้นหลังยืนยันตัวตนผ่าน API เท่านั้น (คำขอ POST ตัวมิเรอร์ไม่เก็บสำเนา)
 *
 * ไม่มีส่วนหัว/ท้ายของเว็บ และไม่ติดตัวนับผู้เข้าชม — เป็นเครื่องมือกดทีละหน้าจอแบบหน้าโปรแกรม
 * และเป็นลิงก์ที่แจกเฉพาะกลุ่ม ไม่ให้กูเกิลเก็บ
 */

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { code } = await params;
  const survey = await publicSurvey(code).catch(() => null);
  return {
    title: survey?.title ?? "แบบประเมิน",
    robots: { index: false, follow: false },
  };
}

export default async function SurveyPage({ params }: Params) {
  const { code } = await params;
  const survey = await publicSurvey(code);
  if (!survey) notFound();

  const brand = await getBrand();
  const raw = await inlineSvg(localAsset(brand.logoUrl));
  const logo = raw ? svgWithClass(raw, "h-9 w-9 object-contain", brand.name) : null;

  const blocked =
    survey.status === "scheduled" || survey.status === "closed"
      ? NOT_OPEN[survey.status]
      : !memberSourceReady()
        ? "ระบบยืนยันตัวตนยังไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลัง"
        : null;

  return (
    <main className="min-h-screen bg-sky-soft">
      <div className="mx-auto max-w-2xl px-4 py-5">
        <div className="mb-4 flex items-center gap-2.5">
          {logo ? (
            <span className="shrink-0" dangerouslySetInnerHTML={{ __html: logo }} />
          ) : null}
          <span className="text-sm font-semibold text-brand-800">{brand.name}</span>
        </div>

        {blocked ? (
          <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
            <div className="h-2 bg-linear-to-r from-brand-600 to-sky-400" />
            <div className="p-6 text-center">
              {survey.status === "scheduled" ? (
                <CalendarClock className="mx-auto h-12 w-12 text-amber-500" />
              ) : (
                <Lock className="mx-auto h-12 w-12 text-gray-400" />
              )}
              <h1 className="mt-3 text-xl font-bold text-brand-900">{survey.title}</h1>
              <p className="mt-2 text-gray-600">{blocked}</p>
              {survey.status === "scheduled" && survey.opensAt && (
                <p className="mt-1 text-sm font-medium text-amber-700">เปิดรับ {thaiDateTime(survey.opensAt)}</p>
              )}
            </div>
          </section>
        ) : (
          <SurveyForm
            code={code}
            title={survey.title}
            description={survey.description}
            items={survey.items.filter((i) => !i.hidden)}
          />
        )}

        {survey.status === "open" && survey.closesAt && (
          <p className="mt-4 text-center text-xs text-gray-500">ปิดรับคำตอบ {thaiDateTime(survey.closesAt)}</p>
        )}
      </div>
    </main>
  );
}
