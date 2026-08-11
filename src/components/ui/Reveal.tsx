"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

/**
 * ห่อเนื้อหาให้ค่อยๆ ปรากฏตอนเลื่อนมาถึง
 *
 * ถ้าผู้ใช้ตั้งเครื่องว่า "ลดการเคลื่อนไหว" (ระบบปฏิบัติการมีสวิตช์นี้ให้คนที่เวียนหัวง่าย)
 * จะข้ามอนิเมชันไปเลย แสดงเนื้อหาตรงๆ — สำคัญตรงที่ค่าเริ่มต้นของอนิเมชันคือ opacity 0
 * ถ้าไม่ดักไว้ คนกลุ่มนี้จะเจอหน้าว่างเปล่า
 */
export default function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      className={className}
      // ค่า initial ต้องเหมือนกันเสมอไม่ว่าจะลดการเคลื่อนไหวหรือไม่ ไม่งั้น HTML จากเซิร์ฟเวอร์
      // กับที่ client วาดจะไม่ตรงกัน — ปิดการเคลื่อนไหวด้วยการตั้ง duration เป็น 0 แทน
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={reduce ? { duration: 0 } : { duration: 0.5, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
