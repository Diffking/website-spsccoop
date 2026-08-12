"use client";

import { useState } from "react";
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

function AnnouncementList({ items, kind }: { items: AnnouncementItem[]; kind: Kind }) {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(items.length / PER_PAGE));
  // กันหน้าค้างเกินขอบเวลาประกาศถูกลบจนเหลือน้อยลง
  const current = Math.min(page, pageCount - 1);
  const shown = items.slice(current * PER_PAGE, current * PER_PAGE + PER_PAGE);

  return (
    <div className="flex h-full flex-col rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
      <p className="mb-3 border-b border-gray-100 pb-2 text-sm font-semibold text-brand-700">
        {KIND_HEADING[kind]}
      </p>

      {items.length === 0 ? (
        <p className="flex-1 grid place-items-center py-10 text-center text-sm text-gray-400">
          ยังไม่มี{KIND_LABEL[kind]}
        </p>
      ) : (
        <ul className="flex-1 divide-y divide-gray-100">
          {shown.map((a) => (
            <li key={a.id} className="min-h-[4.25rem]">
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
        </ul>
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
  const [i, setI] = useState(0);
  const n = members.length;
  const c = members[Math.min(i, Math.max(0, n - 1))];

  if (n === 0) return null;

  return (
    <div className="flex h-full flex-col rounded-2xl bg-white p-5 text-center shadow-sm ring-1 ring-black/5">
      <p className="text-sm font-semibold text-brand-700">คณะกรรมการชุดที่ {set}</p>
      {/*
        object-contain ไม่ใช่ object-cover — รูปกรรมการเป็นภาพคนถ่ายติดหัวไหล่
        ถ้าครอบให้เต็มกรอบจะโดนตัดหัวตัดตา ยอมมีขอบว่างข้างรูปดีกว่าเห็นหน้าไม่ครบ
        กรอบขนาดคงที่ การ์ดจึงไม่ขยับตามสัดส่วนรูปที่แต่ละคนอัปมาไม่เท่ากัน
      */}
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
      <p className="line-clamp-1 text-sm text-gray-400" title={c.subtitle ?? ""}>
        {c.subtitle}
      </p>
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
}: {
  announcements: AnnouncementItem[];
  committees: Item[];
  committeeSet: number;
  committeePhotoScale: number;
}) {
  const [tab, setTab] = useState<Kind>(KINDS[0]);
  // แยกครั้งเดียวแล้วใช้ทุกแท็บ ไม่ต้องกรองใหม่ทุกครั้งที่กดสลับ
  const byKind = { ANNOUNCEMENT: [], NEWSLETTER: [], REPORT: [] } as Record<Kind, AnnouncementItem[]>;
  for (const a of announcements) byKind[a.kind]?.push(a);
  return (
    <section className="bg-white py-12">
      <div className="mx-auto max-w-6xl px-4">
        <SectionHeading title="ประกาศ / จดหมายข่าว" subtitle="ประกาศและข่าวสารต่างๆ ของดูแลสมาชิกสหกรณ์ด้วยใจ" />

        <TabBar
          className="mb-6"
          layoutId="home-news-tab"
          value={tab}
          onChange={setTab}
          items={KINDS.map((t) => ({ value: t, label: KIND_LABEL[t], count: byKind[t].length }))}
        />

        <div className="grid items-stretch gap-6 lg:grid-cols-[1.7fr_1fr]">
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
