"use client";

import { motion, useScroll, useSpring, useReducedMotion } from "motion/react";

/** เส้นบางบนสุดของจอ บอกว่าอ่านมาถึงไหนแล้วของหน้ายาวๆ */
export default function ScrollProgress() {
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll();
  // หน่วงนิดหน่อยให้เส้นไหลลื่น ไม่กระตุกตามล้อเมาส์
  const width = useSpring(scrollYProgress, { stiffness: 140, damping: 28, restDelta: 0.001 });

  if (reduce) return null;

  return (
    <motion.div
      aria-hidden="true"
      style={{ scaleX: width }}
      className="fixed inset-x-0 top-0 z-[60] h-0.5 origin-left bg-gradient-to-r from-brand-400 via-brand-500 to-accent-green"
    />
  );
}
