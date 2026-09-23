"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import EnterSiteButton from "@/components/site/EnterSiteButton";
import SplashCountdown from "@/components/site/SplashCountdown";
import { useEnterSite } from "@/components/site/useEnterSite";
import {
  autoEnterSeconds,
  getActiveOccasion,
  type SplashContent,
  type SplashOccasion,
} from "@/content/splash";
import { isLightSplashBg, splashBgClass } from "@/lib/splashTheme";
import { useIsClient } from "@/lib/useIsClient";

/**
 * เนื้อหาหน้า splash — เลือกวันสำคัญฝั่ง client เท่านั้น
 * (ดูเหตุผลที่หัวไฟล์ src/content/splash.ts)
 *
 * ?preview=<id> = บังคับดูวันสำคัญที่ระบุ ไม่สนวันที่ — ใช้จากปุ่มดูตัวอย่างในหลังบ้าน
 *
 * จังหวะการเปิดหน้า (เจ้าของเว็บสั่งไว้ 23 ก.ย. 2569 ว่าต้อง "ค่อย ๆ นิ่มนวล เป็นทางการ")
 * ทุกชั้นเริ่มนับเวลาจาก "ตอนภาพพร้อมจริง" ไม่ใช่ตอน mount — ไม่งั้นเน็ตช้าจะเห็นกรอบ
 * จางขึ้นมาว่างเปล่าก่อน แล้วภาพค่อยกระโดดโผล่ ซึ่งเป็นอาการที่ดูไม่เรียบร้อยที่สุดของหน้านี้
 *
 *   0.00s  ภาพคลี่จากเบลอ 14px + ย่อจาก 1.04 เข้าที่ (1.4 วิ)
 *   0.70s  เส้นทองลากออกจากกลาง
 *   0.85s  หัวข้อ — ระยะห่างตัวอักษรคลายจากถ่างเข้าหาปกติ
 *   1.05s  คำอธิบาย
 *   1.30s  ปุ่มเข้าสู่เว็บไซต์
 *   1.50s  ตัวนับถอยหลัง (ถ้าเปิดไว้)
 *
 * ⚠️ ห้ามยืดให้ยาวกว่านี้ — ปุ่มมาช้ากว่า ~2 วิเมื่อไหร่คนจะเริ่มนึกว่าเว็บค้าง
 * ⚠️ เครื่องที่ตั้ง "ลดการเคลื่อนไหว" ได้แค่จางเข้าเฉย ๆ ทั้งชุด (หน้านี้เคารพค่านั้น
 *    ต่างจากสไลด์หน้าแรกที่ตั้งใจไม่เคารพ — ดู AGENTS.md)
 */

/** ภาพโหลดไม่เสร็จภายในเท่านี้ก็เปิดหน้าไปก่อน — ภาพเสียหรือเน็ตแย่ต้องไม่ทำให้จอค้างเปล่า */
const IMAGE_WAIT_MS = 2500;
/** ตัวนับถอยหลังโผล่ท้ายสุด ต่อจากปุ่ม (mount ตอนนี้เลย นาฬิกาจะได้เริ่มพร้อมที่ตาเห็น) */
const TAIL_MS = 1500;
/** จางออกก่อนพาไปหน้าแรก */
const EXIT_MS = 450;

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * ฝุ่นทองลอยขึ้น — ค่าคงที่ ไม่สุ่ม เพราะสุ่มตอน render แล้วเซิร์ฟเวอร์กับเบราว์เซอร์จะวาดไม่ตรงกัน
 * หน่วงเป็นเลขติดลบ = เริ่มกลางวงจรเลย จะได้ไม่ลอยขึ้นพร้อมกันทั้งแถบตอนเปิดหน้า
 */
const DUST = [
  { left: "9%", bottom: "8%", size: 3, dur: 21, delay: -3 },
  { left: "17%", bottom: "26%", size: 2, dur: 27, delay: -14 },
  { left: "24%", bottom: "4%", size: 4, dur: 19, delay: -8 },
  { left: "33%", bottom: "34%", size: 2, dur: 30, delay: -21 },
  { left: "44%", bottom: "12%", size: 3, dur: 24, delay: -11 },
  { left: "56%", bottom: "30%", size: 2, dur: 28, delay: -5 },
  { left: "65%", bottom: "6%", size: 3, dur: 22, delay: -17 },
  { left: "74%", bottom: "22%", size: 4, dur: 26, delay: -9 },
  { left: "83%", bottom: "14%", size: 2, dur: 31, delay: -24 },
  { left: "91%", bottom: "32%", size: 3, dur: 20, delay: -2 },
] as const;

/** occasion เป็น null = วันนี้ไม่มีวันสำคัญที่ต้องแสดง */
function resolveOccasion(content: SplashContent): {
  occasion: SplashOccasion | null;
  preview: boolean;
} {
  let previewId: string | null = null;
  try {
    previewId = new URLSearchParams(window.location.search).get("preview");
  } catch {}

  if (previewId) {
    return { occasion: content.occasions.find((o) => o.id === previewId) ?? null, preview: true };
  }
  return { occasion: getActiveOccasion(content), preview: false };
}

/** แสงนวลหลังภาพ หายใจเข้าออกช้า ๆ ให้ภาพไม่นิ่งสนิทเหมือนรูปติดผนัง */
function Glow({ light }: { light: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={`splash-glow pointer-events-none absolute left-1/2 top-1/2 h-[70vmin] w-[70vmin] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl ${
        light ? "bg-amber-300/20" : "bg-amber-100/10"
      }`}
    />
  );
}

/** ขอบจอมืดลง ดันสายตาเข้าหากลางภาพ (คลาสอยู่ใน globals.css) */
function Vignette({ light }: { light: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 ${
        light ? "splash-vignette-light" : "splash-vignette"
      }`}
    />
  );
}

function Dust({ light }: { light: boolean }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {DUST.map((d) => (
        <span
          key={d.left}
          className={`splash-dust absolute rounded-full ${
            light ? "bg-amber-600/50" : "bg-amber-100/70"
          }`}
          style={{
            left: d.left,
            bottom: d.bottom,
            width: d.size,
            height: d.size,
            animationDuration: `${d.dur}s`,
            animationDelay: `${d.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

export default function SplashView({ content }: { content: SplashContent }) {
  const isClient = useIsClient();
  const reduce = useReducedMotion();
  const enter = useEnterSite();

  /** ภาพพร้อมแล้ว = เริ่มเปิดหน้าได้ */
  const [ready, setReady] = useState(false);
  /** ถึงคิวของท้ายหน้า (ตัวนับถอยหลัง) แล้ว */
  const [tail, setTail] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  // กันกดปุ่มซ้ำ/ตัวนับครบซ้อนกับการกดปุ่ม แล้วสั่งเปลี่ยนหน้าสองรอบ
  const leavingRef = useRef(false);

  const resolved = isClient ? resolveOccasion(content) : undefined;
  const occasion = resolved?.occasion;
  const image = occasion?.image;

  useEffect(() => {
    const el = imgRef.current;
    if (!el) return;

    let fired = false;
    const open = () => {
      if (fired) return;
      fired = true;
      setReady(true);
    };

    // ภาพอยู่ในแคชแล้ว (คนเคยเข้ามารอบก่อน) — "load" จะไม่ยิงอีก ต้องเช็คเอง
    if (el.complete) {
      const cached = setTimeout(open, 0);
      return () => clearTimeout(cached);
    }

    el.addEventListener("load", open);
    el.addEventListener("error", open);
    const guard = setTimeout(open, IMAGE_WAIT_MS);
    return () => {
      el.removeEventListener("load", open);
      el.removeEventListener("error", open);
      clearTimeout(guard);
    };
  }, [image]);

  useEffect(() => {
    if (!ready) return;
    const id = setTimeout(() => setTail(true), TAIL_MS);
    return () => clearTimeout(id);
  }, [ready]);

  /** จางทั้งหน้าลงก่อน แล้วค่อยไปหน้าแรก — ของเดิมตัดจบทันทีซึ่งกระชากตาที่สุดของหน้านี้ */
  const leave = useCallback(() => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    setLeaving(true);
    setTimeout(enter, EXIT_MS);
  }, [enter]);

  /*
    ยังไม่ hydrate = ยังไม่รู้วันที่/query string ของผู้ใช้
    ⚠️ ห้ามใช้จอดำเปล่าเหมือนเดิม — วันสำคัญที่ใช้พื้นครีมจะเห็นดำแวบแล้วกระชากเป็นครีม
    และตั้งแต่เด้งมาถึงหน้านี้ได้เร็วขึ้น จังหวะนี้ก็ยิ่งเห็นชัด · ใช้สีของวันสำคัญแรก
    ที่เปิดอยู่ไปก่อน (เกือบทุกครั้งมีวันสำคัญเปิดอยู่ใบเดียว จึงตรงกับของจริง)
  */
  if (resolved === undefined || occasion === undefined) {
    const first = content.occasions.find((o) => o.enabled);
    const firstLight = isLightSplashBg(first?.bg);
    return (
      <main className={`relative min-h-screen overflow-hidden ${splashBgClass(first?.bg)}`}>
        <Glow light={firstLight} />
        <Vignette light={firstLight} />
      </main>
    );
  }

  // เข้ามาเองทั้งที่ไม่ใช่วันสำคัญ — ไม่ปล่อยให้เจอจอดำเปล่า
  if (occasion === null) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-black px-4 py-10 text-center">
        <p className="text-white/60">ขณะนี้ไม่มีหน้าวันสำคัญที่กำลังแสดง</p>
        <EnterSiteButton label={content.buttonText} onEnter={leave} />
      </main>
    );
  }

  const light = isLightSplashBg(occasion.bg);

  /*
    ตอนกดดูตัวอย่างจากหลังบ้านห้ามนับถอยหลัง — เจ้าหน้าที่เปิดมาตรวจรูปกับข้อความ
    แล้วจู่ ๆ โดนพาออกไปหน้าแรกเอง จะตรวจงานไม่ได้
  */
  const countdown = resolved.preview ? 0 : autoEnterSeconds(content);

  const step = (delay: number) => ({
    initial: { opacity: 0, y: 14 },
    animate: ready ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 },
    transition: reduce ? { duration: 0 } : { duration: 0.8, delay, ease: EASE },
  });

  // ท่าเปิดภาพ: คลี่จากเบลอ ให้ความรู้สึกเป็นพิธีการโดยไม่ต้องมีอะไรวิ่งไปมา
  const imageMotion = reduce
    ? {
        initial: { opacity: 0 },
        animate: { opacity: ready ? 1 : 0 },
        transition: { duration: 0.35 },
      }
    : {
        initial: { opacity: 0, scale: 1.04, filter: "blur(14px)" },
        animate: ready
          ? { opacity: 1, scale: 1, filter: "blur(0px)" }
          : { opacity: 0, scale: 1.04, filter: "blur(14px)" },
        transition: { duration: 1.4, ease: EASE },
      };

  return (
    <motion.main
      className={`relative flex min-h-screen flex-col items-center justify-center gap-8 overflow-hidden px-4 py-10 text-center ${splashBgClass(
        occasion.bg,
      )}`}
      animate={leaving ? { opacity: 0, scale: 0.985 } : { opacity: 1, scale: 1 }}
      transition={{ duration: reduce ? 0.2 : EXIT_MS / 1000, ease: "easeInOut" }}
      // ระหว่างจางออกห้ามกดอะไรได้อีก ไม่งั้นสั่งเปลี่ยนหน้าซ้อนกัน
      style={leaving ? { pointerEvents: "none" } : undefined}
    >
      <Glow light={light} />
      <Dust light={light} />

      {/* ใช้ <img> ธรรมดาเพราะรูปเปลี่ยนได้จากหลังบ้าน ไม่รู้ขนาดล่วงหน้า */}
      <motion.div className="relative" {...imageMotion}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={occasion.image}
          alt={occasion.alt}
          // หน้านี้มีภาพเดียวและเป็นพระเอกของหน้า ให้เบราว์เซอร์จัดคิวโหลดมาก่อนอย่างอื่น
          fetchPriority="high"
          className={`splash-image h-auto w-full max-w-[560px] rounded-lg ring-1 ${
            light ? "ring-black/10" : "ring-white/10"
          }`}
        />
      </motion.div>

      {/* เส้นทองลากออกจากกลาง — สัญลักษณ์ที่ใช้กับงานพิธี เพิ่มความเป็นทางการให้ทั้งหน้า */}
      <motion.div
        aria-hidden="true"
        className={`relative h-px bg-gradient-to-r from-transparent to-transparent ${
          light ? "via-amber-700/55" : "via-amber-200/50"
        }`}
        initial={{ width: 0, opacity: 0 }}
        animate={ready ? { width: "9rem", opacity: 1 } : { width: 0, opacity: 0 }}
        transition={reduce ? { duration: 0 } : { duration: 0.9, delay: 0.7, ease: EASE }}
      />

      {(occasion.headline || occasion.subtext) && (
        <div className="relative max-w-xl space-y-2">
          {occasion.headline && (
            <motion.h1
              className={`text-xl font-medium sm:text-2xl ${
                light ? "text-amber-900" : "text-amber-50/90"
              }`}
              /*
                ระยะห่างตัวอักษรคลายจากถ่างเข้าหาปกติ — ท่าพิมพ์แบบงานพิธี
                ⚠️ ถ้าสระบน-ล่างของไทยดูแปลกตอนถ่าง ให้ตัดสองค่านี้ทิ้ง เหลือแค่ opacity/y
              */
              initial={{ opacity: 0, y: 10, letterSpacing: "0.18em" }}
              animate={
                ready
                  ? { opacity: 1, y: 0, letterSpacing: "0.01em" }
                  : { opacity: 0, y: 10, letterSpacing: "0.18em" }
              }
              transition={reduce ? { duration: 0 } : { duration: 1.1, delay: 0.85, ease: EASE }}
            >
              {occasion.headline}
            </motion.h1>
          )}
          {occasion.subtext && (
            <motion.p
              className={`text-sm leading-relaxed ${light ? "text-amber-900/70" : "text-white/60"}`}
              {...step(1.05)}
            >
              {occasion.subtext}
            </motion.p>
          )}
        </div>
      )}

      <motion.div className="relative flex flex-col items-center gap-5" {...step(1.3)}>
        <EnterSiteButton label={content.buttonText} light={light} onEnter={leave} />
        {/*
          mount ตอน tail ไม่ใช่ตอนเปิดหน้า — ตัวนับเริ่มเดินทันทีที่ mount
          ถ้าปล่อยให้ mount ตั้งแต่แรกแล้วค่อยจางขึ้นมา เลขที่โผล่มาจะข้ามไปแล้วสองวินาที
        */}
        {tail && countdown > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: reduce ? 0 : 0.6 }}
          >
            <SplashCountdown seconds={countdown} light={light} onDone={leave} />
          </motion.div>
        )}
      </motion.div>

      {/* วางท้ายสุดเพื่อให้ทับอยู่เหนือฝุ่นและแสง แต่ไม่ทับเนื้อหาเพราะไม่รับคลิก */}
      <Vignette light={light} />
    </motion.main>
  );
}
