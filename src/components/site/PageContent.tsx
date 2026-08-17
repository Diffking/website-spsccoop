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

    /*
     * แท็บเมนู — เนื้อหาที่บันทึกไว้เป็นแค่กล่องซ้อนกัน ตรงนี้คือที่ทำให้กดสลับได้จริง
     * สร้างปุ่มจาก data-title ของแต่ละแท็บ แล้วซ่อนอันที่ไม่ได้เลือก
     */
    root.querySelectorAll<HTMLElement>(".tabs").forEach((group) => {
      if (group.dataset.ready === "1") return;
      const panels = Array.from(group.querySelectorAll<HTMLElement>(":scope > .tab"));
      if (panels.length === 0) return;

      const bar = document.createElement("div");
      bar.className = "tab-buttons";
      bar.setAttribute("role", "tablist");

      const show = (index: number) => {
        panels.forEach((panel, i) => {
          panel.hidden = i !== index;
          panel.classList.add("is-ready");
        });
        Array.from(bar.children).forEach((button, i) => {
          button.setAttribute("aria-selected", String(i === index));
          (button as HTMLElement).tabIndex = i === index ? 0 : -1;
        });
      };

      panels.forEach((panel, i) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "tab-button";
        button.setAttribute("role", "tab");
        button.textContent = panel.dataset.title || `หัวข้อที่ ${i + 1}`;
        button.addEventListener("click", () => show(i));

        // กดลูกศรซ้าย/ขวาเลื่อนแท็บได้ สำหรับคนที่ใช้คีย์บอร์ดอย่างเดียว
        button.addEventListener("keydown", (e) => {
          const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
          if (step === 0) return;
          e.preventDefault();
          const next = (i + step + panels.length) % panels.length;
          show(next);
          (bar.children[next] as HTMLElement).focus();
        });
        bar.appendChild(button);
      });

      group.prepend(bar);
      group.dataset.ready = "1";
      show(0);
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
