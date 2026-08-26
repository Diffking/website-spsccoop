import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import PageTracker from "@/components/site/PageTracker";
import BackToTop from "@/components/ui/BackToTop";
import FinancialCheckup from "@/components/tools/FinancialCheckup";
import { pageMetadata } from "@/lib/seo";
import { getSetting, getSiteInfo } from "@/lib/settings";
import {
  CHECKUP_IMAGES_KEY,
  CHECKUP_LOGO_KEY,
  CHECKUP_QUESTIONS_KEY,
  type CheckupImages,
} from "@/lib/programPages";
import { fillQuestions } from "@/lib/financialCheckup";

/**
 * โปรแกรมตรวจสุขภาพการเงิน — โปรแกรมตัวแรกของ "หน้าโปรแกรม" (ดู src/lib/programPages.ts)
 *
 * หน้านี้ทำแค่สองอย่าง: หยิบคำถามกับภาพประกอบจากฐาน แล้ววางกรอบหน้าเว็บให้
 * ตัวโปรแกรมจริงอยู่ใน components/tools/FinancialCheckup.tsx ซึ่งทำงานฝั่งเบราว์เซอร์ล้วน
 *
 * ⚠️ **หน้านี้ไม่มีส่วนหัวและส่วนท้ายของเว็บ ตั้งใจ** — เจ้าของเว็บสั่งไว้ 26 ส.ค. 2026
 * เพราะแถบเมนูด้านบนกับส่วนท้ายกินความสูงจอไปมาก จนภาพประกอบคำถามแสดงได้ไม่เต็มใบ
 * หน้าโปรแกรมเป็น "เครื่องมือที่กดใช้ทีละหน้าจอ" ไม่ใช่หน้าไว้อ่านยาว ๆ จึงไม่ต้องมีเมนู
 * มาแย่งที่ · ทางกลับเว็บใช้ลิงก์ "กลับหน้าแรก" ที่มุมบนซ้ายแทน — **ห้ามเอาออก**
 * ไม่งั้นคนที่เปิดหน้านี้จากลิงก์ตรง ๆ จะกลับเข้าเว็บไม่ได้เลย
 */

// อ่านข้อมูลจากฐานทุกครั้ง — prerender ตอน build ไม่ได้ (ยังไม่มี DATABASE_URL)
export const dynamic = "force-dynamic";

// ตั้งค่า SEO ของหน้านี้ที่ /admin/seo
export const generateMetadata = () => pageMetadata("/tools/financial-checkup");

export default async function FinancialCheckupPage() {
  const [images, saved, logo, site] = await Promise.all([
    getSetting<CheckupImages>(CHECKUP_IMAGES_KEY, {}),
    getSetting<unknown>(CHECKUP_QUESTIONS_KEY, null),
    getSetting<string>(CHECKUP_LOGO_KEY, ""),
    // เบอร์สหกรณ์ที่โชว์ตอนแนะนำให้ขอคำปรึกษา — แอดมินแก้ได้ที่ หลังบ้าน → ส่วนท้ายเว็บ
    getSiteInfo(),
  ]);
  // ยังไม่เคยแก้จากหลังบ้าน = ใช้ชุดตั้งต้น · อ่านไม่ออกก็ถอยกลับชุดตั้งต้นเหมือนกัน
  const questions = fillQuestions(saved);

  return (
    <>
      <PageTracker />
      <main className="min-h-screen bg-sky-soft">
        {/* กว้างกว่าหน้าเนื้อหาทั่วไป (max-w-5xl) — เจ้าของเว็บขอ 26 ส.ค. 2026
              เพราะหน้านี้ไม่มีเมนูมาแย่งที่แล้ว ภาพประกอบจึงได้พื้นที่เต็มที่ */}
        <div className="mx-auto max-w-5xl px-4 py-4">
          {/*
            แถบบนบางที่สุดเท่าที่ยังบอกได้ว่านี่หน้าอะไรและกลับยังไง
            — ชื่อหน้าอยู่บรรทัดเดียวกับลิงก์กลับ ไม่กินความสูงเป็นแบนเนอร์เต็มแถบ
          */}
          <div className="mb-3 flex items-center gap-2.5">
            <Link
              href="/"
              title="กลับหน้าแรก"
              aria-label="กลับหน้าแรก"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-gray-500 ring-1 ring-gray-200 transition hover:text-brand-600 hover:ring-brand-200"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-sm font-semibold text-brand-800">ตรวจสุขภาพการเงิน</h1>
          </div>

          <FinancialCheckup
            questions={questions}
            images={images}
            logo={logo}
            contactPhone={site.phone ?? ""}
          />
        </div>
      </main>
      <BackToTop />
    </>
  );
}
