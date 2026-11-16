import Link from "next/link";
import { ArrowLeft, CalendarClock, Lock } from "lucide-react";
import Header from "@/components/site/Header";
import Footer from "@/components/site/Footer";
import PageTracker from "@/components/site/PageTracker";
import ObjectionForm from "@/components/site/ObjectionForm";
import { currentRound } from "@/lib/objectionData";
import { defaultTitle, thaiDate, thaiDateTime } from "@/lib/objection";
import { pageMetadata } from "@/lib/seo";

// รอบ/วันเปิดปิดแก้ได้จากหลังบ้าน จึงอ่านฐานทุกครั้ง
export const dynamic = "force-dynamic";

export const generateMetadata = () => pageMetadata("/point-order");

/**
 * คำทักท้วงรายงานการประชุมใหญ่ — ระบบแยกต่างหาก ไม่เกี่ยวกับแบบประเมิน (16 พ.ย. 2569)
 * ที่อยู่ตรงกับเมนูเดิม "คำทักท้วงรายงานประชุมใหญ่" · หลังบ้าน → คำทักท้วงรายงานประชุมใหญ่
 */
export default async function PointOrderPage() {
  const round = await currentRound();
  const now = new Date().getFullYear() + 543;

  return (
    <>
      <PageTracker />
      <Header />
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition hover:text-brand-600">
          <ArrowLeft className="h-4 w-4" /> กลับหน้าแรก
        </Link>

        <h1 className="mt-3 text-2xl font-bold leading-snug text-gray-800 md:text-3xl">
          {round?.title ?? defaultTitle(now)}
        </h1>
        {round && (
          <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-500">
            <CalendarClock className="h-4 w-4 shrink-0" aria-hidden="true" />
            รับคำทักท้วงตั้งแต่ {thaiDate(round.opensAt)} ถึง {thaiDate(round.closesAt)}
          </p>
        )}

        <div className="mt-5">
          {round?.status === "open" ? (
            <ObjectionForm roundId={round.id} agendas={round.agendas} />
          ) : (
            <div className="flex flex-col items-center rounded-2xl bg-white px-6 py-14 text-center shadow-sm ring-1 ring-black/5">
              <span className="grid h-16 w-16 place-items-center rounded-2xl bg-gray-50 text-gray-500 ring-1 ring-gray-200">
                <Lock className="h-8 w-8" aria-hidden="true" />
              </span>
              <p className="mt-5 text-xl font-bold text-brand-800">
                {round?.status === "closed" ? "ปิดรับคำทักท้วงแล้ว" : "ยังไม่เปิดรับคำทักท้วง"}
              </p>
              <p className="mt-2 max-w-xl text-sm leading-7 text-gray-600">
                {round?.status === "scheduled"
                  ? `เริ่มรับคำทักท้วง ${thaiDateTime(round.opensAt)}`
                  : round?.status === "closed"
                    ? `สิ้นสุดการรับคำทักท้วงเมื่อ ${thaiDateTime(round.closesAt)}`
                    : "สหกรณ์จะประกาศช่วงเวลารับคำทักท้วงให้ทราบต่อไป"}
              </p>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
