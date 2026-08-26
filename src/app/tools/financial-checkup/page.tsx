import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import Header from "@/components/site/Header";
import Footer from "@/components/site/Footer";
import PageTracker from "@/components/site/PageTracker";
import BackToTop from "@/components/ui/BackToTop";
import FinancialCheckup from "@/components/tools/FinancialCheckup";
import { pageMetadata } from "@/lib/seo";
import { getSetting, getSiteInfo } from "@/lib/settings";
import { CHECKUP_IMAGES_KEY, CHECKUP_QUESTIONS_KEY, type CheckupImages } from "@/lib/programPages";
import { fillQuestions } from "@/lib/financialCheckup";

/**
 * โปรแกรมตรวจสุขภาพการเงิน — โปรแกรมตัวแรกของ "หน้าโปรแกรม" (ดู src/lib/programPages.ts)
 *
 * หน้านี้ทำแค่สองอย่าง: หยิบภาพประกอบคำถามจากฐาน แล้ววางกรอบหน้าเว็บให้
 * ตัวโปรแกรมจริงอยู่ใน components/tools/FinancialCheckup.tsx ซึ่งทำงานฝั่งเบราว์เซอร์ล้วน
 */

// Footer อ่านข้อมูลติดต่อจากฐาน — prerender ตอน build ไม่ได้ (ยังไม่มี DATABASE_URL)
export const dynamic = "force-dynamic";

// ตั้งค่า SEO ของหน้านี้ที่ /admin/seo
export const generateMetadata = () => pageMetadata("/tools/financial-checkup");

export default async function FinancialCheckupPage() {
  const [images, saved, site] = await Promise.all([
    getSetting<CheckupImages>(CHECKUP_IMAGES_KEY, {}),
    getSetting<unknown>(CHECKUP_QUESTIONS_KEY, null),
    // เบอร์สหกรณ์ที่โชว์ตอนแนะนำให้ขอคำปรึกษา — แอดมินแก้ได้ที่ หลังบ้าน → ส่วนท้ายเว็บ
    getSiteInfo(),
  ]);
  // ยังไม่เคยแก้จากหลังบ้าน = ใช้ชุดตั้งต้น · อ่านไม่ออกก็ถอยกลับชุดตั้งต้นเหมือนกัน
  const questions = fillQuestions(saved);

  return (
    <>
      <PageTracker />
      <Header />
      <main>
        <section className="bg-gradient-to-b from-brand-600 to-brand-400 py-10 text-center text-white">
          <div className="mx-auto max-w-6xl px-4">
            <p className="text-sm font-medium opacity-80">เครื่องมือสำหรับสมาชิก</p>
            <h1 className="mt-1.5 text-2xl font-bold md:text-3xl">ตรวจสุขภาพการเงิน</h1>
            <p className="mx-auto mt-2 max-w-xl text-sm opacity-90">
              รู้ว่าเดือนหนึ่งเงินไปไหนหมด และสุขภาพการเงินของเราอยู่ระดับไหน
            </p>
          </div>
        </section>

        <section className="bg-sky-soft py-10">
          <div className="mx-auto max-w-6xl px-4">
            <Link
              href="/"
              className="mb-5 inline-flex items-center gap-1.5 text-sm text-gray-500 transition hover:text-brand-600"
            >
              <ArrowLeft className="h-4 w-4" /> กลับหน้าแรก
            </Link>
            <FinancialCheckup
              questions={questions}
              images={images}
              contactPhone={site.phone ?? ""}
            />
          </div>
        </section>
      </main>
      <BackToTop />
      <Footer />
    </>
  );
}
