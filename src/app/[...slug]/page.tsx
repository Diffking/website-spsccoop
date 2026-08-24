import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, Eye } from "lucide-react";
import Header from "@/components/site/Header";
import Footer from "@/components/site/Footer";
import PageTracker from "@/components/site/PageTracker";
import PageContent from "@/components/site/PageContent";
import BackToTop from "@/components/ui/BackToTop";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { pageMetadata } from "@/lib/seo";
import { localAssetsInHtml } from "@/lib/assetFallback";
import { repairStructure } from "@/lib/htmlStructure";
import { LIVE_DEPOSIT_RATES, LIVE_LOAN_RATES, splitAtRates } from "@/lib/liveRates";
import RateSections from "@/components/site/RateSections";
import WelfareSections from "@/components/site/WelfareSections";
import { readWelfare } from "@/lib/welfareGroups";
import { groupDeposits, groupLoans } from "@/lib/rateGroups";
import { getRates } from "@/lib/settings";

/**
 * หน้าเนื้อหาทั่วไป — ประวัติความเป็นมา วิสัยทัศน์ ระเบียบ ฯลฯ
 *
 * เส้นทางนี้รับทุก path ที่ไม่มีหน้าเขียนไว้ในโค้ด แล้วไปหาใน Page ตาม slug
 * (เช่น /about/history → slug "about/history") เจ้าหน้าที่จึงสร้างหน้าใหม่เองได้
 * จากเมนู "หน้าเนื้อหา" โดยไม่ต้องรอแก้โค้ด
 *
 * หน้าที่เขียนไว้ในโค้ดแล้ว (เช่น /about/directory/board) ยังมาก่อนเสมอ
 * Next เลือกเส้นทางที่เจาะจงกว่าก่อน catch-all นี้จึงไม่ไปทับของเดิม
 */

// เนื้อหาแก้ได้จากหลังบ้าน จึงอ่านฐานทุกครั้ง (และตอน build ยังไม่มี DATABASE_URL)
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string[] }> };

const thaiDate = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Asia/Bangkok",
});

export async function generateMetadata({ params }: Params) {
  const { slug } = await params;
  const path = `/${slug.join("/")}`;
  const meta = await pageMetadata(path);

  const page = await db.page
    .findUnique({ where: { slug: slug.join("/") }, select: { title: true, published: true } })
    .catch(() => null);
  if (!page) return meta;

  return {
    ...meta,
    title: page.title,
    // หน้าที่ยังไม่เผยแพร่ต้องไม่ให้ Google เก็บ ต่อให้สวิตช์ SEO เปิดอยู่
    robots: page.published ? meta.robots : { index: false, follow: false },
  };
}

export default async function ContentPage({ params }: Params) {
  const { slug } = await params;
  const page = await db.page.findUnique({ where: { slug: slug.join("/") } }).catch(() => null);
  if (!page) notFound();

  // ยังไม่เผยแพร่ = คนทั่วไปเจอหน้า 404 ส่วนเจ้าหน้าที่ที่ล็อกอินอยู่ดูตัวอย่างได้
  const user = page.published ? null : await currentUser();
  if (!page.published && !user) notFound();

  /*
    หน้าไหนมีหมุดอัตราดอกเบี้ยถึงจะไปอ่านค่าจากฐาน หน้าอื่นไม่ต้องเสียเวลา
    หน้าหนึ่งใส่ได้หมุดเดียว (เงินฝาก หรือ เงินกู้) ซึ่งพอสำหรับที่ใช้จริง
  */
  const wantsDeposit = page.body.includes(LIVE_DEPOSIT_RATES);
  const wantsLoan = page.body.includes(LIVE_LOAN_RATES);
  const rates = wantsDeposit || wantsLoan ? await getRates() : null;
  const html = repairStructure(localAssetsInHtml(page.body));
  const split = splitAtRates(html, wantsDeposit ? LIVE_DEPOSIT_RATES : LIVE_LOAN_RATES);
  const groups = rates ? (wantsDeposit ? groupDeposits(rates) : groupLoans(rates)) : null;
  // สวัสดิการ: อ่านตารางในเนื้อหาไปทำเป็นการ์ด — อ่านไม่ออกก็คืน null แล้วแสดงแบบเดิม
  const welfare = groups ? null : readWelfare(html);

  return (
    <>
      <PageTracker />
      <Header />
      {/* กว้างเท่าหัวเว็บกับหน้าแรก (max-w-6xl) — ทำเนียบ 4 คนต่อแถวกับตารางจะได้ไม่อึดอัด */}
      <main className="mx-auto w-full max-w-6xl px-4 py-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition hover:text-brand-600"
        >
          <ArrowLeft className="h-4 w-4" /> กลับหน้าแรก
        </Link>

        {!page.published && (
          <p className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-amber-200">
            <Eye className="h-4 w-4 shrink-0" />
            หน้านี้ยังไม่เผยแพร่ — คุณเห็นเพราะล็อกอินหลังบ้านอยู่ คนทั่วไปยังเข้าไม่ได้
          </p>
        )}

        <h1 className="mt-3 text-2xl font-bold leading-snug text-gray-800 md:text-3xl">
          {page.title}
        </h1>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-400">
          <CalendarDays className="h-4 w-4" /> ปรับปรุงล่าสุด {thaiDate.format(page.updatedAt)}
        </p>

        {/*
          ซ่อมโครงสร้างตอนแสดงผลด้วย — เนื้อหาเก่าที่บันทึกไว้ก่อนมีตัวซ่อมจะได้ไม่เพี้ยน

          หน้าที่มีหมุด live-deposit-rates จะถูกผ่าเป็นก่อน/หลังหมุด แล้ววาง <DepositRates>
          คั่นตรงกลาง · กรอบการ์ดขาวย้ายมาอยู่ชั้นนอก ทั้งสามชิ้นจึงอยู่ในการ์ดใบเดียวกัน
          ดูต่อเนื่องเหมือนเนื้อหาก้อนเดียว ไม่ใช่การ์ดขาวสองใบซ้อนกัน
        */}
        {groups ? (
          <div className="mt-5 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5 md:p-8">
            <PageContent html={split.before} />
            <RateSections groups={groups} />
            {split.after && <PageContent html={split.after} />}
          </div>
        ) : welfare ? (
          <div className="mt-5 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5 md:p-8">
            <PageContent html={welfare.before} />
            <WelfareSections groups={welfare.groups} tables={welfare.tables} />
            {welfare.after && <PageContent html={welfare.after} />}
          </div>
        ) : (
          <PageContent
            html={split.before}
            className="mt-5 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5 md:p-8"
          />
        )}
      </main>
      <BackToTop />
      <Footer />
    </>
  );
}
