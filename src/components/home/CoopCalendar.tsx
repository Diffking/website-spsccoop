"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { CalendarX, Bus, FolderKanban, Presentation, MapPin, Clock, ChevronLeft, ChevronRight, RotateCcw, CalendarDays } from "lucide-react";
import SectionHeading from "@/components/ui/SectionHeading";
import type { CalendarEvent } from "@/data/home";
import { useIsClient } from "@/lib/useIsClient";

const TYPE = {
  holiday: { color: "bg-accent-red", ring: "ring-accent-red/30", Icon: CalendarX, label: "วันหยุด" },
  mobile: { color: "bg-brand-400", ring: "ring-brand-400/30", Icon: Bus, label: "รถโมบาย" },
  project: { color: "bg-purple-500", ring: "ring-purple-500/30", Icon: FolderKanban, label: "โครงการ" },
  seminar: { color: "bg-accent-green", ring: "ring-accent-green/30", Icon: Presentation, label: "สัมมนา" },
} as const;

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];
const THAI_DOW = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function EventItem({ ev }: { ev: CalendarEvent }) {
  const t = TYPE[ev.type];
  return (
    <div className={`rounded-lg bg-gray-50 p-2.5 text-left ring-1 ${t.ring}`}>
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium text-white ${t.color}`}>
        <t.Icon className="h-3 w-3" /> {t.label}
      </span>
      <p className="mt-1.5 break-words text-sm font-semibold leading-snug text-gray-800">{ev.title}</p>
      {ev.place && (
        // กิจกรรมที่ดึงมาจากสไลด์ใช้คำโปรยของสไลด์ ซึ่งบางใบยาวเป็นย่อหน้า — ตัดไว้ 3 บรรทัด
        // ไม่งั้นการ์ดวันนั้นยืดยาวจนดันการ์ดข้าง ๆ เสียรูป
        <p className="mt-1 flex items-start gap-1 text-xs text-gray-500" title={ev.place}>
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-400" />
          <span className="line-clamp-3">{ev.place}</span>
        </p>
      )}
      {ev.time && (
        <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-400">
          <Clock className="h-3.5 w-3.5 shrink-0" /> {ev.time}
        </p>
      )}
    </div>
  );
}

/**
 * ความสูงตายตัวของการ์ดวัน — วันที่มีกิจกรรม 1 กับ 5 รายการต้องสูงเท่ากัน
 * ไม่งั้นเลื่อนไปมาแล้วทั้งแถวกระตุกขึ้นลงตามจำนวนกิจกรรมของแต่ละวัน
 */
const CARD_HEIGHT = "h-[19rem] md:h-[23rem]";

function DayCard({
  day, year, month, today, focus, events,
}: {
  day: number | null; year: number; month: number; today: number; focus: boolean; events: CalendarEvent[];
}) {
  // ช่องว่างเมื่อเลยขอบเดือน (คงรูปแบบ 3 คอลัมน์)
  if (day === null) {
    return <div className={`rounded-2xl border-2 border-dashed border-brand-100/70 ${CARD_HEIGHT}`} />;
  }

  const dow = new Date(year, month, day).getDay();
  const evs = events.filter((e) => e.day === day);
  const isToday = day === today;
  const rel = day < today ? "ผ่านมาแล้ว" : isToday ? "วันนี้" : "ล่วงหน้า";
  const relColor = day < today ? "bg-gray-400" : isToday ? "bg-brand-500" : "bg-accent-green";

  return (
    <div
      className={`flex min-w-0 flex-col overflow-hidden rounded-2xl bg-white p-3 transition md:p-4 ${CARD_HEIGHT} ${
        focus
          ? "shadow-xl ring-2 ring-brand-400"
          : "opacity-90 shadow-sm ring-1 ring-brand-100"
      }`}
    >
      {/* ป้ายอดีต/วันนี้/อนาคต */}
      <span className={`mx-auto rounded-full px-2.5 py-0.5 text-[10px] font-semibold text-white md:text-xs ${relColor}`}>
        {rel}
      </span>

      {/* วันที่ */}
      <div className="mt-2 text-center">
        <span className={`block font-bold leading-none ${focus ? "text-4xl text-brand-600 md:text-5xl" : "text-2xl text-gray-700 md:text-3xl"}`}>
          {day}
        </span>
        <span className="mt-1 block text-[11px] text-gray-500 md:text-sm">
          {THAI_DOW[dow]} · {THAI_MONTHS[month]}
        </span>
      </div>

      {/*
        กิจกรรม — วันไหนมีหลายรายการให้เลื่อนดูในกรอบ ไม่ยืดการ์ดให้สูงขึ้น
        (ก่อนหน้านี้วันที่มี 3 กิจกรรมจะดันการ์ดข้าง ๆ สูงตามไปด้วยทั้งแถว)
      */}
      <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-0.5">
        {evs.length > 0 ? (
          evs.map((ev, i) => <EventItem key={i} ev={ev} />)
        ) : (
          <p className="grid h-full min-h-16 place-items-center text-center text-xs text-gray-300">
            — ไม่มีกิจกรรม —
          </p>
        )}
      </div>

      {/* บอกจำนวนไว้ เพราะกิจกรรมที่เกินกรอบต้องเลื่อนถึงจะเห็น */}
      {evs.length > 1 && (
        <p className="mt-1.5 shrink-0 text-center text-[11px] text-gray-400">
          {evs.length} กิจกรรม · เลื่อนดูในกรอบ
        </p>
      )}
    </div>
  );
}

// events = กิจกรรมสหกรณ์ (แก้ที่ /admin/home/calendar) · holidays = วันหยุด (แก้ที่ /admin/holidays)
export default function CoopCalendar({
  holidays = [],
  events = [],
  bg = "bg-sky-soft",
}: {
  holidays?: CalendarEvent[];
  events?: CalendarEvent[];
  bg?: string;
}) {
  const isClient = useIsClient();
  // null = ยังไม่ได้เลื่อนเอง ให้ยึดวันนี้เป็นศูนย์กลาง
  const [center, setCenter] = useState<number | null>(null);
  const [dir, setDir] = useState(0);

  const legend = (
    <div className="mb-6 flex flex-wrap justify-center gap-4 text-sm text-gray-600">
      {Object.values(TYPE).map((t) => (
        <span key={t.label} className="flex items-center gap-1.5">
          <span className={`h-3 w-3 rounded-full ${t.color}`} /> {t.label}
        </span>
      ))}
    </div>
  );

  // วันที่ของเครื่องผู้ใช้ — ตอน SSR ยังไม่รู้ ต้องวางโครงเปล่าไว้ก่อน
  if (!isClient) {
    return (
      <section className={`${bg} py-12`}>
        <div className="mx-auto max-w-6xl px-4">
          <SectionHeading title="ปฏิทินสหกรณ์" />
          {legend}
          <div className="h-56 rounded-2xl bg-white/50" />
        </div>
      </section>
    );
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const active = center ?? today;
  const allEvents = [...events, ...holidays];

  const go = (step: number) => {
    setDir(step);
    setCenter((c) => clamp((c ?? today) + step, 1, daysInMonth));
  };
  const backToToday = () => {
    setDir(today < active ? -1 : 1);
    setCenter(today);
  };

  const inRange = (d: number) => (d >= 1 && d <= daysInMonth ? d : null);
  const cols = [inRange(active - 1), inRange(active), inRange(active + 1)];

  return (
    <section className={`${bg} py-12`}>
      <div className="mx-auto max-w-6xl px-4">
        <SectionHeading title="ปฏิทินสหกรณ์" subtitle={`ประจำเดือน${THAI_MONTHS[month]} ${year + 543}`} />
        {legend}

        <div className="relative mx-auto max-w-3xl">
          {/* ปุ่มเลื่อนไปอดีต */}
          <button
            onClick={() => go(-1)}
            disabled={active <= 1}
            aria-label="ดูวันก่อนหน้า"
            className="absolute -left-2 top-1/2 z-20 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white text-brand-600 shadow-lg ring-1 ring-brand-100 transition hover:bg-brand-500 hover:text-white disabled:opacity-30 md:-left-5"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          {/* ปุ่มเลื่อนไปอนาคต */}
          <button
            onClick={() => go(1)}
            disabled={active >= daysInMonth}
            aria-label="ดูวันถัดไป"
            className="absolute -right-2 top-1/2 z-20 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white text-brand-600 shadow-lg ring-1 ring-brand-100 transition hover:bg-brand-500 hover:text-white disabled:opacity-30 md:-right-5"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          {/*
            3 คอลัมน์: อดีต | ปัจจุบัน | อนาคต
            สไลด์เบา ๆ อย่างเดียว ไม่ fade — การ์ดสูงเท่ากันทุกใบอยู่แล้ว แถวจึงไม่ขยับตอนเปลี่ยนวัน
            ระยะเลื่อนสั้นและใช้ spring หน่วง ๆ ให้ดูลื่นตา ไม่กระตุกเหมือนกระโดดทีเดียวจบ
          */}
          <div className="overflow-hidden px-1">
            <motion.div
              key={active}
              initial={{ x: dir * 18 }}
              animate={{ x: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 30, mass: 0.7 }}
              className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)] items-stretch gap-2 md:gap-4"
            >
              {cols.map((d, i) => (
                <DayCard key={i} day={d} year={year} month={month} today={today} focus={i === 1} events={allEvents} />
              ))}
            </motion.div>
          </div>
        </div>

        {/* ปุ่มกลับมาวันนี้ (โผล่เมื่อเลื่อนออกจากวันนี้) */}
        {active !== today && (
          <div className="mt-5 text-center">
            <button
              onClick={backToToday}
              className="inline-flex items-center gap-1.5 rounded-full bg-brand-500 px-4 py-1.5 text-sm font-medium text-white shadow transition hover:bg-brand-600"
            >
              <RotateCcw className="h-4 w-4" /> กลับมาวันนี้
            </button>
          </div>
        )}

        <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-gray-500">
          <CalendarDays className="h-3.5 w-3.5" /> เลื่อนซ้ายดูวันที่ผ่านมา · เลื่อนขวาดูวันถัดไป (ในเดือนนี้)
        </p>
      </div>
    </section>
  );
}
