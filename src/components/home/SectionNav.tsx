"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";

/**
 * ตัวนำทางลอยด้านซ้ายของหน้าแรก — บอกว่าตอนนี้อ่านอยู่ส่วนไหน และกระโดดไปส่วนอื่นได้
 *
 * รายการที่โชว์มาจากลำดับจริงที่จัดไว้ในหลังบ้าน (/admin/home) ส่วนที่ปิดไว้ก็ไม่มีในนี้
 * — ส่งมาจาก page.tsx ไม่ได้คำนวณเอง จะได้ตรงกับที่วาดจริงเสมอ
 *
 * ทำไมไม่ดักล้อเมาส์ให้เลื่อนทีละส่วน: คนที่เคยชินกับการเลื่อนเองจะหงุดหงิดมาก
 * และการกดค้นหาในหน้า (Ctrl+F) จะพาไปไม่ถูกที่ · ให้กดปุ่มเอาแทน ควบคุมได้เต็มที่
 * เจ้าของเว็บเลือกทางนี้เอง 21 ส.ค. 2026
 */
export default function SectionNav({ items }: { items: { key: string; label: string }[] }) {
  const [active, setActive] = useState(0);
  const [shown, setShown] = useState(false);

  /*
    หาว่าตอนนี้อยู่ส่วนไหน — ส่วนที่ขอบบนเลยหัวเว็บไปแล้วและอยู่สูงสุด คือส่วนที่กำลังอ่าน

    ⚠️ ต้องคิดใน requestAnimationFrame ไม่ใช่คิดทุกครั้งที่ scroll ยิงมา
    การเลื่อนหนึ่งครั้งยิง event ได้หลายสิบครั้งต่อวินาที และงานข้างในต้องอ่าน
    ตำแหน่งจริงของทุกส่วน (`getBoundingClientRect`) ซึ่งบังคับให้เบราว์เซอร์
    คำนวณ layout ใหม่ทุกครั้ง — ทำตรง ๆ คือถ่วงการเลื่อนทั้งหน้าให้สะดุด
    แบบนี้คิดอย่างมากเฟรมละครั้ง เท่าที่จอวาดได้จริง ไม่มีงานเกินความจำเป็น
  */
  useEffect(() => {
    if (items.length === 0) return;

    let queued = 0;

    const measure = () => {
      queued = 0;
      // โผล่มาเมื่อเลื่อนพ้นช่วงหัวเว็บแล้ว ไม่งั้นบังแบนเนอร์ตอนเพิ่งเปิดหน้า
      setShown(window.scrollY > 240);

      // เทียบกับเส้นสมมุติใต้แถบเมนู ไม่ใช่ขอบบนจอ ไม่งั้นส่วนที่ถูกแถบเมนูบังจะถูกนับว่ากำลังอ่าน
      const line = 120;
      let found = 0;
      items.forEach((item, i) => {
        const el = document.getElementById(`sec-${item.key}`);
        if (el && el.getBoundingClientRect().top <= line) found = i;
      });
      setActive(found);
    };

    const onScroll = () => {
      if (queued) return;
      queued = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (queued) cancelAnimationFrame(queued);
    };
  }, [items]);

  const goTo = useCallback(
    (index: number) => {
      const item = items[index];
      if (!item) return;
      // scroll-mt-* ที่ตัวส่วน (ดู page.tsx) เป็นตัวเว้นที่ให้แถบเมนูไม่บังหัวข้อ
      document.getElementById(`sec-${item.key}`)?.scrollIntoView({ behavior: "smooth" });
    },
    [items],
  );

  if (items.length === 0) return null;

  return (
    /*
      ซ่อนบนจอแคบ — จอมือถือไม่มีที่ว่างข้างเนื้อหาให้วางแถบนี้ วางไปก็ทับตัวหนังสือ
      pointer-events-none ตอนซ่อน กันไม่ให้กดโดนของที่มองไม่เห็น
    */
    <nav
      aria-label="ไปยังส่วนต่าง ๆ ของหน้าแรก"
      className={`fixed left-3 top-1/2 z-40 hidden -translate-y-1/2 xl:block ${
        shown ? "opacity-100" : "pointer-events-none opacity-0"
      } transition-opacity duration-300`}
    >
      <div className="flex flex-col items-center gap-2 rounded-full bg-white/85 px-2 py-3 shadow-lg ring-1 ring-black/5 backdrop-blur">
        <button
          onClick={() => goTo(Math.max(0, active - 1))}
          disabled={active === 0}
          aria-label="ส่วนก่อนหน้า"
          className="grid h-7 w-7 place-items-center rounded-full text-brand-600 transition hover:bg-brand-50 disabled:opacity-25"
        >
          <ChevronUp className="h-4 w-4" />
        </button>

        <ul className="flex flex-col items-center gap-2">
          {items.map((item, i) => (
            <li key={item.key} className="group relative flex items-center">
              <button
                onClick={() => goTo(i)}
                aria-label={`ไปที่ส่วน ${item.label}`}
                aria-current={i === active ? "true" : undefined}
                className={`block rounded-full transition-all ${
                  i === active ? "h-5 w-2 bg-brand-600" : "h-2 w-2 bg-gray-300 hover:bg-brand-300"
                }`}
              />
              {/* ป้ายชื่อโผล่ตอนเอาเมาส์ชี้ — จุดเปล่า ๆ ไม่บอกอะไรว่าแต่ละจุดคือส่วนไหน */}
              <span className="pointer-events-none absolute left-5 whitespace-nowrap rounded-lg bg-gray-800 px-2 py-1 text-xs text-white opacity-0 shadow transition group-hover:opacity-100">
                {item.label}
              </span>
            </li>
          ))}
        </ul>

        <button
          onClick={() => goTo(Math.min(items.length - 1, active + 1))}
          disabled={active >= items.length - 1}
          aria-label="ส่วนถัดไป"
          className="grid h-7 w-7 place-items-center rounded-full text-brand-600 transition hover:bg-brand-50 disabled:opacity-25"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>
    </nav>
  );
}
