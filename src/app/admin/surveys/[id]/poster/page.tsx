import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { ADMIN_HOME, canArea } from "@/lib/permissions";
import { db } from "@/lib/db";
import { getBrand } from "@/lib/nav";
import { localAsset } from "@/lib/assetFallback";
import { surveyUrl } from "@/lib/survey";
import { thaiDateTime } from "@/lib/surveyTime";
import SurveyQr from "@/components/admin/SurveyQr";
import PrintButton from "@/components/admin/PrintButton";

type Params = { params: Promise<{ id: string }> };

/**
 * โปสเตอร์ A4 สำหรับประชาสัมพันธ์ — ชื่อแบบประเมิน + QR ใหญ่ + ลิงก์ที่พิมพ์ตามได้
 * กด "พิมพ์" แล้วเลือก "บันทึกเป็น PDF" ได้ด้วย (เอาไปส่งไลน์/แปะประกาศ)
 */
export default async function SurveyPosterPage({ params }: Params) {
  const user = await currentUser();
  if (!user) redirect("/login/");
  if (!canArea(user, "surveys")) redirect(ADMIN_HOME);

  const { id } = await params;
  const survey = await db.survey.findUnique({ where: { id } });
  if (!survey) notFound();

  const brand = await getBrand();
  const logoUrl = brand.logoUrl ? localAsset(brand.logoUrl) : null;
  const url = surveyUrl(survey.code, process.env.SURVEY_PUBLIC_URL);

  return (
    <main className="min-h-screen bg-gray-100 py-6 print:bg-white print:py-0">
      {/* ขอบกระดาษศูนย์ — ไม่งั้นเบราว์เซอร์เติมขอบเองแล้วแผ่น A4 ล้นไปหน้าสอง */}
      <style>{"@page { size: A4; margin: 0 }"}</style>
      <div className="mx-auto mb-4 flex max-w-[210mm] justify-end px-4 print:hidden">
        <PrintButton />
      </div>

      {/* กระดาษ A4 — บนจอเห็นเป็นแผ่นกลางหน้า ตอนพิมพ์เต็มแผ่นพอดี */}
      <div className="mx-auto flex aspect-210/297 w-full max-w-[210mm] flex-col items-center overflow-hidden bg-white px-[14mm] py-[16mm] text-center shadow-lg print:shadow-none">
        <div className="flex items-center gap-3">
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- โลโก้ในหน้าพิมพ์ ไม่ต้องผ่านตัวย่อรูป
            <img src={logoUrl} alt="" className="h-16 w-16 object-contain" />
          )}
          <p className="text-left text-xl font-bold leading-snug text-brand-800">{brand.name}</p>
        </div>

        <div className="mt-[10mm] h-1.5 w-24 rounded-full bg-linear-to-r from-brand-600 to-sky-400" />
        <h1 className="mt-[8mm] text-[30px] font-bold leading-tight text-gray-900">{survey.title}</h1>
        <p className="mt-4 text-xl text-gray-600">สแกน QR Code เพื่อตอบแบบประเมิน</p>

        <div className="mt-[8mm] rounded-3xl p-3 ring-4 ring-brand-100">
          <SurveyQr url={url} logoUrl={logoUrl} fileName={`qr-${survey.code}`} className="h-[88mm] w-[88mm]" showButtons={false} />
        </div>

        <p className="mt-[6mm] text-sm text-gray-500">หรือเปิดลิงก์</p>
        <p className="mt-1 font-mono text-lg font-semibold text-brand-700">{url.replace(/^https?:\/\//, "")}</p>

        <div className="mt-auto space-y-1 text-base text-gray-600">
          <p>ยืนยันตัวตนด้วยเบอร์มือถือ หรือเลขที่สมาชิก · ตอบได้ท่านละ 1 ครั้ง</p>
          {survey.closesAt && <p className="font-semibold text-brand-800">ปิดรับคำตอบ {thaiDateTime(survey.closesAt)}</p>}
        </div>
      </div>
    </main>
  );
}
