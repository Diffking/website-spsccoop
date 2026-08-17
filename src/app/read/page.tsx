import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Header from "@/components/site/Header";
import Footer from "@/components/site/Footer";
import PageTracker from "@/components/site/PageTracker";
import EbookReader from "@/components/site/EbookReader";
import BackToTop from "@/components/ui/BackToTop";
import { isAllowedAssetUrl } from "@/lib/assetUrl";

/**
 * อ่านไฟล์ PDF ที่แนบไว้ในหน้าเนื้อหา แบบพลิกหน้าเหมือนหนังสือ
 *
 * ใช้ตัวอ่านตัวเดียวกับจดหมายข่าว/รายงานกิจการ ต่างกันแค่ที่มาของไฟล์ —
 * อันนั้นอ้างจากฐาน ส่วนอันนี้รับที่อยู่ไฟล์มาทาง ?src= (ตรวจแล้วว่าเป็นไฟล์ของเราเอง)
 */

export const dynamic = "force-dynamic";

type Params = { searchParams: Promise<{ src?: string; title?: string }> };

export async function generateMetadata({ searchParams }: Params) {
  const { title } = await searchParams;
  return { title: title?.trim() || "อ่านเอกสาร", robots: { index: false, follow: false } };
}

export default async function ReadPage({ searchParams }: Params) {
  const { src, title } = await searchParams;
  if (!src || !isAllowedAssetUrl(src)) notFound();

  const name = title?.trim() || "เอกสารแนบ";

  return (
    <>
      <PageTracker />
      <Header />
      {/* กว้างเท่าหัวเว็บกับหน้าแรก — หน้าอ่านเอกสารยิ่งกว้างยิ่งอ่านง่าย */}
      <main className="mx-auto w-full max-w-6xl px-4 py-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition hover:text-brand-600"
        >
          <ArrowLeft className="h-4 w-4" /> กลับหน้าแรก
        </Link>

        <h1 className="mb-5 mt-3 text-xl font-bold leading-snug text-gray-800 md:text-2xl">
          {name}
        </h1>

        {/* ส่งผ่านโดเมนเราเอง — pdf.js อ่านข้ามโดเมนไม่ได้ ดู src/app/api/pdf/route.ts */}
        <EbookReader src={`/api/pdf?src=${encodeURIComponent(src)}`} title={name} />
      </main>
      <BackToTop />
      <Footer />
    </>
  );
}
