"use client";

import { useState, useEffect, useCallback } from "react";
import Image, { type StaticImageData } from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronLeft, ChevronRight, ZoomIn, X } from "lucide-react";
import { activitySlides } from "@/data/home";
import type { InterestRates } from "@/lib/settings";

/** สไลด์มาจากฐาน (แก้ที่ /admin/home) — ถ้ายังไม่มี ใช้ชุดที่ติดมากับโค้ดแทน */
export type HeroSlide = { src: string | StaticImageData; title: string; desc: string; href: string };

const SLIDE_MS = 6500; // เลื่อนช้าๆ ไม่เร็วเกินไป

function BannerSlider({ slides }: { slides: HeroSlide[] }) {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [zoom, setZoom] = useState(false);
  const n = slides.length;
  const go = useCallback((d: number) => setI((v) => (v + d + n) % n), [n]);
  const slide = slides[i];

  // autoplay ช้าๆ (หยุดตอนเอาเมาส์ชี้ หรือเปิดภาพใหญ่)
  useEffect(() => {
    if (paused || zoom) return;
    const t = setInterval(() => setI((v) => (v + 1) % n), SLIDE_MS);
    return () => clearInterval(t);
  }, [paused, zoom, n]);

  // คีย์ลัดตอนเปิดภาพใหญ่
  useEffect(() => {
    if (!zoom) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZoom(false);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoom, go]);

  return (
    <>
      <div
        className="group relative aspect-[16/10] overflow-hidden rounded-2xl border border-sky-200 bg-sky-50 shadow-lg"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {/* crossfade: ข้อความด้านซ้าย + ภาพด้านขวา */}
        <AnimatePresence>
          <motion.div
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, ease: "easeInOut" }}
            onClick={() => setZoom(true)}
            className="absolute inset-0 grid cursor-zoom-in grid-cols-[1.05fr_1fr] items-center gap-3 p-5 sm:gap-5 sm:p-7"
          >
            {/* ข้อความด้านซ้าย (ตัวใหญ่) */}
            <div className="text-left">
              <motion.h3
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.5 }}
                className="text-lg font-bold leading-snug text-brand-700 sm:text-xl md:text-2xl"
              >
                {slide.title}
              </motion.h3>
              {slide.desc && (
                <motion.p
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.28, duration: 0.5 }}
                  className="mt-2 line-clamp-4 text-sm leading-relaxed text-gray-600 sm:mt-3 sm:text-base"
                >
                  {slide.desc}
                </motion.p>
              )}
            </div>
            {/* ภาพด้านขวา */}
            <motion.div
              // ภาพค่อยๆ ซูมเข้าช้าๆ ตลอดช่วงที่สไลด์ค้างอยู่ (Ken Burns) ให้ภาพนิ่งดูมีชีวิต
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, scale: reduce ? 1 : 1.04 }}
              transition={{
                opacity: { duration: 0.6, ease: "easeOut" },
                scale: { duration: SLIDE_MS / 1000, ease: "linear" },
              }}
              className="relative h-full"
            >
              <Image
                src={slide.src}
                alt={slide.title}
                fill
                priority={i === 0}
                sizes="(max-width: 768px) 45vw, 30vw"
                className="object-contain object-right drop-shadow-md"
              />
            </motion.div>
          </motion.div>
        </AnimatePresence>

        {/* ป้ายชวนคลิกดูภาพใหญ่ — เด่นขึ้นตอน hover (mouseover) */}
        <span className="pointer-events-none absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-brand-700/80 px-3 py-1 text-xs font-medium text-white shadow transition group-hover:bg-brand-700">
          <ZoomIn className="h-3.5 w-3.5" /> คลิกดูภาพใหญ่
        </span>

        <button
          onClick={() => go(-1)}
          aria-label="ก่อนหน้า"
          className="absolute left-3 top-1/2 z-10 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white text-brand-600 shadow ring-1 ring-black/5 opacity-0 transition group-hover:opacity-100 hover:bg-brand-50 focus-visible:opacity-100"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          onClick={() => go(1)}
          aria-label="ถัดไป"
          className="absolute right-3 top-1/2 z-10 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white text-brand-600 shadow ring-1 ring-black/5 opacity-0 transition group-hover:opacity-100 hover:bg-brand-50 focus-visible:opacity-100"
        >
          <ChevronRight className="h-5 w-5" />
        </button>

        <div className="absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 gap-2">
          {slides.map((_, idx) => (
            <button
              key={idx}
              aria-label={`สไลด์ ${idx + 1}`}
              onClick={() => setI(idx)}
              className={`h-2 rounded-full transition-all ${idx === i ? "w-6 bg-brand-500" : "w-2 bg-brand-200 hover:bg-brand-300"}`}
            />
          ))}
        </div>
      </div>

      {/* ภาพใหญ่ — เปิดเมื่อคลิกที่สไลด์ (กด Esc / คลิกพื้นหลัง เพื่อปิด) */}
      <AnimatePresence>
        {zoom && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setZoom(false)}
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-4"
          >
            <button
              aria-label="ปิด"
              className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            >
              <X className="h-6 w-6" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); go(-1); }}
              aria-label="ก่อนหน้า"
              className="absolute left-3 z-10 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <motion.div
              key={i}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="relative"
            >
              {/* ภาพใหญ่ใช้ <img> ธรรมดา — สไลด์จากหลังบ้านเป็น URL ที่ไม่รู้ขนาดล่วงหน้า
                  ซึ่ง next/image ต้องการ width/height เสมอถ้าไม่ได้ใช้ fill */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={typeof slide.src === "string" ? slide.src : slide.src.src}
                alt={slide.title}
                className="max-h-[85vh] w-auto rounded-lg object-contain"
              />
            </motion.div>
            <button
              onClick={(e) => { e.stopPropagation(); go(1); }}
              aria-label="ถัดไป"
              className="absolute right-3 z-10 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/**
 * การ์ดอัตราดอกเบี้ย — แสดงทีละหน้าแล้วเลื่อนเองวนไปเรื่อย ๆ
 *
 * รายการดอกเบี้ยมีได้ไม่จำกัด ถ้าโชว์ทั้งหมดการ์ดจะยืดจนหน้าแรกเสียทรง
 * จึงตัดเป็นหน้า ๆ ละ perPage แล้วไล่ไปทีละหน้า หมดเงินฝากต่อด้วยเงินกู้แล้ววนกลับ
 * ความสูงคงที่ตาม perPage ไม่ว่าหน้านั้นจะมีกี่แถว การ์ดจึงไม่กระตุกตอนเปลี่ยนหน้า
 */
function RateCard({ rates }: { rates: InterestRates }) {
  const perPage = Math.max(1, Math.min(20, rates.perPage ?? 5));
  const autoSeconds = rates.autoSeconds ?? 5;

  // ตัดเป็นหน้า ๆ เรียงเงินฝากก่อนแล้วต่อด้วยเงินกู้ — ลำดับนี้คือลำดับที่จะเลื่อนไป
  const pages = (["deposit", "loan"] as const).flatMap((group) => {
    const rows = rates[group];
    if (rows.length === 0) return [];
    return Array.from({ length: Math.ceil(rows.length / perPage) }, (_, i) => ({
      group,
      rows: rows.slice(i * perPage, i * perPage + perPage),
    }));
  });

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const current = pages[Math.min(index, Math.max(0, pages.length - 1))];

  // เลื่อนเอง — หยุดเมื่อเอาเมาส์ชี้ค้างไว้ จะได้อ่านทัน
  useEffect(() => {
    if (paused || autoSeconds <= 0 || pages.length <= 1) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % pages.length), autoSeconds * 1000);
    return () => clearInterval(timer);
  }, [paused, autoSeconds, pages.length]);

  if (!current) return null;

  const isDeposit = current.group === "deposit";
  const valueColor = isDeposit ? "text-emerald-600" : "text-orange-600";
  /** กดแท็บ = กระโดดไปหน้าแรกของกลุ่มนั้น */
  const jumpTo = (group: "deposit" | "loan") => {
    const target = pages.findIndex((p) => p.group === group);
    if (target !== -1) setIndex(target);
  };

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="flex h-full flex-col rounded-2xl bg-white p-5 shadow-lg ring-1 ring-black/5"
    >
      <div className="grid grid-cols-2 gap-1 rounded-full bg-gray-100 p-1 text-sm font-semibold">
        <button
          onClick={() => jumpTo("deposit")}
          className={`rounded-full py-1.5 transition ${isDeposit ? "bg-emerald-500 text-white shadow" : "text-emerald-700 hover:text-emerald-800"}`}
        >
          เงินฝาก
        </button>
        <button
          onClick={() => jumpTo("loan")}
          className={`rounded-full py-1.5 transition ${!isDeposit ? "bg-orange-500 text-white shadow" : "text-orange-700 hover:text-orange-800"}`}
        >
          เงินกู้
        </button>
      </div>

      <p className="mt-4 text-xs text-gray-400">อัตราดอกเบี้ย (ต่อปี)</p>

      {/* ความสูงล็อกตาม perPage — แถวละ 46px จะได้ไม่ขยับตอนหน้าสุดท้ายมีไม่ครบ */}
      <ul
        style={{ minHeight: perPage * 46 }}
        className="mt-2 flex-1 divide-y divide-gray-100"
      >
        {current.rows.map((r, i) => (
          // ชื่อรายการซ้ำกันได้ (เจ้าหน้าที่พิมพ์เอง) จึงผูก key กับลำดับด้วย
          <li key={`${r.label}-${i}`} className="flex items-center justify-between gap-3 py-2.5">
            <span className="min-w-0 flex-1 truncate text-sm text-gray-600" title={r.label}>
              {r.label}
            </span>
            <span className={`shrink-0 text-lg font-bold ${valueColor}`}>
              {r.rate} <span className="text-sm font-medium text-gray-400">%</span>
            </span>
          </li>
        ))}
      </ul>

      {pages.length > 1 && (
        <div className="mt-2 flex items-center justify-center gap-1.5">
          {pages.map((page, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              aria-label={`ไปหน้าที่ ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${
                i === index
                  ? `w-5 ${page.group === "deposit" ? "bg-emerald-500" : "bg-orange-500"}`
                  : "w-1.5 bg-gray-300"
              }`}
            />
          ))}
        </div>
      )}

      <p className="mt-2 text-[11px] text-gray-400">* อัตราอาจเปลี่ยนแปลงตามประกาศสหกรณ์</p>
    </div>
  );
}

// อัตราดอกเบี้ยส่งมาจากหน้า (server) เพราะ component นี้เป็น client — อ่านฐานเองไม่ได้
export default function Hero({ rates, slides }: { rates: InterestRates; slides: HeroSlide[] }) {
  const shown = slides.length > 0 ? slides : activitySlides;
  return (
    <section className="bg-gradient-to-b from-brand-500 to-brand-300 pb-8 pt-6">
      <div className="mx-auto grid max-w-6xl gap-5 px-4 md:grid-cols-[1.9fr_1fr]">
        <BannerSlider slides={shown} />
        <RateCard rates={rates} />
      </div>
    </section>
  );
}
