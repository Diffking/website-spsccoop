"use client";

import { motion, useReducedMotion } from "motion/react";
import EnterSiteButton from "@/components/site/EnterSiteButton";
import {
  getActiveOccasion,
  type SplashContent,
  type SplashOccasion,
} from "@/content/splash";
import { isLightSplashBg, splashBgClass } from "@/lib/splashTheme";
import { useIsClient } from "@/lib/useIsClient";

/**
 * เนื้อหาหน้า splash — เลือกวันสำคัญฝั่ง client เท่านั้น
 * (เว็บเป็น static export ถ้าเลือกตอน build วันที่จะแช่เป็นวันที่ build ตลอดไป)
 *
 * ?preview=<id> = บังคับดูวันสำคัญที่ระบุ ไม่สนวันที่ — ใช้จากปุ่มดูตัวอย่างในหลังบ้าน
 */
/** null = วันนี้ไม่มีวันสำคัญที่ต้องแสดง */
function resolveOccasion(content: SplashContent): SplashOccasion | null {
  let previewId: string | null = null;
  try {
    previewId = new URLSearchParams(window.location.search).get("preview");
  } catch {}

  if (previewId) {
    return content.occasions.find((o) => o.id === previewId) ?? null;
  }
  return getActiveOccasion(content);
}

export default function SplashView({ content }: { content: SplashContent }) {
  const isClient = useIsClient();
  const reduce = useReducedMotion();
  // ยังไม่ hydrate = ยังไม่รู้วันที่/query string ของผู้ใช้ (จอดำเปล่าๆ กันภาพผิดกระพริบ)
  const occasion = isClient ? resolveOccasion(content) : undefined;

  if (occasion === undefined) {
    return <main className="min-h-screen bg-black" />;
  }

  // เข้ามาเองทั้งที่ไม่ใช่วันสำคัญ — ไม่ปล่อยให้เจอจอดำเปล่า
  if (occasion === null) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-black px-4 py-10 text-center">
        <p className="text-white/60">ขณะนี้ไม่มีหน้าวันสำคัญที่กำลังแสดง</p>
        <EnterSiteButton label={content.buttonText} />
      </main>
    );
  }

  const light = isLightSplashBg(occasion.bg);

  // ทยอยปรากฏทีละชั้น ภาพ → ข้อความ → ปุ่ม ให้ความรู้สึกสงบ ไม่โผล่พรวดพร้อมกัน
  const step = (delay: number) => ({
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: reduce
      ? { duration: 0 }
      : { duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] as const },
  });

  return (
    <main
      className={`relative flex min-h-screen flex-col items-center justify-center gap-8 overflow-hidden px-4 py-10 text-center ${splashBgClass(
        occasion.bg,
      )}`}
    >
      {/*
        แสงนวลหลังภาพ — หายใจเข้าออกช้า ๆ ให้ภาพไม่นิ่งสนิทเหมือนรูปติดผนัง
        (คลาส splash-glow อยู่ใน globals.css · เครื่องที่ลดการเคลื่อนไหวจะหยุดนิ่ง)
      */}
      <div
        aria-hidden="true"
        className={`splash-glow pointer-events-none absolute left-1/2 top-1/2 h-[70vmin] w-[70vmin] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl ${
          light ? "bg-amber-300/20" : "bg-amber-100/10"
        }`}
      />

      {/* ใช้ <img> ธรรมดาเพราะรูปเปลี่ยนได้จากหลังบ้าน ไม่รู้ขนาดล่วงหน้า */}
      <motion.div
        className="relative"
        initial={{ opacity: 0, scale: reduce ? 1 : 0.965 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={
          reduce ? { duration: 0 } : { duration: 1.2, ease: [0.22, 1, 0.36, 1] as const }
        }
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={occasion.image}
          alt={occasion.alt}
          className={`splash-image h-auto w-full max-w-[560px] rounded-lg ring-1 ${
            light ? "ring-black/10" : "ring-white/10"
          }`}
        />
      </motion.div>

      {(occasion.headline || occasion.subtext) && (
        <motion.div className="relative max-w-xl space-y-2" {...step(0.5)}>
          {occasion.headline && (
            <h1
              className={`text-xl font-medium sm:text-2xl ${
                light ? "text-amber-900" : "text-amber-50/90"
              }`}
            >
              {occasion.headline}
            </h1>
          )}
          {occasion.subtext && (
            <p
              className={`text-sm leading-relaxed ${light ? "text-amber-900/70" : "text-white/60"}`}
            >
              {occasion.subtext}
            </p>
          )}
        </motion.div>
      )}

      <motion.div className="relative" {...step(0.8)}>
        <EnterSiteButton label={content.buttonText} light={light} />
      </motion.div>
    </main>
  );
}
