import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import PageTracker from "@/components/site/PageTracker";
import BackToTop from "@/components/ui/BackToTop";
import InterestCalculator from "@/components/tools/InterestCalculator";
import { pageMetadata } from "@/lib/seo";
import { getRates, getSetting, getSiteInfo } from "@/lib/settings";
import { readHiddenRates, visibleRates } from "@/lib/interestCalc";
import {
  INTEREST_DEPOSIT_HIDDEN_KEY,
  INTEREST_INTRO_KEY,
  INTEREST_RATES_HIDDEN_KEY,
  fillInterestIntro,
} from "@/lib/programPages";

/**
 * โปรแกรมคำนวณดอกเบี้ย — โปรแกรมตัวที่สองของ "หน้าโปรแกรม" (ดู src/lib/programPages.ts)
 *
 * หน้านี้ทำแค่หยิบอัตราดอกเบี้ยเงินกู้จริงกับเบอร์ติดต่อจากฐาน แล้ววางกรอบหน้าเว็บให้
 * ตัวโปรแกรมจริงอยู่ใน components/tools/InterestCalculator.tsx ซึ่งทำงานฝั่งเบราว์เซอร์ล้วน
 *
 * ⚠️ **ไม่มีส่วนหัวและส่วนท้ายของเว็บ เหมือนหน้าโปรแกรมตรวจสุขภาพการเงิน** — หน้าโปรแกรม
 * เป็นเครื่องมือที่กดใช้ทีละหน้าจอ ไม่ใช่หน้าไว้อ่านยาว ๆ · ทางกลับเว็บใช้ลิงก์ "กลับหน้าแรก"
 * ที่มุมบนซ้าย **ห้ามเอาออก** ไม่งั้นคนที่เปิดหน้านี้จากลิงก์ตรง ๆ จะกลับเข้าเว็บไม่ได้เลย
 */

// อ่านข้อมูลจากฐานทุกครั้ง — prerender ตอน build ไม่ได้ (ยังไม่มี DATABASE_URL)
export const dynamic = "force-dynamic";

// ตั้งค่า SEO ของหน้านี้ที่ /admin/seo
export const generateMetadata = () => pageMetadata("/tools/interest-calculator");

export default async function InterestCalculatorPage() {
  const [rates, site, hiddenLoan, hiddenDeposit, intro] = await Promise.all([
    // อัตราดอกเบี้ยเงินกู้จริง — เอาไปทำปุ่มลัด สมาชิกจะได้ไม่ต้องเปิดอีกหน้ามาดูว่ากี่เปอร์เซ็นต์
    getRates(),
    // เบอร์กับไลน์ของสหกรณ์ — แอดมินแก้ได้ที่ หลังบ้าน → ส่วนท้ายเว็บ (ห้ามฝังไว้ในโค้ด)
    getSiteInfo(),
    // ประเภทที่เจ้าหน้าที่ติ๊กไว้ว่า "ไม่ต้องขึ้น" ในโปรแกรมนี้ (หลังบ้าน → หน้าโปรแกรม)
    // เก็บแยกสองคีย์ เพราะเงินกู้กับเงินรับฝากเป็นคนละตารางและซ่อนคนละรายการกัน
    getSetting<unknown>(INTEREST_RATES_HIDDEN_KEY, []),
    getSetting<unknown>(INTEREST_DEPOSIT_HIDDEN_KEY, []),
    // คำอธิบายว่าโปรแกรมนี้มีไว้ทำอะไร — ยังไม่เคยแก้ = ใช้ถ้อยคำตั้งต้นในโค้ด
    getSetting<unknown>(INTEREST_INTRO_KEY, null),
  ]);

  return (
    <>
      <PageTracker />
      <main className="min-h-screen bg-sky-soft">
        <div className="mx-auto max-w-5xl px-4 py-4">
          {/* แถบบนบางที่สุดเท่าที่ยังบอกได้ว่านี่หน้าอะไรและกลับยังไง (แบบเดียวกับหน้าโปรแกรมตัวแรก) */}
          <div className="mb-3 flex items-center gap-2.5">
            <Link
              href="/"
              title="กลับหน้าแรก"
              aria-label="กลับหน้าแรก"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-gray-500 ring-1 ring-gray-200 transition hover:text-brand-600 hover:ring-brand-200"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-sm font-semibold text-brand-800">คำนวณดอกเบี้ย</h1>
            {/* บอกตั้งแต่แถบบนว่านี่คือสื่อการเรียนรู้ ไม่ใช่ระบบแจ้งยอดหนี้จริงของสมาชิก */}
            <span className="hidden text-xs text-gray-400 sm:inline">· สื่อการเรียนรู้เรื่องดอกเบี้ย</span>
          </div>

          <InterestCalculator
            loanRates={visibleRates(rates.loan ?? [], readHiddenRates(hiddenLoan))}
            depositRates={visibleRates(rates.deposit ?? [], readHiddenRates(hiddenDeposit))}
            intro={fillInterestIntro(intro)}
            contactPhone={site.phone ?? ""}
            lineId={site.lineId ?? ""}
          />
        </div>
      </main>
      <BackToTop />
    </>
  );
}
