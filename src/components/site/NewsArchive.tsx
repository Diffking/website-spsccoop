"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FileText, BookOpen, CalendarDays, Search } from "lucide-react";
import TabBar from "@/components/ui/TabBar";
import {
  KINDS,
  KIND_HEADING,
  KIND_LABEL,
  announcementLine,
  readerHref,
  type Kind,
} from "@/lib/announcementKinds";
import type { AnnouncementItem } from "@/lib/content";

/**
 * หน้ารวมเอกสารทั้งหมด — ปลายทางของปุ่ม "ดูทั้งหมด →" ใต้การ์ดประกาศหน้าแรก
 *
 * ของเดิมปุ่มนั้นชี้ /news ซึ่ง **ไม่เคยมีหน้าอยู่จริง** กดแล้ว 404 มาตลอด
 * (ค้างไว้ตั้งแต่ 21 ส.ค. 2026) · การ์ดหน้าแรกโชว์ได้ทีละ 5 รายการ
 * ที่เหลือจึงไม่มีทางไปถึงเลยนอกจากรอให้สไลด์วนมา
 *
 * ⚠️ หมวดกับการตัดสินว่าอ่านแบบ E-Book หรือเปิดไฟล์ตรง ๆ ใช้ของกลางชุดเดียวกับหน้าแรก
 * (`announcementKinds.ts`) ห้ามเขียนกฎซ้ำที่นี่ ไม่งั้นวันหลังแก้ที่เดียวแล้วสองหน้าไม่ตรงกัน
 */
export default function NewsArchive({
  items,
  initialKind,
}: {
  items: AnnouncementItem[];
  /** หมวดที่เปิดค้างไว้ตอนเข้ามา — มาจาก ?kind= ที่ปุ่มบนหน้าแรกติดมาให้ */
  initialKind: Kind;
}) {
  const [kind, setKind] = useState<Kind>(initialKind);
  const [q, setQ] = useState("");

  const byKind = useMemo(
    () =>
      Object.fromEntries(KINDS.map((k) => [k, items.filter((a) => a.kind === k)])) as Record<
        Kind,
        AnnouncementItem[]
      >,
    [items],
  );

  const shown = useMemo(() => {
    const words = q.trim().toLowerCase();
    if (!words) return byKind[kind];
    return byKind[kind].filter((a) =>
      announcementLine(a.kind, a.number, a.title, a.hideNumber).toLowerCase().includes(words),
    );
  }, [byKind, kind, q]);

  return (
    <>
      <TabBar
        items={KINDS.map((k) => ({ value: k, label: KIND_LABEL[k], count: byKind[k].length }))}
        value={kind}
        onChange={(k) => setKind(k)}
        layoutId="news-archive"
        className="mb-4"
      />

      <label className="relative mb-5 block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`ค้นหาใน${KIND_HEADING[kind]}`}
          className="w-full rounded-full border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-brand-400"
        />
      </label>

      {shown.length === 0 ? (
        <p className="rounded-2xl bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">
          {q.trim() ? `ไม่พบเอกสารที่ตรงกับ “${q.trim()}”` : "ยังไม่มีเอกสารในหมวดนี้"}
        </p>
      ) : (
        // grid-cols-1 = ปลดล็อกความกว้างของช่อง ไม่งั้นหัวข้อไทยยาว ๆ ดันการ์ดจนล้นขอบ
        // (ภาษาไทยไม่มีช่องว่างระหว่างคำ ทั้งบรรทัดจึงนับเป็นคำเดียว — ดู AGENTS.md)
        <ul className="grid grid-cols-1 gap-2">
          {shown.map((a) => {
            const href = readerHref(a.kind, a.id, a.href);
            /*
             * ⚠️ ดูจาก **ปลายทางจริง** ไม่ใช่จากหมวด — จดหมายข่าว/รายงานกิจการที่ใส่เป็นลิงก์
             * ไปเว็บอื่น (ไม่ใช่ไฟล์ PDF) `readerHref` จะพาไปที่ลิงก์นั้นตรง ๆ ไม่ได้เข้าตัวอ่าน
             * ถ้าเช็คแค่ `KIND_EBOOK[kind]` จะติดป้าย "อ่านแบบ E-Book" ให้ทั้งที่กดแล้วออกนอกเว็บ
             */
            const ebook = !!href?.startsWith("/ebook/");
            const line = announcementLine(a.kind, a.number, a.title, a.hideNumber);

            const inner = (
              <>
                {ebook ? (
                  <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-brand-400" />
                ) : (
                  <FileText className="mt-0.5 h-5 w-5 shrink-0 text-brand-400" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-medium text-gray-700 group-hover:text-brand-700">
                    {a.badge && (
                      <span className="mr-1.5 inline-block rounded-full bg-accent-red px-2 py-0.5 align-middle text-[11px] font-bold leading-none text-white">
                        {a.badge}
                      </span>
                    )}
                    {line}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" /> {a.date}
                    </span>
                    {ebook && (
                      <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-600">
                        อ่านแบบ E-Book
                      </span>
                    )}
                    {!href && <span className="text-gray-300">ยังไม่มีไฟล์แนบ</span>}
                  </p>
                </div>
              </>
            );

            const shell =
              "group flex items-start gap-3 rounded-xl px-3 py-3 ring-1 ring-gray-100 transition";

            return (
              <li key={a.id} className="min-w-0">
                {href ? (
                  <Link href={href} className={`${shell} bg-white hover:bg-brand-50/60 hover:ring-brand-100`}>
                    {inner}
                  </Link>
                ) : (
                  // ไม่มีไฟล์ = ไม่ทำเป็นลิงก์ กดแล้วไม่มีอะไรเกิดขึ้นแย่กว่าไม่ให้กด
                  <div className={`${shell} bg-gray-50/60`}>{inner}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
