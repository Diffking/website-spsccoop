"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

export default function SectionHeading({
  title,
  subtitle,
  en,
}: {
  title: ReactNode;
  subtitle?: string;
  en?: string;
}) {
  const reduce = useReducedMotion();

  return (
    <div className="text-center mb-8 md:mb-10">
      <h2 className="text-2xl md:text-3xl font-bold text-brand-700">{title}</h2>

      {/* ขีดใต้หัวข้อ — ค่อยๆ ลากออกจากกึ่งกลางตอนเลื่อนมาถึง */}
      <motion.span
        aria-hidden="true"
        className="mx-auto mt-2 block h-1 rounded-full bg-gradient-to-r from-brand-300 via-brand-500 to-brand-300"
        initial={{ width: 0 }}
        whileInView={{ width: 64 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={reduce ? { duration: 0 } : { duration: 0.55, ease: "easeOut" }}
      />

      {en && (
        <p className="mt-2 text-xs md:text-sm font-semibold tracking-[0.2em] text-brand-400 uppercase">
          {en}
        </p>
      )}
      {subtitle && <p className="mt-2 text-sm md:text-base text-gray-500">{subtitle}</p>}
    </div>
  );
}
