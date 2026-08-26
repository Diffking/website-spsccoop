"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight, ZoomIn, X } from "lucide-react";
import { activitySlides } from "@/data/home";
import SlideProgress from "@/components/ui/SlideProgress";
import { useAutoRotate } from "@/lib/useAutoRotate";
import { SLIDE_TIMING, STACKED, fadeSwap } from "@/lib/slideMotion";
import type { InterestRates } from "@/lib/settings";

/** สไลด์มาจากฐาน (แก้ที่ /admin/home) — ถ้ายังไม่มี ใช้ชุดที่ติดมากับโค้ดแทน */
export type HeroSlide = { src: string | StaticImageData; title: string; desc: string; href: string };

// จังหวะของทุกสไลด์บนหน้าแรกอยู่รวมกันที่ src/lib/slideMotion.ts
const SLIDE_MS = SLIDE_TIMING.banner.every;

/**
 * ความสูงหนึ่งแถวของตารางดอกเบี้ย (px) — ต้องพอกับตัวเลข text-lg ที่สูง 28px
 * บวกช่องไฟบนล่าง · ใช้เป็นตัวล็อกความสูงของการ์ดไม่ให้ขยับตอนเปลี่ยนหน้า
 */
const ROW_H = 48;

function BannerSlider({ slides }: { slides: HeroSlide[] }) {
  const [i, setI] = useState(0);
  const [zoom, setZoom] = useState(false);
  const n = slides.length;
  const go = useCallback((d: number) => setI((v) => (v + d + n) % n), [n]);
  const slide = slides[i];

  // เลื่อนเอง — หยุดตอนยังเลื่อนมาไม่ถึง เอาเมาส์ชี้ค้าง หรือเปิดภาพใหญ่ค้างอยู่
  const frame = useRef<HTMLDivElement>(null);
  const auto = useAutoRotate({
    target: frame,
    count: n,
    at: i,
    step: () => setI((v) => (v + 1) % n),
    ms: SLIDE_MS,
    alsoPause: zoom,
  });
  const paused = auto.paused;

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
        ref={frame}
        // md ขึ้นไปปล่อยให้สูงเท่าแถวกริด (= ความสูงการ์ดดอกเบี้ย) สองใบจะได้จบเสมอกัน
        // มือถือยังล็อก 16:10 ไว้ เพราะเรียงบนล่าง ไม่มีอะไรให้เทียบความสูงด้วย
        className="group relative aspect-[16/10] overflow-hidden rounded-3xl md:aspect-auto md:h-full bg-gradient-to-br from-white via-sky-50 to-brand-50 shadow-[0_22px_55px_-20px_rgb(15_83_144_/_.5)] ring-1 ring-brand-100"
        {...auto.hover}
      >
        {/*
          แสงนุ่ม ๆ หลังฝั่งภาพ — ทำให้กรอบมีมิติ ไม่แบนเหมือนพื้นสีเดียว
          และแยกฝั่งข้อความกับฝั่งภาพออกจากกันด้วยน้ำหนักสี ไม่ต้องขีดเส้นแบ่ง
        */}
        <span
          aria-hidden
          className="pointer-events-none absolute -right-20 top-1/2 h-[130%] w-2/3 -translate-y-1/2 rounded-full bg-gradient-to-br from-brand-200/70 via-sky-100/60 to-transparent blur-2xl"
        />
        {/* crossfade: ข้อความด้านซ้าย + ภาพด้านขวา */}
        <AnimatePresence>
          <motion.div
            key={i}
            {...fadeSwap(SLIDE_TIMING.banner.fade)}
            onClick={() => setZoom(true)}
            // minmax(0,…) ด้วยเหตุผลเดียวกับกริดชั้นนอก — หัวข้อสไลด์แต่ละใบยาวไม่เท่ากัน
            // ปล่อยเป็น 1.05fr เฉย ๆ คอลัมน์ข้อความจะกว้างตามหัวข้อ แล้วรูปฝั่งขวาขยับทุกครั้งที่สไลด์วน
            /*
              ⚠️ **ระยะขอบซ้าย-ขวาต้องกว้างพอให้ปุ่มเลื่อนมีช่องของตัวเอง**
              ปุ่มลูกศรลอยทับข้อความกับภาพจนอ่านไม่ออก เจ้าของเว็บทัก 26 ส.ค. 2026
              · ปุ่มกว้าง 36px (จอเล็ก) / 40px (จอใหญ่) บวกระยะห่างจากขอบแล้ว
                กินพื้นที่ราว 38px / 52px — ระยะขอบตรงนี้จึงต้องมากกว่านั้นเสมอ
              · แก้ขนาดปุ่มหรือตำแหน่งปุ่มเมื่อไหร่ ต้องขยับเลขคู่นี้ตามด้วย
            */
            className="absolute inset-0 grid cursor-zoom-in grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] items-center gap-4 py-6 pl-12 pr-12 sm:gap-7 sm:py-9 sm:pl-16 sm:pr-16"
          >
            {/* ข้อความด้านซ้าย (ตัวใหญ่) */}
            <div className="min-w-0 text-left">
              {/*
                ลำดับ: หัวข้อ → แถบสีคั่น → คำอธิบาย

                เดิมแถบสีอยู่บนสุดนำหัวข้อ · เจ้าของเว็บให้สลับที่กัน 21 ส.ค. 2026
                หัวข้อขึ้นบนสุดเลย (สายตาเจอใจความก่อน ไม่ต้องข้ามแถบสีไปหนึ่งชั้น)
                แล้วแถบสีลงมาเป็น **เส้นคั่น** ระหว่างหัวข้อกับคำอธิบายแทน พร้อมขยายจาก
                w-10 เป็น w-16 เพราะทำหน้าที่คั่นแล้ว สั้นเกินไปจะดูเหมือนเศษขีดค้าง

                ⚠️ SlideCard ใน src/components/admin/SlidesManager.tsx ต้องเรียงเหมือนกันเป๊ะ
                ไม่งั้นหลังบ้านจะโชว์คนละหน้าตากับของจริง
              */}
              <motion.h3
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.5 }}
                // เข้มขึ้นจาก brand-700 เป็น brand-800 — อ่านง่ายขึ้นบนพื้นไล่สีอ่อน
                // จำกัดบรรทัด — หัวข้อยาวผิดปกติจะได้ไม่ดันคำอธิบายจนล้นกรอบ
                className="line-clamp-3 text-lg font-bold leading-snug tracking-tight text-brand-800 sm:text-xl md:text-2xl"
              >
                {slide.title}
              </motion.h3>
              <motion.span
                initial={{ opacity: 0, scaleX: 0 }}
                animate={{ opacity: 1, scaleX: 1 }}
                transition={{ delay: 0.22, duration: 0.45 }}
                className="mt-3 block h-1 w-16 origin-left rounded-full bg-gradient-to-r from-brand-600 to-brand-400 sm:mt-3.5"
              />
              {slide.desc && (
                <motion.p
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.34, duration: 0.5 }}
                  className="mt-3 line-clamp-4 text-sm leading-relaxed text-gray-700 sm:mt-3.5 sm:text-base"
                >
                  {slide.desc}
                </motion.p>
              )}
            </div>
            {/* ภาพด้านขวา */}
            <motion.div
              // ภาพค่อยๆ ซูมเข้าช้าๆ ตลอดช่วงที่สไลด์ค้างอยู่ (Ken Burns) ให้ภาพนิ่งดูมีชีวิต
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, scale: 1.04 }}
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
                className="object-contain object-right drop-shadow-[0_14px_28px_rgb(15_83_144_/_.28)]"
              />
            </motion.div>
          </motion.div>
        </AnimatePresence>

        {/* ป้ายชวนคลิกดูภาพใหญ่ — เด่นขึ้นตอน hover (mouseover) */}
        <span className="pointer-events-none absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-brand-700/80 px-3 py-1 text-xs font-medium text-white shadow transition group-hover:bg-brand-700">
          <ZoomIn className="h-3.5 w-3.5" /> คลิกดูภาพใหญ่
        </span>

        {/*
          ปุ่มเลื่อนต้องเห็นตลอด ไม่ใช่โผล่ตอนเอาเมาส์ชี้ — บนมือถือไม่มี hover
          สมาชิกจึงไม่มีทางรู้เลยว่าเลื่อนสไลด์เองได้
        */}
        <button
          onClick={() => go(-1)}
          aria-label="สไลด์ก่อนหน้า"
          className="absolute left-2 top-1/2 z-20 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-brand-700 shadow-lg ring-1 ring-brand-100 backdrop-blur transition hover:scale-110 hover:bg-white hover:text-brand-800 active:scale-95 sm:left-3 sm:h-10 sm:w-10"
        >
          <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
        </button>
        <button
          onClick={() => go(1)}
          aria-label="สไลด์ถัดไป"
          className="absolute right-2 top-1/2 z-20 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-brand-700 shadow-lg ring-1 ring-brand-100 backdrop-blur transition hover:scale-110 hover:bg-white hover:text-brand-800 active:scale-95 sm:right-3 sm:h-10 sm:w-10"
        >
          <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
        </button>

        {/* จุดบอกลำดับ — ใส่แผ่นขาวรองไว้ จะได้เห็นชัดไม่ว่าสไลด์นั้นพื้นสีอะไร */}
        <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-white/85 px-2.5 py-1.5 shadow-md ring-1 ring-brand-100 backdrop-blur">
          {slides.map((_, idx) => (
            <button
              key={idx}
              aria-label={`ไปสไลด์ที่ ${idx + 1}`}
              aria-current={idx === i}
              onClick={() => setI(idx)}
              className={`h-2 rounded-full transition-all ${
                idx === i ? "w-7 bg-brand-600" : "w-2 bg-brand-200 hover:bg-brand-400"
              }`}
            />
          ))}
        </div>

        {/*
          เส้นบอกว่าอีกนานแค่ไหนจะเปลี่ยนสไลด์ — วิ่งจากซ้ายไปขวาตามเวลาจริง
          หยุดค้างตอนเอาเมาส์ชี้หรือเปิดภาพใหญ่ ให้ตรงกับที่ autoplay หยุดจริง
          (ทำด้วย CSS ล้วนเพื่อให้หยุด/เดินต่อได้โดยไม่ต้องคำนวณเวลาที่เหลือเอง)
        */}
        <SlideProgress
          ms={SLIDE_MS}
          at={i}
          paused={paused || zoom}
          className="absolute inset-x-0 bottom-0 z-20"
        />
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
/**
 * แถบสามอย่างบนการ์ดหน้าแรก — เงินรับฝาก · เงินให้กู้ · สวัสดิการสมาชิก
 *
 * สองอันแรกโชว์อัตราดอกเบี้ย ส่วนสวัสดิการโชว์ **ชื่อกับกำหนดยื่นเอกสาร** เท่านั้น
 * เพราะเงื่อนไขการจ่ายยาวมาก ใส่ลงการ์ดเล็ก ๆ นี้ไม่ไหว — คนที่สนใจกดลิงก์ท้ายการ์ดไปอ่านต่อ
 */
const TABS = {
  deposit: {
    label: "เงินรับฝาก",
    head: "อัตราดอกเบี้ย (ต่อปี)",
    href: "/deposits/",
    on: "bg-brand-500 text-white shadow",
    off: "text-brand-700 hover:text-brand-800",
    value: "text-brand-600",
    dot: "bg-brand-500",
  },
  loan: {
    label: "เงินให้กู้",
    head: "อัตราดอกเบี้ย (ต่อปี)",
    href: "/loans/",
    on: "bg-orange-500 text-white shadow",
    off: "text-orange-700 hover:text-orange-800",
    value: "text-orange-600",
    dot: "bg-orange-500",
  },
  welfare: {
    label: "สวัสดิการ",
    head: "กำหนดยื่นเอกสาร",
    href: "/welfare/",
    on: "bg-emerald-500 text-white shadow",
    off: "text-emerald-700 hover:text-emerald-800",
    value: "text-emerald-600",
    dot: "bg-emerald-500",
  },
} as const;

type TabKey = keyof typeof TABS;
export type WelfareBrief = { label: string; note: string };

function RateCard({ rates, welfare }: { rates: InterestRates; welfare: WelfareBrief[] }) {
  const perPage = Math.max(1, Math.min(20, rates.perPage ?? 5));
  // เจ้าหน้าที่ตั้งเองได้ในหลังบ้าน · ไม่ได้ตั้งก็ใช้จังหวะกลางที่วางไว้ให้ไม่ตรงกับการ์ดอื่น
  const autoSeconds = rates.autoSeconds ?? SLIDE_TIMING.rates.every / 1000;

  // ตัดเป็นหน้า ๆ เรียงเงินรับฝาก → เงินให้กู้ → สวัสดิการ — ลำดับนี้คือลำดับที่จะเลื่อนไป
  const source: Record<TabKey, { label: string; value: string; unit?: string }[]> = {
    deposit: rates.deposit.map((r) => ({ label: r.label, value: String(r.rate), unit: "%" })),
    loan: rates.loan.map((r) => ({ label: r.label, value: String(r.rate), unit: "%" })),
    welfare: welfare.map((w) => ({ label: w.label, value: w.note })),
  };

  const pages = (Object.keys(TABS) as TabKey[]).flatMap((group) => {
    const rows = source[group];
    if (rows.length === 0) return [];
    return Array.from({ length: Math.ceil(rows.length / perPage) }, (_, i) => ({
      group,
      rows: rows.slice(i * perPage, i * perPage + perPage),
    }));
  });

  const [index, setIndex] = useState(0);
  const current = pages[Math.min(index, Math.max(0, pages.length - 1))];

  // เลื่อนเอง — หยุดตอนยังเลื่อนมาไม่ถึง หรือเอาเมาส์ชี้ค้างไว้ จะได้อ่านทัน
  const card = useRef<HTMLDivElement>(null);
  const auto = useAutoRotate({
    target: card,
    count: autoSeconds > 0 ? pages.length : 1,
    at: index,
    step: () => setIndex((i) => (i + 1) % pages.length),
    ms: autoSeconds * 1000,
  });
  const paused = auto.paused;

  if (!current) return null;

  const tab = TABS[current.group];
  /** กดแท็บ = กระโดดไปหน้าแรกของกลุ่มนั้น */
  const jumpTo = (group: TabKey) => {
    const target = pages.findIndex((p) => p.group === group);
    if (target !== -1) setIndex(target);
  };
  // โชว์เฉพาะแท็บที่มีข้อมูลจริง — ไม่มีสวัสดิการก็เหลือสองแท็บเหมือนเดิม
  const shown = (Object.keys(TABS) as TabKey[]).filter((k) => source[k].length > 0);

  return (
    <div
      ref={card}
      {...auto.hover}
      className="flex h-full min-w-0 flex-col overflow-hidden rounded-2xl bg-white p-5 shadow-lg ring-1 ring-black/5"
    >
      {/* กริดตามจำนวนแท็บที่มีจริง — grid-cols-N แบบมีเลข Tailwind ใส่ minmax(0,1fr) ให้เอง */}
      <div
        className={`grid gap-1 rounded-full bg-gray-100 p-1 text-sm font-semibold ${
          shown.length === 3 ? "grid-cols-3" : "grid-cols-2"
        }`}
      >
        {shown.map((key) => (
          <button
            key={key}
            onClick={() => jumpTo(key)}
            className={`rounded-full py-1.5 transition ${
              current.group === key ? TABS[key].on : TABS[key].off
            }`}
          >
            {TABS[key].label}
          </button>
        ))}
      </div>

      <p className="mt-4 text-xs text-gray-400">{tab.head}</p>

      {/*
        ล็อกขนาดสองอย่าง ไม่งั้นเปลี่ยนหน้าแล้วสะดุดตา
        (เคยเป็นมาแล้วกับดอกเบี้ยเงินกู้ตอนเลื่อนไปหน้าท้าย ๆ)

        1. **ความสูง** — วางเป็นกริดที่มีช่องเท่ากับ perPage เสมอ ช่องละ ROW_H พอดี
           หน้าไหนมีไม่ครบก็เหลือช่องว่างไว้ ความสูงจึงเท่ากันทุกหน้าเป๊ะ
           (ของเดิมใช้ minHeight เดาไว้ที่แถวละ 46px แต่แถวจริงสูง 48px
           หน้าที่เต็มจึงดันสูงกว่าหน้าที่ไม่เต็ม 14px แล้วการ์ดกระตุกทุกครั้งที่วนกลับ)

        2. **ความกว้างคอลัมน์ตัวเลข** — ตรึงไว้ ไม่งั้นหน้าไหนมีเลข 2 หลักคอลัมน์จะกว้างขึ้น
           แล้วชื่อรายการฝั่งซ้ายขยับตามทุกครั้งที่เปลี่ยนหน้า

        เปลี่ยนหน้าแบบค่อย ๆ จาง ไม่ใช่สลับทันที — เดิมตัวเลขกระพริบเปลี่ยนวูบเดียวจนสะดุดตา
        (เครื่องที่ตั้งค่าลดการเคลื่อนไหวไว้จะสลับทันทีเหมือนเดิม)
      */}
      {/*
        กรอบนอกเป็น `grid` แล้ววางหน้าเก่ากับหน้าใหม่ไว้ในช่องเดียวกัน (STACKED)
        ทั้งคู่จึงซ้อนทับกันตอนจางสลับได้ โดยความสูงยังเท่าเดิมและไม่มีวูบว่างตรงกลาง
        — ห้ามใส่ mode="wait" เพราะจะกลับไปเป็นจางหายจนหมดก่อนค่อยขึ้นใหม่
      */}
      <div className="relative mt-2 grid flex-1">
        <AnimatePresence initial={false}>
          <motion.ul
            key={index}
            {...fadeSwap(SLIDE_TIMING.rates.fade)}
            style={{ ...STACKED, gridTemplateRows: `repeat(${perPage}, ${ROW_H}px)` }}
            className="grid grid-cols-1 divide-y divide-gray-100"
          >
            {current.rows.map((r, i) => (
              // ชื่อรายการซ้ำกันได้ (เจ้าหน้าที่พิมพ์เอง) จึงผูก key กับลำดับด้วย
              // min-w-0 = ยอมให้แถวแคบกว่าชื่อรายการ ไม่งั้น truncate ไม่มีอะไรให้ตัด
              <li key={`${r.label}-${i}`} className="flex min-w-0 items-center justify-between gap-3">
                <span className="min-w-0 flex-1 truncate text-sm text-gray-600" title={r.label}>
                  {r.label}
                </span>
                {/*
                  w-32 ตรึงคอลัมน์ขวาไว้ ไม่งั้นหน้าไหนมีข้อความยาวกว่าคอลัมน์จะกว้างขึ้น
                  แล้วชื่อรายการฝั่งซ้ายขยับตามทุกครั้งที่เปลี่ยนหน้า
                  · สวัสดิการไม่มีหน่วย (%) ตัวเลขจึงเล็กกว่าเพราะเป็นข้อความไม่ใช่ตัวเลข
                */}
                <span
                  className={`w-32 shrink-0 truncate text-right font-bold ${tab.value} ${
                    r.unit ? "text-lg" : "text-sm"
                  }`}
                  title={r.value}
                >
                  {r.value}
                  {r.unit && <span className="text-sm font-medium text-gray-400"> {r.unit}</span>}
                </span>
              </li>
            ))}
          </motion.ul>
        </AnimatePresence>
      </div>

      {pages.length > 1 && (
        <>
          {/* หลอดนับถอยหลัง — เต็มหลอดเมื่อไหร่ก็เปลี่ยนหน้าพอดี หยุดเดินตอนเอาเมาส์ชี้ */}
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-gray-100">
            <SlideProgress ms={autoSeconds * 1000} at={index} paused={paused} className="block rounded-full" />
          </div>
          <div className="mt-2 flex items-center justify-center gap-1.5">
            {pages.map((page, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                aria-label={`ไปหน้าที่ ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? `w-5 ${TABS[page.group].dot}` : "w-1.5 bg-gray-300"
                }`}
              />
            ))}
          </div>
        </>
      )}

      {/*
        ลิงก์ไปหน้าเต็มของแท็บที่กำลังดูอยู่ — การ์ดนี้โชว์ได้แค่ย่อ ๆ
        โดยเฉพาะสวัสดิการที่เงื่อนไขการจ่ายยาวมาก คนสนใจต้องมีทางไปอ่านต่อ
      */}
      <Link
        href={tab.href}
        className={`mt-3 inline-flex items-center justify-center gap-1 rounded-full px-4 py-2 text-sm font-semibold transition ${tab.on} hover:brightness-105`}
      >
        ดู{tab.label}ทั้งหมด →
      </Link>

      <p className="mt-2 text-[11px] text-gray-400">
        {current.group === "welfare"
          ? "* เงื่อนไขการจ่ายดูได้ที่หน้าสวัสดิการ"
          : "* อัตราอาจเปลี่ยนแปลงตามประกาศสหกรณ์"}
      </p>
    </div>
  );
}

// อัตราดอกเบี้ยส่งมาจากหน้า (server) เพราะ component นี้เป็น client — อ่านฐานเองไม่ได้
export default function Hero({
  rates,
  slides,
  welfare = [],
}: {
  rates: InterestRates;
  slides: HeroSlide[];
  /** ชื่อสวัสดิการ + กำหนดยื่นเอกสาร — อ่านมาจากหน้า /welfare/ (ดู src/app/page.tsx) */
  welfare?: WelfareBrief[];
}) {
  const shown = slides.length > 0 ? slides : activitySlides;
  return (
    /*
      เปิดหน้าเว็บมาต้องเห็น "สไลด์ + ตารางดอกเบี้ย + ข่าววิ่ง" เต็มจอพอดี ไม่ให้ส่วนถัดไป
      โผล่มาแย่งสายตา (เจ้าของเว็บสั่ง 22 ส.ค. 2026) — 9rem คือหัวเว็บ (~100px) + ข่าววิ่ง (~42px)
      · ใช้ dvh ไม่ใช่ vh เพราะแถบล่างของเบราว์เซอร์บนมือถือยืดหดได้ vh จะเกินจอไปเสมอ
      · เป็น min-h ไม่ใช่ h — จอเตี้ยหรือมือถือที่ของสูงกว่าจอก็แค่เลื่อนต่อ ไม่มีอะไรถูกตัด

      ⚠️ อย่าไปใส่ padding ตายตัวแทน min-h — เคยเปลี่ยนเป็น py-[200px] แล้วถูกทักกลับ
      24 ส.ค. 2026 ว่าส่วนนี้ดีอยู่แล้ว · ที่ว่างบน-ล่างเกิดจากการจัดกึ่งกลางในหนึ่งจอ
      ซึ่งพอดีทุกความสูงจออยู่แล้ว ส่วนที่ต้องไปทำให้เท่ากันคือส่วนอื่นของหน้าแรก
    */
    <section className="flex min-h-[calc(100dvh-9rem)] items-center bg-gradient-to-b from-brand-500 to-brand-300 pb-8 pt-6 md:pt-10">
      {/*
        ต้องเป็น minmax(0,…) ไม่ใช่ 1.9fr_1fr เฉย ๆ — ช่องกริดแบบ `fr` มีความกว้าง
        ขั้นต่ำเป็น auto (= min-content ของเนื้อหา) ภาษาไทยไม่มีช่องว่างระหว่างคำ
        ทั้งบรรทัดจึงเป็นคำเดียว min-content ยาวเท่าข้อความ · ผลคือชื่อรายการดอกเบี้ย
        ที่ยาวที่สุดของ "หน้านั้น" ดันคอลัมน์ขวาให้กว้างขึ้น พอเลื่อนไปหน้าถัดไป
        ความยาวเปลี่ยน คอลัมน์ก็ขยับ — แบนเนอร์ฝั่งซ้ายเลยกระตุกตามทุกครั้งที่วน
      */}
      <div className="mx-auto grid w-full max-w-6xl gap-5 px-4 md:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
        <BannerSlider slides={shown} />
        <RateCard rates={rates} welfare={welfare} />
      </div>
    </section>
  );
}
