"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

/** ห่อเนื้อหาให้ค่อยๆ fade + เลื่อนขึ้นตอน scroll เข้ามาในจอ */
export default function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
