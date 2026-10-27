"use client";

import { useEffect } from "react";

/**
 * ลบเลขเวอร์ชันของ Next + ธง turbopack ออกจาก window.next หลังหน้าโหลดเสร็จ — Wappalyzer อ่านจากตรงนี้
 * (เจ้าของเว็บขอ 27 ต.ค. 2569 · คู่กับ poweredByHeader: false ใน next.config.ts)
 *
 * ซ่อนได้แค่ "เลขเวอร์ชัน" — ชื่อเฟรมเวิร์กยังดูออกจาก /_next/static/ ซึ่งเป็นแกนของ Next ซ่อนไม่ได้
 * ไม่ใช่ตัวป้องกันจริง ตัวป้องกันจริงคือการอัปแพตช์ (ดู AGENTS.md หัวข้ออัปเดตแพตช์ความปลอดภัย)
 */
export default function HideVersion() {
  useEffect(() => {
    try {
      const w = window as unknown as { next?: Record<string, unknown> };
      // version = เลข Next · turbopack = ธงบอกตัว build — สองค่านี้ไว้ให้เครื่องมือภายนอกอ่านเท่านั้น
      // ห้ามลบ router / appDir — ตัวเปลี่ยนหน้าของ Next ใช้จริง
      if (w.next) for (const key of ["version", "turbopack"]) delete w.next[key];
    } catch {
      // เบราว์เซอร์ไม่ยอมให้ลบ — ไม่เป็นไร แค่ซ่อนไม่ได้
    }
  }, []);
  return null;
}
