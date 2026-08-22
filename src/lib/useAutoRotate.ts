"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * ตัวเลื่อนอัตโนมัติที่ใช้ร่วมกันทั้ง 4 สไลด์บนหน้าแรก
 * (แบนเนอร์ · ตารางดอกเบี้ย · รายการประกาศ · ทำเนียบกรรมการ)
 *
 * **จะเริ่มเดินก็ต่อเมื่อสมาชิกเลื่อนหน้าจอมาเห็นการ์ดนั้นจริง ๆ** ยังไม่ถึงก็หยุดรอไว้ก่อน
 * เหตุผล: ถ้าปล่อยให้วิ่งตั้งแต่โหลดหน้าเสร็จ พอเลื่อนลงมาถึงก็ผ่านไปหลายหน้าแล้ว
 * สมาชิกจะเจอเป็นหน้าที่ 3 บ้าง 4 บ้างแบบสุ่ม ไม่ได้เริ่มจากหน้าแรกอย่างที่ควรเป็น
 * · และเลื่อนพ้นไปแล้วก็หยุดอีก ไม่ต้องเปลืองแรงเครื่องวิ่งอยู่นอกจอ
 *
 * ⚠️ **ใช้ `rootMargin` ติดลบ ไม่ใช่ `threshold`** — ของเดิมใช้ `threshold: 0.35`
 * ซึ่งแปลว่า "ต้องเห็นการ์ด 35% ของตัวมันเอง" เลขนี้ขึ้นกับความสูงของการ์ดเทียบกับจอ
 * การ์ดสูงกว่าจอเมื่อไหร่ (จอเตี้ย ๆ · ซูมหน้าเว็บ · ขยายตัวอักษรด้วยปุ่ม L) อัตราส่วน
 * จะไม่มีวันแตะ 35% แล้ว**ไม่เริ่มเล่นเลยทั้งที่เห็นเต็มจอ** — 21 ส.ค. 2026 เจ้าของเว็บ
 * เจออาการนี้จริง · `rootMargin: "-12% 0px -12% 0px"` คือ "ขอบการ์ดโผล่เข้ามาในกรอบกลางจอ
 * แล้วหรือยัง" ซึ่งวัดจากจอ ไม่ได้วัดจากความสูงการ์ด จึงใช้ได้ทุกขนาดเสมอ
 *
 * ผูก effect ของนาฬิกาไว้กับ `at` ด้วย การกดปุ่มเองจึงรีเซ็ตเวลานับใหม่ —
 * ไม่งั้นกดเปลี่ยนหน้าปุ๊บอาจโดนตัวเลื่อนอัตโนมัติแย่งเปลี่ยนต่อในเสี้ยววินาที
 *
 * ⚠️ **ห้ามให้ hook คืน ref ออกไป** ต้องรับเข้ามา ไม่งั้นกฎ `react-hooks/refs`
 * จะฟ้อง `Cannot access refs during render` ทุกจุดที่หยิบค่าจากก้อนที่คืนมา
 * (`npm run build` ไม่ฟ้อง ต้อง `npx eslint src/` ถึงจะเห็น)
 */
/**
 * "ตอนนี้ของชิ้นนี้อยู่ในสายตาไหม" — ใช้ร่วมกันทุกที่ที่ต้องหยุดของที่วิ่งเองตอนพ้นจอ
 *
 * ⚠️ **ใช้ `rootMargin` ติดลบ ห้ามใช้ `threshold`** (เหตุผลเต็ม ๆ อยู่ที่ `useAutoRotate`)
 * โดยสรุป: `threshold` วัดเป็น % ของ**ตัวของชิ้นนั้น** พอมันสูงกว่าจอก็ไม่มีวันถึงเกณฑ์
 * ส่วน `rootMargin` วัดจาก**จอ** จึงใช้ได้ทุกขนาดเสมอ
 */
export function useInView(
  target: RefObject<HTMLElement | null>,
  rootMargin = "-12% 0px -12% 0px",
) {
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = target.current;
    if (!el) return;

    /* ไม่ต้องมีทางหนีสำหรับเบราว์เซอร์ที่ไม่มี IntersectionObserver —
       Tailwind v4 ที่เว็บนี้ใช้ต้องการเบราว์เซอร์ใหม่กว่านั้นมากอยู่แล้ว
       (และการ setState ใน effect ตรง ๆ ผิดกฎ react-hooks/set-state-in-effect) */
    const watcher = new IntersectionObserver(([entry]) => setSeen(entry.isIntersecting), {
      rootMargin,
    });
    watcher.observe(el);
    return () => watcher.disconnect();
  }, [target, rootMargin]);

  return seen;
}

export function useAutoRotate({
  target,
  count,
  at,
  step,
  ms,
  alsoPause = false,
}: {
  /** การ์ดที่ต้องเลื่อนมาเห็นก่อน ถึงจะเริ่มเดิน */
  target: RefObject<HTMLElement | null>;
  /** มีทั้งหมดกี่หน้า — เหลือหน้าเดียวก็ไม่ต้องเลื่อน */
  count: number;
  /** อยู่หน้าไหนตอนนี้ ใช้รีเซ็ตนาฬิกาเมื่อคนกดเปลี่ยนเอง */
  at: number;
  step: () => void;
  ms: number;
  /** เหตุผลอื่นที่ต้องหยุด เช่น แบนเนอร์เปิดภาพใหญ่ค้างอยู่ */
  alsoPause?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const seen = useInView(target);

  /*
    ⚠️ **สไลด์บนหน้าแรกไม่สนใจ `prefers-reduced-motion` ตั้งใจ**

    เคยทำให้เครื่องที่ตั้งค่านั้นหยุดเลื่อนเอง (21 ส.ค. 2026 รอบเช้า) แต่ผลจริงคือ
    เครื่องในสำนักงานที่เปิดโหมดประหยัดพลังงานไว้ Windows ปิดแอนิเมชันให้เอง
    เจ้าหน้าที่เลยเห็นหน้าแรกนิ่งสนิทไม่มีหลอดนับ แล้วนึกว่าเว็บพัง
    · เจ้าของเว็บสั่งให้แสดงเหมือนกันทุกเครื่อง 21 ส.ค. 2026 รอบเย็น

    แลกอะไร: คนที่ตั้งค่าไว้ว่าไม่อยากเจอภาพเคลื่อนไหวก็จะเจอสไลด์เลื่อนเองด้วย
    ส่วนอย่างอื่นในเว็บ (Reveal ตอนเลื่อน · หน้าเปิดเว็บ · ป้ายกระพริบ) ยังเคารพค่านั้นอยู่
  */
  const paused = hovered || alsoPause || !seen;

  /*
    เลื่อนพ้นการ์ดไปแล้ว `seen` กลับเป็น false → `paused` เป็น true → effect นี้ทำงานใหม่
    แล้ว `clearInterval` ในขั้นเก็บกวาดก็หยุดนาฬิกาทิ้ง **ไม่มีอะไรวิ่งค้างอยู่นอกจอ**
    (IntersectionObserver แจ้งทั้งตอนเข้าและตอนออก ไม่ได้แจ้งแค่ขาเข้า)
  */
  useEffect(() => {
    if (paused || count <= 1) return;
    const timer = setInterval(step, ms);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, count, at, ms]);

  return {
    paused,
    hover: { onMouseEnter: () => setHovered(true), onMouseLeave: () => setHovered(false) },
  };
}

/**
 * "จอกว้างพอไหม" — ให้คอมโพเนนต์ที่ซ่อนตัวเองบนจอแคบเลิกทำงานไปเลย ไม่ใช่แค่ซ่อน
 *
 * `hidden xl:block` ซ่อนแค่ตา แต่ JavaScript ยังวิ่งอยู่ — ตัวนำทางลอยซ้ายอ่านตำแหน่ง
 * ของทุกส่วนทุกครั้งที่เลื่อน ซึ่งบนมือถือคือแรงที่เสียไปฟรี ๆ เพราะไม่มีใครเห็นมัน
 *
 * คืน false ตอน render รอบแรกเสมอ (เซิร์ฟเวอร์ไม่รู้ขนาดจอ) แล้วค่อยอัปเดตฝั่งเบราว์เซอร์
 * — คอมโพเนนต์ที่ใช้ต้องทนกับการเริ่มจาก false ได้
 */
export function useWideScreen(minWidth = 1280) {
  const [wide, setWide] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${minWidth}px)`);
    const sync = () => setWide(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [minWidth]);

  return wide;
}
