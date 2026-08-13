"use client";

import { useState } from "react";
import ThaiDatePicker from "@/components/admin/ThaiDatePicker";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { Plus, Trash2, Eye, EyeOff, Loader2, CalendarOff } from "lucide-react";

export type HolidayRow = {
  id: string;
  /** "YYYY-MM-DD" */
  date: string;
  title: string;
  note: string | null;
  published: boolean;
};

const thaiDate = new Intl.DateTimeFormat("th-TH", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Asia/Bangkok",
});

/** "2569-08-11" ในช่อง input เป็น ค.ศ. — แปลงเป็นข้อความไทยอ่านง่าย */
function readable(date: string): string {
  const d = new Date(`${date}T00:00:00+07:00`);
  return Number.isNaN(d.getTime()) ? "—" : thaiDate.format(d);
}

export default function HolidaysManager({ items }: { items: HolidayRow[] }) {
  const router = useRouter();
  const [date, setDate] = useState("");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function call(url: string, init: RequestInit) {
    setBusy(true);
    setError(null);
    const response = await fetch(url, init);
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setError(data.error ?? "ทำรายการไม่สำเร็จ");
      return false;
    }
    router.refresh();
    return true;
  }

  async function add() {
    if (!date || !title.trim()) {
      setError("กรุณาเลือกวันที่และใส่ชื่อวันหยุด");
      return;
    }
    const ok = await call("/api/admin/holidays/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, title, note }),
    });
    if (ok) {
      setDate("");
      setTitle("");
      setNote("");
    }
  }

  const toggle = (h: HolidayRow) =>
    call(`/api/admin/holidays/${h.id}/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published: !h.published }),
    });

  const remove = (h: HolidayRow) =>
    call(`/api/admin/holidays/${h.id}/`, { method: "DELETE" });

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <h2 className="font-semibold text-gray-800">เพิ่มวันหยุด</h2>
        <p className="mt-0.5 text-xs text-gray-500">
          วันหยุดทำการของสหกรณ์ จะไปขึ้นบนปฏิทินหน้าแรกของเว็บไซต์
        </p>

        <div className="mt-3 grid gap-2.5 sm:grid-cols-[10rem_1fr]">
          <div className="block">
            <span className="text-xs text-gray-500">วันที่</span>
            <ThaiDatePicker value={date} onChange={setDate} className="mt-1" />
          </div>
          <label className="block">
            <span className="text-xs text-gray-500">ชื่อวันหยุด</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="เช่น วันเฉลิมพระชนมพรรษา พระบาทสมเด็จพระเจ้าอยู่หัว"
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
            />
          </label>
        </div>

        <label className="mt-2.5 block">
          <span className="text-xs text-gray-500">หมายเหตุ (เว้นว่างได้)</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="เช่น หยุดชดเชย · สำนักงานปิดทำการ 1 วัน"
            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
          />
        </label>

        {date && (
          <p className="mt-2 text-xs text-brand-600">ตรงกับ{readable(date)}</p>
        )}

        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={add}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-brand-700 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            เพิ่มวันหยุด
          </button>
          {error && <span className="text-sm text-red-500">{error}</span>}
        </div>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <h2 className="font-semibold text-gray-800">
          วันหยุดทั้งหมด{" "}
          <span className="text-sm font-normal text-gray-400">({items.length} วัน)</span>
        </h2>

        {items.length === 0 ? (
          <p className="mt-4 grid place-items-center gap-2 rounded-xl bg-gray-50 py-10 text-center text-sm text-gray-400">
            <CalendarOff className="h-6 w-6 text-gray-300" />
            ยังไม่มีวันหยุด — เพิ่มรายการแรกด้านบน
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-gray-100">
            <AnimatePresence initial={false}>
              {items.map((h) => (
                <motion.li
                  key={h.id}
                  layout
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className="flex items-center gap-3 py-3"
                >
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate text-sm font-medium ${
                        h.published ? "text-gray-800" : "text-gray-400 line-through"
                      }`}
                    >
                      {h.title}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-gray-500">
                      {readable(h.date)}
                      {h.note ? ` · ${h.note}` : ""}
                    </span>
                  </span>

                  <button
                    onClick={() => toggle(h)}
                    disabled={busy}
                    title={h.published ? "ซ่อนจากหน้าเว็บ" : "แสดงบนหน้าเว็บ"}
                    className="shrink-0 rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-brand-600 disabled:opacity-50"
                  >
                    {h.published ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={() => remove(h)}
                    disabled={busy}
                    title="ลบ"
                    className="shrink-0 rounded-lg p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </section>
    </div>
  );
}
