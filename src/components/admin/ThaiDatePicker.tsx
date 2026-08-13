"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

/**
 * เลือกวันที่จากปฏิทิน — เดือนภาษาไทยและปี พ.ศ.
 *
 * ช่อง <input type="date"> ของเบราว์เซอร์บังคับไม่ได้ว่าจะโชว์ภาษาอะไร
 * เครื่องส่วนใหญ่จึงขึ้นเป็นเดือนอังกฤษกับปี ค.ศ. ซึ่งเจ้าหน้าที่ต้องมานั่งลบ 543 เอง
 *
 * ค่าที่รับ/ส่งออกเป็น "YYYY-MM-DD" แบบ ค.ศ. เหมือนเดิม (ฐานข้อมูลกับ API ไม่ต้องแก้)
 * แปลงเป็น พ.ศ. เฉพาะตอนแสดงผลเท่านั้น
 *
 * คิดวันที่แบบข้อความล้วน ไม่แปลงผ่าน Date ที่มี timezone —
 * เคยเจอมาแล้วว่าวันเลื่อนไป 1 วันเพราะเที่ยงคืนไทยคือ 17:00Z ของวันก่อนหน้า
 */

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];
const THAI_MONTHS_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];
const THAI_DOW = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

const pad = (n: number) => String(n).padStart(2, "0");
const toValue = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

/** แยก "YYYY-MM-DD" เป็นตัวเลข — ค่าว่างหรือรูปแบบผิดคืน null */
function parse(value: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");
  if (!match) return null;
  const [, y, m, d] = match;
  return { y: Number(y), m: Number(m) - 1, d: Number(d) };
}

/** "15 สิงหาคม 2569" — ไว้โชว์ในปุ่มและในรายการ */
export function thaiDateLabel(value: string, short = false): string {
  const parsed = parse(value);
  if (!parsed) return "";
  const months = short ? THAI_MONTHS_SHORT : THAI_MONTHS;
  return `${parsed.d} ${months[parsed.m]} ${parsed.y + 543}`;
}

/** วันนี้ตามเวลาไทย ในรูป "YYYY-MM-DD" */
export function todayValue(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
}

export default function ThaiDatePicker({
  value,
  onChange,
  placeholder = "เลือกวันที่",
  className = "",
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const today = parse(todayValue()) ?? { y: 2026, m: 0, d: 1 };
  const picked = parse(value);
  /** เดือนที่กำลังเปิดดูอยู่ในปฏิทิน (ไม่ใช่วันที่ที่เลือก) */
  const [view, setView] = useState(() => ({
    y: picked?.y ?? today.y,
    m: picked?.m ?? today.m,
  }));

  // คลิกที่อื่นแล้วปิด
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const shift = (step: number) => {
    setView((v) => {
      const m = v.m + step;
      if (m < 0) return { y: v.y - 1, m: 11 };
      if (m > 11) return { y: v.y + 1, m: 0 };
      return { y: v.y, m };
    });
  };

  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const firstDow = new Date(view.y, view.m, 1).getDay();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstDow }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  /** ปี พ.ศ. ให้เลือก — ย้อนหลัง 2 ปี ล่วงหน้า 5 ปี พอสำหรับงานสหกรณ์ */
  const years = Array.from({ length: 8 }, (_, i) => today.y - 2 + i);

  return (
    <div ref={box} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => {
          // เปิดทีไรให้เด้งไปเดือนของวันที่ที่เลือกไว้ก่อนเสมอ
          if (!open) setView({ y: picked?.y ?? today.y, m: picked?.m ?? today.m });
          setOpen((v) => !v);
        }}
        className="flex w-full items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-left text-sm transition hover:border-brand-300 focus:border-brand-400 focus:outline-none"
      >
        <CalendarDays className="h-4 w-4 shrink-0 text-brand-500" />
        <span className={value ? "text-gray-800" : "text-gray-400"}>
          {value ? thaiDateLabel(value) : placeholder}
        </span>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-2xl bg-white p-3 shadow-xl ring-1 ring-black/10">
          {/* เลือกเดือน / ปี พ.ศ. */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => shift(-1)}
              aria-label="เดือนก่อนหน้า"
              className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-gray-500 transition hover:bg-gray-100"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <select
              value={view.m}
              onChange={(e) => setView((v) => ({ ...v, m: Number(e.target.value) }))}
              aria-label="เดือน"
              className="min-w-0 flex-1 rounded-lg border border-gray-200 px-2 py-1 text-sm outline-none focus:border-brand-400"
            >
              {THAI_MONTHS.map((name, i) => (
                <option key={name} value={i}>
                  {name}
                </option>
              ))}
            </select>

            <select
              value={view.y}
              onChange={(e) => setView((v) => ({ ...v, y: Number(e.target.value) }))}
              aria-label="ปี พ.ศ."
              className="shrink-0 rounded-lg border border-gray-200 px-2 py-1 text-sm outline-none focus:border-brand-400"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y + 543}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => shift(1)}
              aria-label="เดือนถัดไป"
              className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-gray-500 transition hover:bg-gray-100"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-2 grid grid-cols-7 gap-0.5 text-center text-[11px] text-gray-400">
            {THAI_DOW.map((d) => (
              <span key={d} className="py-1">
                {d}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((d, i) => {
              if (d === null) return <span key={`empty-${i}`} />;
              const self = toValue(view.y, view.m, d);
              const isPicked = value === self;
              const isToday = self === toValue(today.y, today.m, today.d);
              return (
                <button
                  key={self}
                  type="button"
                  onClick={() => {
                    onChange(self);
                    setOpen(false);
                  }}
                  className={`h-8 rounded-lg text-sm tabular-nums transition ${
                    isPicked
                      ? "bg-brand-600 font-semibold text-white"
                      : isToday
                        ? "bg-brand-50 font-semibold text-brand-700"
                        : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {d}
                </button>
              );
            })}
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2">
            <button
              type="button"
              onClick={() => {
                onChange(todayValue());
                setOpen(false);
              }}
              className="rounded-lg px-2 py-1 text-xs font-medium text-brand-600 transition hover:bg-brand-50"
            >
              วันนี้
            </button>
            {value && (
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
                className="rounded-lg px-2 py-1 text-xs text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
              >
                ล้างวันที่
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
