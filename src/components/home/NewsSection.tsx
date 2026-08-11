"use client";

import { useState } from "react";
import Link from "next/link";
import { FileText, CalendarDays, ChevronLeft, ChevronRight, UserRound } from "lucide-react";
import Reveal from "@/components/ui/Reveal";
import SectionHeading from "@/components/ui/SectionHeading";
import { announcements, committees } from "@/data/home";

const TABS = ["ประกาศ", "จดหมายข่าว", "รายงานผลดำเนินงาน"];

function AnnouncementList() {
  return (
    <div className="flex h-full flex-col rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
      <p className="mb-3 border-b border-gray-100 pb-2 text-sm font-semibold text-brand-700">
        ประกาศ · ปีบัญชี 2569
      </p>
      <ul className="flex-1 divide-y divide-gray-100">
        {announcements.map((a) => (
          <li key={a.no}>
            <Link href={a.href} className="group flex items-start gap-3 py-3 transition hover:bg-brand-50/60 rounded-lg px-2 -mx-2">
              <FileText className="mt-0.5 h-5 w-5 shrink-0 text-brand-400" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-700 group-hover:text-brand-700">
                  ประกาศที่ {a.no} {a.title}
                </p>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-400">
                  <CalendarDays className="h-3.5 w-3.5" /> {a.date}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-500">
        <button className="grid h-7 w-7 place-items-center rounded-full border border-gray-200 hover:bg-gray-50">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span>หน้า 1 / 2</span>
        <button className="grid h-7 w-7 place-items-center rounded-full border border-gray-200 hover:bg-gray-50">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

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

function CommitteeCard() {
  const [i, setI] = useState(0);
  const n = committees.length;
  const c = committees[i];
  return (
    <div className="flex h-full flex-col rounded-2xl bg-white p-5 text-center shadow-sm ring-1 ring-black/5">
      <p className="text-sm font-semibold text-brand-700">คณะกรรมการชุดที่ 46</p>
      <div className="mt-4 grid min-h-48 w-full flex-1 place-items-center rounded-xl bg-gradient-to-b from-brand-100 to-brand-50">
        <UserRound className="h-16 w-16 text-brand-300" />
      </div>
      <p className="mt-4 text-base font-semibold text-gray-700">{c.name}</p>
      <p className="text-sm text-gray-400">{c.role}</p>
      <div className="mt-4 flex items-center justify-center gap-3">
        <button onClick={() => setI((v) => (v - 1 + n) % n)} className="grid h-7 w-7 place-items-center rounded-full border border-gray-200 hover:bg-gray-50">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex gap-1.5">
          {committees.map((_, idx) => (
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

export default function NewsSection() {
  const [tab, setTab] = useState(TABS[0]);
  return (
    <section className="bg-white py-12">
      <div className="mx-auto max-w-6xl px-4">
        <SectionHeading title="ประกาศ / จดหมายข่าว" subtitle="ประกาศและข่าวสารต่างๆ ของดูแลสมาชิกสหกรณ์ด้วยใจ" />

        <div className="mb-6 flex flex-wrap justify-start gap-2">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                tab === t ? "bg-brand-500 text-white shadow" : "bg-brand-50 text-brand-600 hover:bg-brand-100"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="grid items-stretch gap-6 lg:grid-cols-[1.7fr_1fr]">
          <Reveal className="h-full">
            <AnnouncementList />
          </Reveal>
          <Reveal delay={0.1} className="h-full">
            <CommitteeCard />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
