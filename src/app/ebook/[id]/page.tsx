import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CalendarDays } from "lucide-react";
import Header from "@/components/site/Header";
import Footer from "@/components/site/Footer";
import PageTracker from "@/components/site/PageTracker";
import EbookReader from "@/components/site/EbookReader";
import BackToTop from "@/components/ui/BackToTop";
import { db } from "@/lib/db";
import { localAsset } from "@/lib/assetFallback";
import { KIND_LABEL, announcementLine, type Kind } from "@/lib/announcementKinds";

// เอกสารแก้ได้จากหลังบ้าน จึงอ่านฐานทุกครั้ง (และตอน build ยังไม่มี DATABASE_URL)
export const dynamic = "force-dynamic";

const thaiDate = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Asia/Bangkok",
});

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await db.announcement.findUnique({ where: { id }, select: { title: true } });
  return { title: item ? `${item.title} | สหกรณ์ออมทรัพย์สาธารณสุขสงขลา` : "ไม่พบเอกสาร" };
}

/** ที่อยู่ไฟล์ให้ตัวอ่าน — ดูเหตุผลที่จุดเรียกใช้ */
function readerSource(id: string, fileUrl: string): string {
  const local = localAsset(fileUrl);
  return local.startsWith("/uploads/") ? local : `/api/ebook/${id}/`;
}

export default async function EbookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await db.announcement.findUnique({ where: { id } });
  if (!item || !item.published || !item.fileUrl) notFound();

  const kind = item.kind as Kind;

  return (
    <>
      <PageTracker />
      <Header />
      {/* กว้างเท่าหัวเว็บกับหน้าแรก — หน้าอ่านหนังสือยิ่งกว้าง ตัวหนังสือในหน้ายิ่งใหญ่ */}
      <main className="mx-auto w-full max-w-6xl px-4 py-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition hover:text-brand-600"
        >
          <ArrowLeft className="h-4 w-4" /> กลับหน้าแรก
        </Link>

        <div className="mb-5 mt-3">
          <span className="inline-block rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
            {KIND_LABEL[kind]}
          </span>
          <h1 className="mt-2 text-xl font-bold leading-snug text-gray-800 md:text-2xl">
            {announcementLine(kind, item.number, item.title, item.hideNumber)}
          </h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-400">
            <CalendarDays className="h-4 w-4" /> {thaiDate.format(item.publishedAt)}
          </p>
        </div>

        {/*
          ส่งผ่านโดเมนเราเอง — pdf.js อ่านข้ามโดเมนไม่ได้ ดู src/app/api/ebook/[id]/route.ts

          ⚠️ ไฟล์ที่อยู่ใน uploads/ ของเครื่องนี้แล้ว ให้อ่านจาก /uploads/ ตรง ๆ ไม่ผ่าน /api/ebook
          เพราะ /uploads/ คือที่อยู่ที่ตัวอุ่นแคชเก็บสำเนาไว้บน www.spsccoop.com อยู่แล้ว
          (ดู filesInDatabase ใน /api/public/pages) · ผ่าน /api/ebook/<id> โฮสต์ต้องเก็บไฟล์เดิม
          ซ้ำอีกชุด (~180 MB) และเดิมตัวอุ่นเก็บได้แค่คำตอบ 308 พาไปที่อยู่ที่มี / ปิดท้าย
          ไม่ได้ตัวไฟล์ — เครื่องสำนักงานหลับแล้วเปิด E-Book ไม่ขึ้น (เจอ 1 ต.ค. 2569)
        */}
        <EbookReader src={readerSource(item.id, item.fileUrl)} title={item.title} />
      </main>
      <BackToTop />
      <Footer />
    </>
  );
}
