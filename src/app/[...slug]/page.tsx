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
import { LIVE_VAN_SCHEDULE, fillVanSchedule, getVanSchedule } from "@/lib/liveVan";
import RateSections from "@/components/site/RateSections";
import DirectoryNav from "@/components/site/DirectoryNav";
import { directorySections } from "@/lib/directoryNav";
import WelfareSections from "@/components/site/WelfareSections";
import { readWelfare } from "@/lib/welfareGroups";
import { readDocTables } from "@/lib/pageDocs";
import { groupDeposits, groupLoans } from "@/lib/rateGroups";
import { getRates } from "@/lib/settings";
import { Wrench } from "lucide-react";
import { UPDATING_DEFAULT_NOTE } from "@/lib/pageUpdating";

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
    .findUnique({ where: { slug: slug.join("/") }, select: { title: true, published: true, updating: true } })
    .catch(() => null);
  if (!page) return meta;

  return {
    ...meta,
    title: page.title,
    // หน้าที่ยังไม่เผยแพร่ต้องไม่ให้ Google เก็บ ต่อให้สวิตช์ SEO เปิดอยู่
    // ระหว่างอัปเดตข้อมูลก็ไม่ให้เก็บ — ไม่งั้นผลค้นหาจะเป็นกล่องแจ้งแทนเนื้อหาจริง
    robots: page.published && !page.updating ? meta.robots : { index: false, follow: false },
  };
}

export default async function ContentPage({ params }: Params) {
  const { slug } = await params;
  const page = await db.page.findUnique({ where: { slug: slug.join("/") } }).catch(() => null);
  if (!page) notFound();

  // ยังไม่เผยแพร่ = คนทั่วไปเจอหน้า 404 ส่วนเจ้าหน้าที่ที่ล็อกอินอยู่ดูตัวอย่างได้
  const user = page.published && !page.updating ? null : await currentUser();
  if (!page.published && !user) notFound();

  /*
   * กำลังอัปเดตข้อมูล — คนทั่วไป (รวมตัวมิเรอร์ .com) เห็นกล่องแจ้งแทนเนื้อหาเก่า
   * ตอบ 200 ตั้งใจ ห้ามเปลี่ยนเป็น 503 (ดู src/lib/pageUpdating.ts)
   */
  if (page.updating && !user) {
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
          <h1 className="mt-3 text-2xl font-bold leading-snug text-gray-800 md:text-3xl">{page.title}</h1>
          <div className="mt-5 flex flex-col items-center rounded-2xl bg-white px-6 py-14 text-center shadow-sm ring-1 ring-black/5">
            <span className="grid h-16 w-16 place-items-center rounded-2xl bg-amber-50 text-amber-600 ring-1 ring-amber-200">
              <Wrench className="h-8 w-8" aria-hidden="true" />
            </span>
            <p className="mt-5 text-xl font-bold text-brand-800">อยู่ระหว่างอัปเดตข้อมูล</p>
            <p className="mt-2 max-w-xl text-sm leading-7 text-gray-600 sm:text-base">
              {page.updatingNote || UPDATING_DEFAULT_NOTE}
            </p>
            <Link
              href="/"
              className="mt-6 inline-flex min-h-11 items-center rounded-full bg-brand-600 px-5 text-sm font-semibold text-white shadow transition hover:bg-brand-700"
            >
              กลับหน้าหลัก
            </Link>
          </div>
        </main>
        <BackToTop />
        <Footer />
      </>
    );
  }

  /*
    หน้าไหนมีหมุดอัตราดอกเบี้ยถึงจะไปอ่านค่าจากฐาน หน้าอื่นไม่ต้องเสียเวลา
    หน้าหนึ่งใส่ได้หมุดเดียว (เงินฝาก หรือ เงินกู้) ซึ่งพอสำหรับที่ใช้จริง
  */
  const wantsDeposit = page.body.includes(LIVE_DEPOSIT_RATES);
  const wantsLoan = page.body.includes(LIVE_LOAN_RATES);
  const rates = wantsDeposit || wantsLoan ? await getRates() : null;
  // ตารางรถตู้ออกหน่วย — อ่านฐานเฉพาะหน้าที่มีหมุด (ดู src/lib/liveVan.ts)
  const vanRows = page.body.includes(LIVE_VAN_SCHEDULE) ? await getVanSchedule() : null;
  const repaired = repairStructure(localAssetsInHtml(page.body));
  const html = vanRows ? fillVanSchedule(repaired, vanRows) : repaired;
  const split = splitAtRates(html, wantsDeposit ? LIVE_DEPOSIT_RATES : LIVE_LOAN_RATES);
  /*
    หน้าเงินให้กู้/เงินรับฝาก: ดึงตารางระเบียบ/แบบฟอร์มท้ายหน้าออกมา
    แล้วเอาไปแปะกับการ์ดอัตราของประเภทที่ตรงกัน — ที่เหลือ (`rest`) คือส่วนอื่นของหน้า
    เช่น "สอบถามเพิ่มเติม" ซึ่งคงอยู่ที่เดิมตามลำดับเดิม
  */
  const rateDocs = rates && split.after ? readDocTables(split.after) : null;
  const groups = rates
    ? wantsDeposit
      ? groupDeposits(rates, rateDocs?.tables.flatMap((t) => t.docs) ?? [])
      : groupLoans(rates, rateDocs?.tables.flatMap((t) => t.docs) ?? [])
    : null;
  // สวัสดิการ: อ่านตารางในเนื้อหาไปทำเป็นการ์ด — อ่านไม่ออกก็คืน null แล้วแสดงแบบเดิม
  const welfare = groups ? null : readWelfare(html);
  // หน้าทำเนียบที่แบ่งกลุ่มด้วย <h2> (เช่น เจ้าหน้าที่) → มีแถบนำทางชื่อฝ่ายด้านซ้าย
  const dir = groups || welfare ? null : directorySections(split.before);

  return (
    <>
      <PageTracker />
      <Header />
      {/* กว้างเท่าหัวเว็บกับหน้าแรก (max-w-6xl) — ทำเนียบ 4 คนต่อแถวกับตารางจะได้ไม่อึดอัด */}
      {/* หน้าที่มีแถบนำทางซ้ายกว้างขึ้นหนึ่งขั้น (max-w-7xl) เนื้อหาจะได้กว้างเท่าเดิมโดยประมาณ */}
      <main className={`mx-auto w-full ${dir ? "max-w-7xl" : "max-w-6xl"} px-4 py-8`}>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition hover:text-brand-600"
        >
          <ArrowLeft className="h-4 w-4" /> กลับหน้าแรก
        </Link>

        {page.updating && (
          <p className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-amber-200">
            <Wrench className="h-4 w-4 shrink-0" />
            เปิด “กำลังอัปเดตข้อมูล” อยู่ — สมาชิกเห็นกล่องแจ้งอัปเดต ไม่เห็นเนื้อหานี้ · คุณเห็นเพราะล็อกอินหลังบ้านอยู่
          </p>
        )}

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
            <RateSections groups={groups} tables={rateDocs?.tables ?? []} />
            {rateDocs ? (
              rateDocs.rest && <PageContent html={rateDocs.rest} />
            ) : (
              split.after && <PageContent html={split.after} />
            )}
          </div>
        ) : welfare ? (
          <div className="mt-5 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5 md:p-8">
            <PageContent html={welfare.before} />
            <WelfareSections groups={welfare.groups} tables={welfare.tables} />
            {welfare.after && <PageContent html={welfare.after} />}
          </div>
        ) : dir ? (
          /* minmax(0,…) ทั้งสองช่อง — กันชื่อไทยยาว ๆ ดันคอลัมน์ (ดูกฎกริดใน AGENTS.md) */
          <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] lg:items-start">
            <DirectoryNav sections={dir.sections} />
            <PageContent
              html={dir.html}
              className="dir-page min-w-0 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5 md:p-8"
            />
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
