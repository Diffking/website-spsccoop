"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

/**
 * เนื้อหาของ "หน้าเนื้อหา" — ใช้ซ้ำได้ทุกหน้าที่มีเนื้อหาเป็น HTML
 *
 * ทำสามอย่างให้อัตโนมัติ โดยเจ้าหน้าที่ไม่ต้องรู้เรื่องโค้ด
 *   1. ย่อหน้า/หัวข้อ/รูป ค่อย ๆ ปรากฏทีละก้อนตอนเลื่อนถึง (ไม่โผล่พรวดทั้งหน้า)
 *   2. รูปโหลดแบบ lazy และไม่ล้นกรอบ · ตารางกว้างเลื่อนดูในกรอบได้บนมือถือ
 *   3. ระยะห่างและขนาดตัวอักษรจัดให้ตามชนิดของแท็ก (ดู .prose-page ใน globals.css)
 *
 * เนื้อหาถูกใส่ตั้งแต่ฝั่งเซิร์ฟเวอร์ (คอมโพเนนต์นี้ถูก render บนเซิร์ฟเวอร์ด้วย)
 * Google จึงเห็นข้อความครบ ไม่ใช่หน้าเปล่าที่รอ JavaScript วาด
 */

/** useLayoutEffect ทำงานก่อนวาดจอ — ซ่อนก้อนเนื้อหาได้ทันก่อนผู้อ่านเห็น ไม่มีอาการวาบ */
const useBeforePaint = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** หน่วงทีละก้อน (มิลลิวินาที) — ก้อนที่เข้ามาพร้อมกันจะไล่กันทีละนิด ไม่ขึ้นพร้อมกันหมด */
const STAGGER = 70;
const MAX_STAGGER = 6;

export default function PageContent({ html, className = "" }: { html: string; className?: string }) {
  const box = useRef<HTMLDivElement>(null);

  useBeforePaint(() => {
    const root = box.current;
    if (!root) return;

    // รูป: โหลดเมื่อเลื่อนถึง และไม่ให้บล็อกการวาดหน้าอื่น
    root.querySelectorAll("img").forEach((img) => {
      img.loading = "lazy";
      img.decoding = "async";
    });

    // ตารางกว้างเกินจอ: ห่อให้เลื่อนแนวนอนได้ในกรอบตัวเอง ไม่ดันทั้งหน้าให้เลื่อนซ้ายขวา
    root.querySelectorAll("table").forEach((table) => {
      if (table.parentElement?.classList.contains("table-scroll")) return;
      const wrap = document.createElement("div");
      wrap.className = "table-scroll";
      table.replaceWith(wrap);
      wrap.appendChild(table);
    });

    // เครื่องที่ตั้งค่าลดการเคลื่อนไหวไว้ ให้แสดงทันทีไม่ต้องมีอนิเมชัน
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const blocks = Array.from(root.children) as HTMLElement[];
    blocks.forEach((el) => el.classList.add("reveal-item"));

    const observer = new IntersectionObserver(
      (entries) => {
        // ก้อนที่โผล่พร้อมกันในรอบเดียว ให้ไล่ตามลำดับบนลงล่าง
        entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
          .forEach((entry, i) => {
            const el = entry.target as HTMLElement;
            el.style.transitionDelay = `${Math.min(i, MAX_STAGGER) * STAGGER}ms`;
            el.classList.add("is-in");
            observer.unobserve(el);
          });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 },
    );

    blocks.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [html]);

  return (
    <div
      ref={box}
      className={`prose-page ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
