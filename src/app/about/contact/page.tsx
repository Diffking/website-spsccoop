import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import Header from "@/components/site/Header";
import Footer from "@/components/site/Footer";
import PageTracker from "@/components/site/PageTracker";
import ContactView from "@/components/site/ContactView";
import BackToTop from "@/components/ui/BackToTop";
import PageContent from "@/components/site/PageContent";
import { getOfficeHours, getSiteInfo } from "@/lib/settings";
import { getBrand } from "@/lib/nav";
import { describeClosedDays, describeOfficeHours } from "@/lib/officeHours";
import { pageMetadata } from "@/lib/seo";
import { localAssetsInHtml } from "@/lib/assetFallback";
import { db } from "@/lib/db";

/**
 * ติดต่อเรา — ที่อยู่ แผนที่ นำทาง ช่องทางติดต่อ และเลขที่บัญชี
 *
 * ทำเป็นหน้าโค้ดแทนหน้าเนื้อหาในฐาน เพราะมีแผนที่กับปุ่มขอตำแหน่งที่ต้องรันฝั่งเบราว์เซอร์
 * ข้อมูลทั้งหมดยังแก้ได้เองที่ /admin/footer เหมือนเดิม ไม่ได้ฝังไว้ในโค้ด
 */

export const dynamic = "force-dynamic";
export const generateMetadata = () => pageMetadata("/about/contact");

export default async function ContactPage() {
  const [info, hours, brand, page] = await Promise.all([
    getSiteInfo(),
    getOfficeHours(),
    getBrand(),
    /*
     * หน้าเนื้อหาที่เจ้าหน้าที่สร้างไว้ที่ slug "contact"
     *
     * เส้นทางที่เขียนเป็นโค้ดมาก่อน /[...slug] เสมอ ถ้าไม่ดึงมาแสดงตรงนี้
     * สิ่งที่พิมพ์ไว้ในหลังบ้านจะไม่มีวันขึ้นเว็บ แล้วงงว่าบันทึกแล้วทำไมไม่เห็น
     */
    db.page.findUnique({ where: { slug: "about/contact" } }).catch(() => null),
  ]);

  const extra = page?.published && page.body.trim() ? page.body : "";

  // เบอร์เก็บรวมกันในช่องเดียวคั่นด้วยคอมมา — แยกให้เป็นปุ่มโทรทีละเบอร์
  const phones = info.phone
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <>
      <PageTracker />
      <Header />
      <main className="mx-auto w-full max-w-6xl px-4 py-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition hover:text-brand-600"
        >
          <ArrowLeft className="h-4 w-4" /> กลับหน้าแรก
        </Link>

        {/* ชื่อหน้าตามที่ตั้งไว้ในหลังบ้าน ไม่มีก็ใช้คำตั้งต้น */}
        <h1 className="mt-3 text-2xl font-bold leading-snug text-gray-800 md:text-3xl">
          {page?.title?.trim() || "ติดต่อเรา"}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          ที่อยู่สำนักงาน เส้นทางมาสหกรณ์ ช่องทางติดต่อ และเลขที่บัญชีสำหรับโอนเงิน
        </p>

        <div className="mt-5">
          <ContactView
            address={info.address}
            phones={phones}
            fax={info.fax}
            email={info.email}
            facebook={info.facebook}
            line={info.line}
            lineId={info.lineId}
            mapPoint={info.mapPoint}
            bankAccounts={info.bankAccounts ?? []}
            officeHours={describeOfficeHours(hours)}
            closedDays={describeClosedDays(hours)}
            coopName={brand.name}
          />

          {/* เนื้อหาที่พิมพ์เพิ่มเองในหลังบ้าน — ต่อท้ายแผนที่และช่องทางติดต่อ */}
          {extra && (
            <PageContent
              html={localAssetsInHtml(extra)}
              className="mt-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5 md:p-8"
            />
          )}
        </div>
      </main>
      <Footer />
      <BackToTop />
    </>
  );
}
