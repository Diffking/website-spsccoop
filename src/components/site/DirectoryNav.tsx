"use client";

import { useCallback, useEffect, useState } from "react";
import { ListTree, X } from "lucide-react";
import type { DirSection } from "@/lib/directoryNav";

/**
 * แถบนำทางหน้าทำเนียบ — มีแค่ชื่อฝ่าย (เจ้าของเว็บสั่ง 9 พ.ย. 2569 · ดู src/lib/directoryNav.ts)
 *
 * จอกว้าง (lg ขึ้นไป): แถบติดจอด้านซ้ายของเนื้อหา · ฝ่ายที่กำลังอ่านเป็นแถบน้ำเงินทึบ
 * จอแคบ: ปุ่มลอย "ทำเนียบ" มุมซ้ายล่าง (มุมขวามีปุ่มกลับขึ้นบนอยู่แล้ว) กดแล้วเปิดแผ่นจากด้านล่าง
 *
 * หาฝ่ายที่กำลังอ่านด้วย requestAnimationFrame แบบเดียวกับ SectionNav ของหน้าแรก
 * — คิดอย่างมากเฟรมละครั้ง ไม่ถ่วงการเลื่อน
 */
export default function DirectoryNav({ sections }: { sections: DirSection[] }) {
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let queued = 0;
    const measure = () => {
      queued = 0;
      // เส้นสมมุติใต้แถบเมนูที่ปักหัวจอ — หัวข้อที่เลยเส้นนี้ไปแล้วและอยู่ล่างสุด คือฝ่ายที่กำลังอ่าน
      const line = 140;
      let found = 0;
      sections.forEach((s, i) => {
        const el = document.getElementById(s.id);
        if (el && el.getBoundingClientRect().top <= line) found = i;
      });
      setActive(found);
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(100, Math.round((window.scrollY / max) * 100)) : 0);
    };
    const onScroll = () => {
      if (queued) return;
      queued = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (queued) cancelAnimationFrame(queued);
    };
  }, [sections]);

  // แผ่นบนมือถือ: กด Esc ปิดได้
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const goTo = useCallback(
    (i: number) => {
      const s = sections[i];
      if (!s) return;
      setActive(i);
      setOpen(false);
      // scroll-margin-top ของหัวข้อ (globals.css) เว้นที่ให้แถบเมนูไม่บัง
      document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth" });
      history.replaceState(null, "", `#${s.id}`);
    },
    [sections],
  );

  const list = (
    <ul className="flex flex-col gap-1">
      {sections.map((s, i) => {
        const on = i === active;
        return (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              onClick={(e) => {
                e.preventDefault();
                goTo(i);
              }}
              aria-current={on ? "location" : undefined}
              className={`group relative flex min-h-11 items-center gap-2 rounded-xl py-2 pl-4 pr-3 text-[0.95rem] font-semibold leading-snug transition-colors ${
                on ? "bg-brand-600 text-white" : "text-gray-700 hover:bg-brand-50 hover:text-brand-800"
              }`}
            >
              {/* แถบสีด้านซ้าย: ชี้แล้วยืดเต็มความสูง */}
              <span
                aria-hidden="true"
                className={`absolute inset-y-2 left-0 w-1 origin-center rounded-full transition-transform duration-300 ${
                  on ? "scale-y-100 bg-white" : "scale-y-40 bg-brand-500 opacity-40 group-hover:scale-y-100 group-hover:opacity-100"
                }`}
              />
              <span className="min-w-0 flex-1 transition-transform duration-200 group-hover:translate-x-1">
                {s.label}
              </span>
              {on ? (
                <span aria-hidden="true" className="relative flex h-2 w-2 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                </span>
              ) : (
                s.count > 0 && (
                  <span className="shrink-0 rounded-full bg-brand-50 px-2 text-xs font-semibold text-brand-700 ring-1 ring-brand-100">
                    {s.count} คน
                  </span>
                )
              )}
            </a>
          </li>
        );
      })}
    </ul>
  );

  const head = (
    <div className="flex flex-col gap-2 border-b border-brand-100 px-4 pb-3 pt-4">
      <div className="flex items-center gap-2">
        <ListTree className="h-4 w-4 text-brand-600" aria-hidden="true" />
        <span className="font-bold text-brand-800">ทำเนียบ</span>
        <span className="ml-auto text-xs text-gray-500">อ่านแล้ว {progress}%</span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-brand-50" aria-hidden="true">
        <div className="h-1 rounded-full bg-brand-600 transition-[width] duration-300" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );

  return (
    <>
      {/* จอกว้าง: ติดจอด้านซ้าย */}
      <nav aria-label="ไปยังฝ่ายต่าง ๆ" className="sticky top-24 hidden max-h-[calc(100vh-7rem)] overflow-y-auto rounded-2xl bg-white/85 shadow-sm ring-1 ring-black/5 backdrop-blur lg:block">
        {head}
        <div className="p-2">{list}</div>
      </nav>

      {/* จอแคบ: ปุ่มลอย + แผ่นจากด้านล่าง */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="dir-sheet"
        className="fixed bottom-5 left-5 z-50 flex h-11 items-center gap-2 rounded-full bg-brand-800 px-4 text-sm font-semibold text-white shadow-lg ring-1 ring-black/5 transition hover:bg-brand-900 lg:hidden"
      >
        <ListTree className="h-4 w-4" aria-hidden="true" /> ทำเนียบ
      </button>
      {open && (
        <div className="fixed inset-0 z-60 lg:hidden">
          <button
            type="button"
            aria-label="ปิด"
            onClick={() => setOpen(false)}
            className="absolute inset-0 h-full w-full bg-brand-900/45 backdrop-blur-[2px]"
          />
          <div
            id="dir-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="ไปยังฝ่ายต่าง ๆ"
            className="absolute inset-x-0 bottom-0 max-h-[75vh] overflow-y-auto rounded-t-3xl bg-white pb-6 shadow-2xl"
          >
            <div className="flex justify-center pt-2" aria-hidden="true">
              <span className="h-1 w-10 rounded-full bg-gray-300" />
            </div>
            {/* เว้นขวาให้ปุ่มปิด ไม่ทับตัวเลขอ่านแล้ว % */}
            <div className="relative pr-12">
              {head}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="ปิด"
                className="absolute right-2 top-1 grid h-11 w-11 place-items-center rounded-full text-gray-600 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-3">{list}</div>
          </div>
        </div>
      )}
    </>
  );
}
