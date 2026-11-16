"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, CalendarDays, ChevronLeft, ChevronRight, ExternalLink, Images, MapPin } from "lucide-react";
import SectionHeading from "@/components/ui/SectionHeading";
import SlideProgress from "@/components/ui/SlideProgress";
import { useAutoRotate } from "@/lib/useAutoRotate";
import { SLIDE_TIMING, STACKED, fadeSwap } from "@/lib/slideMotion";
import { albumDateLabel } from "@/lib/galleryShared";
import type { GalleryAlbumView } from "@/lib/gallery";

const SLIDE_MS = SLIDE_TIMING.gallery.every;

/**
 * สไลด์ภาพกิจกรรมบนหน้าแรก (Phase 2 แกลเลอรี · 16 พ.ย. 2569)
 *
 * อ่านอัลบั้มที่ติ๊ก "แสดงบนหน้าแรก" จากหลังบ้าน → ภาพกิจกรรม · ท่าเดียวกับแบนเนอร์ประชาสัมพันธ์:
 * `useAutoRotate` (เริ่มเมื่อเลื่อนมาเห็น · หยุดตอนชี้เมาส์) + `fadeSwap`/`STACKED` + หลอดนับถอยหลัง
 *
 * ⚠️ กรอบล็อกสัดส่วนไว้ทุกขนาดจอ + ตัวหนังสือ line-clamp ทุกบรรทัด — ชื่อกิจกรรมยาวไม่เท่ากัน
 * ถ้าไม่ล็อก การ์ดจะสูงต่ำตามสไลด์แล้วหน้าเว็บกระตุกทุกครั้งที่วน (กฎใน AGENTS.md)
 * ⚠️ ภาพถ่ายใช้ object-cover (เต็มกรอบ ตัดขอบ) ต่างจากโปสเตอร์ในแบนเนอร์ที่ใช้ object-contain
 */
export default function GallerySlides({ albums, bg = "bg-white" }: { albums: GalleryAlbumView[]; bg?: string }) {
  const [i, setI] = useState(0);
  const n = albums.length;
  const go = (d: number) => setI((v) => (v + d + n) % n);
  const frame = useRef<HTMLDivElement>(null);
  const auto = useAutoRotate({
    target: frame,
    count: n,
    at: i,
    step: () => setI((v) => (v + 1) % n),
    ms: SLIDE_MS,
  });

  if (n === 0) return null;
  const a = albums[Math.min(i, n - 1)];

  return (
    <section className={`${bg} py-12`}>
      <div className="mx-auto max-w-6xl px-4">
        <SectionHeading title="ภาพกิจกรรมสหกรณ์" en="Activities" subtitle="บรรยากาศกิจกรรมล่าสุด · กดดูภาพทั้งหมดของแต่ละกิจกรรมได้" />

        <div
          ref={frame}
          {...auto.hover}
          className="relative grid aspect-[4/5] overflow-hidden rounded-3xl bg-gradient-to-br from-white via-sky-50 to-brand-50 shadow-[0_22px_55px_-20px_rgb(15_83_144_/_.5)] ring-1 ring-brand-100 sm:aspect-[16/10] md:aspect-[16/8]"
        >
          <AnimatePresence>
            <motion.div
              key={a.id}
              {...fadeSwap(SLIDE_TIMING.gallery.fade)}
              style={STACKED}
              // มือถือ: ภาพบน ข้อความล่าง · จอกว้าง: ข้อความซ้าย ภาพขวา — minmax(0,…) กันชื่อยาวดันคอลัมน์
              className="grid h-full min-h-0 grid-rows-[minmax(0,1.15fr)_minmax(0,1fr)] md:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] md:grid-rows-1"
            >
              <a
                href={a.albumUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`เปิดอัลบั้ม ${a.title}`}
                className="relative block min-h-0 overflow-hidden md:order-2"
              >
                <motion.div
                  // ซูมเข้าช้า ๆ ตลอดช่วงที่ค้าง (เหมือนแบนเนอร์) ให้ภาพนิ่งดูมีชีวิต
                  initial={{ scale: 1 }}
                  animate={{ scale: 1.05 }}
                  transition={{ duration: SLIDE_MS / 1000, ease: "linear" }}
                  className="absolute inset-0"
                >
                  <Image
                    src={a.coverUrl}
                    alt={a.title}
                    fill
                    sizes="(min-width: 768px) 60vw, 100vw"
                    className="object-cover"
                  />
                </motion.div>
                {a.photoCount ? (
                  <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-brand-800 shadow-sm">
                    <Images className="h-3.5 w-3.5" aria-hidden="true" />
                    {a.photoCount.toLocaleString("th-TH")} ภาพ
                  </span>
                ) : null}
              </a>

              <div className="flex min-h-0 min-w-0 flex-col justify-center gap-2 px-5 pb-6 pt-4 sm:gap-3 sm:px-8 md:order-1 md:px-10 md:py-10">
                <h3 className="line-clamp-2 text-lg font-bold leading-snug text-brand-800 sm:text-xl md:line-clamp-3 md:text-2xl">
                  {a.title}
                </h3>
                <span aria-hidden className="block h-1 w-16 rounded-full bg-gradient-to-r from-brand-600 to-brand-400" />
                <div className="flex min-w-0 flex-col gap-1 text-sm text-gray-700">
                  <span className="flex min-w-0 items-center gap-2">
                    <CalendarDays className="h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
                    <span className="truncate">{albumDateLabel(new Date(a.eventDate))}</span>
                  </span>
                  {a.place && (
                    <span className="flex min-w-0 items-center gap-2">
                      <MapPin className="h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
                      <span className="truncate">{a.place}</span>
                    </span>
                  )}
                </div>
                {a.caption && (
                  <p className="hidden text-sm leading-relaxed text-gray-600 sm:line-clamp-2 md:line-clamp-3">{a.caption}</p>
                )}
                <a
                  href={a.albumUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex min-h-11 items-center gap-2 self-start rounded-full bg-brand-600 px-5 text-sm font-semibold text-white shadow transition hover:bg-brand-700"
                >
                  ดูภาพทั้งหมด
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                </a>
              </div>
            </motion.div>
          </AnimatePresence>

          <SlideProgress ms={SLIDE_MS} at={i} paused={auto.paused} className="absolute inset-x-0 bottom-0 z-20" />
        </div>

        {/* ปุ่มเลื่อนอยู่นอกกรอบ — ไม่ลอยทับตัวหนังสือหรือภาพ (บทเรียนจากแบนเนอร์ 26 ส.ค. 2026) */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          {n > 1 ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => go(-1)}
                aria-label="กิจกรรมก่อนหน้า"
                className="grid h-11 w-11 place-items-center rounded-full bg-white text-brand-700 shadow ring-1 ring-brand-100 transition hover:bg-brand-50"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <div className="flex items-center gap-1.5">
                {albums.map((album, idx) => (
                  <button
                    key={album.id}
                    type="button"
                    aria-label={`ไปกิจกรรมที่ ${idx + 1}`}
                    aria-current={idx === i}
                    onClick={() => setI(idx)}
                    className={`h-2 rounded-full transition-all ${idx === i ? "w-7 bg-brand-600" : "w-2 bg-brand-200 hover:bg-brand-400"}`}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={() => go(1)}
                aria-label="กิจกรรมถัดไป"
                className="grid h-11 w-11 place-items-center rounded-full bg-white text-brand-700 shadow ring-1 ring-brand-100 transition hover:bg-brand-50"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <span />
          )}
          <Link
            href="/gallery/"
            className="inline-flex min-h-11 items-center gap-1 rounded-full bg-accent-amber px-5 text-sm font-semibold text-white shadow transition hover:brightness-105"
          >
            ดูกิจกรรมทั้งหมด <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
