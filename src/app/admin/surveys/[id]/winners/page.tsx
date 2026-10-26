import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { ADMIN_HOME, canArea } from "@/lib/permissions";
import { db } from "@/lib/db";
import { getBrand } from "@/lib/nav";
import { maskName } from "@/lib/memberLookup";
import { shortHash } from "@/lib/surveyDraw";
import { thaiDateTime } from "@/lib/surveyTime";
import PrintButton from "@/components/admin/PrintButton";

type Params = { params: Promise<{ id: string }> };

/**
 * ใบประกาศผลผู้โชคดี — ไว้พิมพ์ติดบอร์ด / บันทึก PDF ส่งไลน์
 * ⚠️ ฉบับสาธารณะ: ชื่อปิดบังบางส่วน + เลขสมาชิก 3 ตัวท้าย + หน่วยงาน · **ไม่มีเบอร์โทร**
 * (ข้อมูลเต็มสำหรับติดต่อมอบรางวัลอยู่ในไฟล์ CSV ที่หน้าจับรางวัล)
 */
export default async function WinnersPrintPage({ params }: Params) {
  const user = await currentUser();
  if (!user) redirect("/login/");
  if (!canArea(user, "surveys")) redirect(ADMIN_HOME);

  const { id } = await params;
  const survey = await db.survey.findUnique({ where: { id }, select: { title: true } });
  if (!survey) notFound();
  const [brand, prizes, draws] = await Promise.all([
    getBrand(),
    db.surveyPrize.findMany({ where: { surveyId: id }, orderBy: { sortOrder: "desc" } }),
    db.surveyDraw.findMany({ where: { surveyId: id, voided: false }, orderBy: { drawnAt: "asc" } }),
  ]);
  const last = draws[draws.length - 1];

  return (
    <main className="min-h-screen bg-gray-100 py-6 print:bg-white print:py-0">
      <style>{"@page { size: A4; margin: 15mm }"}</style>
      <div className="mx-auto mb-4 flex max-w-[210mm] justify-end px-4 print:hidden">
        <PrintButton />
      </div>
      <article className="mx-auto w-full max-w-[210mm] bg-white px-[15mm] py-[15mm] text-gray-900 shadow-lg print:max-w-none print:p-0 print:shadow-none">
        <header className="text-center">
          <p className="font-semibold">{brand.name}</p>
          <h1 className="mt-1 text-2xl font-bold">ประกาศรายชื่อผู้โชคดี</h1>
          <p className="mt-1 text-gray-700">จากการตอบ{survey.title}</p>
        </header>

        {/* รางวัลใหญ่ขึ้นก่อนในใบประกาศ (กลับลำดับจากตอนจับ) */}
        {prizes.map((p) => {
          const list = draws.filter((d) => d.prizeId === p.id);
          if (!list.length) return null;
          return (
            <section key={p.id} className="mt-6 break-inside-avoid">
              <h2 className="border-b-2 border-brand-600 pb-1 text-lg font-bold text-brand-800">
                {p.name} <span className="text-sm font-normal text-gray-500">({list.length} รางวัล)</span>
              </h2>
              <ol className={`mt-2 grid gap-x-6 gap-y-1 ${list.length > 6 ? "grid-cols-2" : "grid-cols-1"}`}>
                {list.map((d, i) => (
                  <li key={d.id} className="flex gap-2 text-[15px]">
                    <span className="w-6 shrink-0 text-right text-gray-500">{i + 1}.</span>
                    <span>
                      {maskName(d.name)} <span className="text-gray-500">· สมาชิก …{d.membNo.slice(-3)}</span>
                      {d.department && <span className="block text-sm text-gray-500">{d.department}</span>}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          );
        })}

        {last && (
          <footer className="mt-8 border-t border-gray-300 pt-3 text-xs text-gray-500">
            จับรางวัลเมื่อ {thaiDateTime(last.drawnAt)} จากผู้ตอบแบบประเมินที่ตรวจสอบกับทะเบียนสมาชิกแล้ว
            {" "}{last.poolSize.toLocaleString("th-TH")} คน · ลายนิ้วมือรายชื่อ {shortHash(draws[0].poolHash)}
            {" "}· ทุกคนมีโอกาสเท่ากัน · ติดต่อรับรางวัลได้ที่สหกรณ์
          </footer>
        )}
      </article>
    </main>
  );
}
