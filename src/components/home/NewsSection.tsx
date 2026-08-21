"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { FileText, BookOpen, CalendarDays, ChevronLeft, ChevronRight, UserRound } from "lucide-react";
import Reveal from "@/components/ui/Reveal";
import SectionHeading from "@/components/ui/SectionHeading";
import MaybeLink from "@/components/ui/MaybeLink";
import TabBar from "@/components/ui/TabBar";
import { COMMITTEE_PHOTO_BASE } from "@/lib/committee";
import type { AnnouncementItem } from "@/lib/content";
import type { Item } from "@/lib/homeItems";
import {
  KINDS,
  KIND_EBOOK,
  KIND_HEADING,
  KIND_LABEL,
  announcementLine,
  readerHref,
  type Kind,
} from "@/lib/announcementKinds";

const PER_PAGE = 5;

/*
 * จังหวะเลื่อนเอง — ตั้งคนละค่ากันตั้งใจ
 * ประกาศต้องกวาดตาอ่าน 5 บรรทัด ให้เวลานานกว่า · กรรมการมีชื่อเดียว อ่านจบไว
 * (แบนเนอร์สไลด์ใช้ 6500ms ดู SLIDE_MS ใน Hero.tsx)
 */
const LIST_AUTO_MS = 8000;
const COMMITTEE_AUTO_MS = 4500;

/**
 * เลื่อนเองวนไปเรื่อย ๆ — หยุดเมื่อเอาเมาส์ชี้ค้างไว้ จะได้อ่านทันและกดลิงก์ได้
 *
 * ผูก effect ไว้กับ `at` ด้วย การกดปุ่มเองจึงรีเซ็ตนาฬิกาใหม่ —
 * ไม่งั้นกดเปลี่ยนหน้าปุ๊บอาจโดนตัวเลื่อนอัตโนมัติแย่งเปลี่ยนต่อในเสี้ยววินาที
 */
function useAutoRotate(count: number, at: number, step: () => void, ms: number) {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused || count <= 1) return;
    const timer = setInterval(step, ms);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, count, at, ms]);
  return { onMouseEnter: () => setPaused(true), onMouseLeave: () => setPaused(false) };
}

function AnnouncementList({ items, kind }: { items: AnnouncementItem[]; kind: Kind }) {
  const reduce = useReducedMotion();
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(items.length / PER_PAGE));
  // กันหน้าค้างเกินขอบเวลาประกาศถูกลบจนเหลือน้อยลง
  const current = Math.min(page, pageCount - 1);
  const shown = items.slice(current * PER_PAGE, current * PER_PAGE + PER_PAGE);
  const hover = useAutoRotate(pageCount, current, () => setPage((p) => (p + 1) % pageCount), LIST_AUTO_MS);

  return (
    // overflow-hidden = ด่านสุดท้าย ไม่ว่าอะไรจะพลาด ข้อความต้องไม่ทะลุขอบการ์ดออกไป
    <div
      {...hover}
      className="flex h-full min-w-0 flex-col overflow-hidden rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5"
    >
      <p className="mb-3 border-b border-gray-100 pb-2 text-sm font-semibold text-brand-700">
        {KIND_HEADING[kind]}
      </p>

      {/*
        ล็อกจำนวนช่องของรายการไว้เท่ากับ PER_PAGE เสมอ — หน้าสุดท้ายที่มีไม่ครบจะได้ไม่หดสั้น
        แล้วปุ่มเปลี่ยนหน้าด้านล่างเด้งขึ้นลงตอนกดไปมา
      */}
      {items.length === 0 ? (
        <p className="flex-1 grid place-items-center py-10 text-center text-sm text-gray-400">
          ยังไม่มี{KIND_LABEL[kind]}
        </p>
      ) : (
        /*
          grid-cols-1 สำคัญกว่าที่เห็น — Tailwind แปลเป็น `minmax(0, 1fr)` ซึ่งบอกว่า
          "ช่องนี้แคบกว่าเนื้อหาได้" ถ้าไม่ใส่ ช่องจะกว้างตาม min-content ของหัวข้อประกาศ
          แล้ว truncate จะไม่มีอะไรให้ตัด (กล่องกว้างเท่าข้อความพอดี) หัวข้อยาวจึงทะลุขอบการ์ด
          ออกไปโดยไม่มี "…" · ภาษาไทยไม่มีช่องว่างระหว่างคำ ทั้งประโยคจึงนับเป็นคำเดียว
          min-content เลยยาวเท่าข้อความทั้งบรรทัด — เรื่องนี้เจอเฉพาะภาษาไทย
        */
        /*
          เปลี่ยนหน้าแบบค่อย ๆ จาง ชุดเดียวกับตารางดอกเบี้ยใน Hero.tsx
          `mode="wait"` = หน้าเก่าจางหายให้จบก่อน หน้าใหม่ค่อยขึ้น ไม่มีสองชุดซ้อนกัน

          ⚠️ กรอบ `relative flex-1` ต้องอยู่ชั้นนอก AnimatePresence เสมอ ห้ามย้าย flex-1
          ไปไว้ที่ <ul> — ระหว่างที่หน้าเก่าจางหายจบแล้วหน้าใหม่ยังไม่ขึ้น จะมีหนึ่งเฟรม
          ที่ไม่มี <ul> อยู่เลย ถ้าที่ว่างไม่ถูกค้ำไว้ ปุ่มเปลี่ยนหน้ากับปุ่ม "ดูทั้งหมด"
          ข้างล่างจะกระพริบขึ้นลงทุกครั้งที่วน
        */
        <div className="relative flex-1">
        <AnimatePresence mode="wait" initial={false}>
        <motion.ul
          key={current}
          initial={{ opacity: 0, y: reduce ? 0 : 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: reduce ? 0 : -6 }}
          transition={{ duration: reduce ? 0 : 0.45, ease: "easeOut" }}
          style={{ gridTemplateRows: `repeat(${PER_PAGE}, minmax(4.25rem, auto))` }}
          className="grid h-full grid-cols-1 divide-y divide-gray-100"
        >
          {shown.map((a) => (
            // min-w-0 ซ้ำอีกชั้น — ช่องกริดยอมแคบแล้ว ตัวรายการก็ต้องยอมแคบตามด้วย
            <li key={a.id} className="min-w-0">
              <MaybeLink
                href={readerHref(a.kind, a.id, a.href)}
                className="group flex items-start gap-3 py-3 transition hover:bg-brand-50/60 rounded-lg px-2 -mx-2"
              >
                {KIND_EBOOK[a.kind] && a.href && a.href !== "#" ? (
                  <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-brand-400" />
                ) : (
                  <FileText className="mt-0.5 h-5 w-5 shrink-0 text-brand-400" />
                )}
                <div className="min-w-0 flex-1">
                  <p
                    title={announcementLine(a.kind, a.number, a.title, a.hideNumber)}
                    className="truncate text-sm font-medium text-gray-700 group-hover:text-brand-700"
                  >
                    {a.badge && (
                      <span className="mr-1.5 inline-block rounded-full bg-accent-red px-2 py-0.5 align-middle text-[11px] font-bold leading-none text-white">
                        {a.badge}
                      </span>
                    )}
                    {announcementLine(a.kind, a.number, a.title, a.hideNumber)}
                  </p>
                  <p className="mt-0.5 flex items-center gap-2 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" /> {a.date}
                    </span>
                    {KIND_EBOOK[a.kind] && a.href && a.href !== "#" && (
                      <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-600">
                        อ่านแบบ E-Book
                      </span>
                    )}
                  </p>
                </div>
              </MaybeLink>
            </li>
          ))}
        </motion.ul>
        </AnimatePresence>
        </div>
      )}

      {pageCount > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-500">
          <button
            onClick={() => setPage(current - 1)}
            disabled={current === 0}
            aria-label="หน้าก่อนหน้า"
            className="grid h-7 w-7 place-items-center rounded-full border border-gray-200 transition hover:bg-gray-50 disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="tabular-nums">หน้า {current + 1} / {pageCount}</span>
          <button
            onClick={() => setPage(current + 1)}
            disabled={current >= pageCount - 1}
            aria-label="หน้าถัดไป"
            className="grid h-7 w-7 place-items-center rounded-full border border-gray-200 transition hover:bg-gray-50 disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="mt-4 text-center">
        <Link
          href="/news"
          className="inline-flex items-center gap-1 rounded-full bg-accent-amber px-5 py-2 text-sm font-semibold text-white shadow transition hover:brightness-105"
        >
          ดูทั้งหมด →
        </Link>
      </div>
    </div>
  );
}

function CommitteeCard({
  members,
  set,
  photoScale,
}: {
  members: Item[];
  set: number;
  /** % ของกรอบเต็ม 220x300 — เลือกได้ที่ /admin/home/committees */
  photoScale: number;
}) {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  const n = members.length;
  const c = members[Math.min(i, Math.max(0, n - 1))];
  const hover = useAutoRotate(n, i, () => setI((v) => (v + 1) % n), COMMITTEE_AUTO_MS);

  if (n === 0) return null;

  return (
    // min-w-0 + overflow-hidden ด้วยเหตุผลเดียวกับการ์ดประกาศ — ชื่อกรรมการยาว ๆ
    // เป็นภาษาไทยติดกันทั้งบรรทัด ต้องยอมให้การ์ดแคบกว่าชื่อได้ line-clamp ถึงจะทำงาน
    <div
      {...hover}
      className="flex h-full min-w-0 flex-col overflow-hidden rounded-2xl bg-white p-5 text-center shadow-sm ring-1 ring-black/5"
    >
      {/*
        ต้องเป็น "คณะกรรมการดำเนินการ" เต็ม ๆ ไม่ใช่ "คณะกรรมการ" ลอย ๆ
        สหกรณ์มีคณะกรรมการหลายชุด (ดำเนินการ · สรรหา · ผู้ตรวจสอบกิจการ)
        เรียกสั้นแล้วสมาชิกแยกไม่ออกว่าการ์ดนี้เป็นชุดไหน
      */}
      <p className="text-sm font-semibold text-brand-700">คณะกรรมการดำเนินการชุดที่ {set}</p>
      {/*
        object-contain ไม่ใช่ object-cover — รูปกรรมการเป็นภาพคนถ่ายติดหัวไหล่
        ถ้าครอบให้เต็มกรอบจะโดนตัดหัวตัดตา ยอมมีขอบว่างข้างรูปดีกว่าเห็นหน้าไม่ครบ
        กรอบขนาดคงที่ การ์ดจึงไม่ขยับตามสัดส่วนรูปที่แต่ละคนอัปมาไม่เท่ากัน
      */}
      {/*
        ห่อรูป+ชื่อ+ตำแหน่งเป็นก้อนเดียวแล้วจางทั้งก้อนตอนเปลี่ยนคน
        กรอบนอกถือ flex-1 ไว้เอง (เหตุผลเดียวกับการ์ดประกาศ — กันปุ่มข้างล่างกระพริบ)
        ส่วนก้อนข้างในยังให้บรรทัดชื่อถือ flex-1 ต่อ ระยะห่างจึงกระจายเหมือนเดิมเป๊ะ
      */}
      <div className="min-h-0 min-w-0 flex-1">
      <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={i}
        initial={{ opacity: 0, y: reduce ? 0 : 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: reduce ? 0 : -6 }}
        transition={{ duration: reduce ? 0 : 0.4, ease: "easeOut" }}
        className="flex h-full min-w-0 flex-col"
      >
      <div
        style={{
          width: (COMMITTEE_PHOTO_BASE.width * photoScale) / 100,
          height: (COMMITTEE_PHOTO_BASE.height * photoScale) / 100,
        }}
        className="mx-auto mt-4 grid max-w-full place-items-center overflow-hidden rounded-xl bg-gradient-to-b from-brand-100 to-brand-50"
      >
        {c.imageUrl ? (
          // รูปมาจากหลังบ้าน ไม่รู้ขนาดล่วงหน้า จึงใช้ <img> ธรรมดา
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.imageUrl} alt={c.title} className="h-full w-full object-contain" />
        ) : (
          <UserRound className="h-16 w-16 text-brand-300" />
        )}
      </div>
      <p className="mt-4 line-clamp-1 flex-1 text-base font-semibold text-gray-700" title={c.title}>
        {c.title}
      </p>
      {/*
        กันบรรทัดตำแหน่งหายตอนเจอคนที่ไม่ได้กรอกตำแหน่งไว้ — ถ้าปล่อยให้หาย
        การ์ดจะเตี้ยลงหนึ่งบรรทัดแล้วกระตุกทุกครั้งที่กดเปลี่ยนคน
      */}
      <p className="line-clamp-1 min-h-[1.25rem] text-sm text-gray-400" title={c.subtitle ?? ""}>
        {c.subtitle}
      </p>
      </motion.div>
      </AnimatePresence>
      </div>
      <div className="mt-4 flex items-center justify-center gap-3">
        <button onClick={() => setI((v) => (v - 1 + n) % n)} className="grid h-7 w-7 place-items-center rounded-full border border-gray-200 hover:bg-gray-50">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex gap-1.5">
          {members.map((_, idx) => (
            <span key={idx} className={`h-2 rounded-full transition-all ${idx === i ? "w-5 bg-brand-500" : "w-2 bg-gray-300"}`} />
          ))}
        </div>
        <button onClick={() => setI((v) => (v + 1) % n)} className="grid h-7 w-7 place-items-center rounded-full border border-gray-200 hover:bg-gray-50">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-4 text-center">
        <Link
          href="/about/directory/board"
          className="inline-flex items-center gap-1 rounded-full bg-accent-amber px-5 py-2 text-sm font-semibold text-white shadow transition hover:brightness-105"
        >
          ดูทั้งหมด →
        </Link>
      </div>
    </div>
  );
}

export default function NewsSection({
  announcements,
  committees,
  committeeSet,
  committeePhotoScale,
  bg = "bg-white",
}: {
  announcements: AnnouncementItem[];
  committees: Item[];
  committeeSet: number;
  committeePhotoScale: number;
  /** คลาสพื้นหลังของส่วนนี้ — กำหนดได้ที่ /admin/home */
  bg?: string;
}) {
  const [tab, setTab] = useState<Kind>(KINDS[0]);
  // แยกครั้งเดียวแล้วใช้ทุกแท็บ ไม่ต้องกรองใหม่ทุกครั้งที่กดสลับ
  const byKind = { ANNOUNCEMENT: [], NEWSLETTER: [], REPORT: [] } as Record<Kind, AnnouncementItem[]>;
  for (const a of announcements) byKind[a.kind]?.push(a);
  return (
    <section className={`${bg} py-12`}>
      <div className="mx-auto max-w-6xl px-4">
        <SectionHeading title="ประกาศ / จดหมายข่าว" subtitle="ประกาศและข่าวสารต่างๆ ของดูแลสมาชิกสหกรณ์ด้วยใจ" />

        <TabBar
          className="mb-6"
          layoutId="home-news-tab"
          value={tab}
          onChange={setTab}
          items={KINDS.map((t) => ({ value: t, label: KIND_LABEL[t], count: byKind[t].length }))}
        />

        <div className="grid items-stretch gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
          {/* min-w-0 = ห้ามช่องกริดกว้างตามเนื้อหา ไม่งั้นประกาศชื่อยาวจะดันการ์ดกว้างไม่เท่ากันทุกแท็บ */}
          <Reveal className="h-full min-w-0">
            {/* key={tab} ให้เริ่มที่หน้า 1 ใหม่ทุกครั้งที่สลับแท็บ */}
            <AnnouncementList key={tab} items={byKind[tab]} kind={tab} />
          </Reveal>
          <Reveal delay={0.1} className="h-full min-w-0">
            <CommitteeCard
              members={committees}
              set={committeeSet}
              photoScale={committeePhotoScale}
            />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
