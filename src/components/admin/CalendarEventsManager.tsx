"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { Plus, Trash2, Eye, EyeOff, Loader2, Bus, FolderKanban, Presentation } from "lucide-react";
import type { EventItem } from "@/lib/homeItems";
import ThaiDatePicker, { thaiDateLabel, todayValue } from "@/components/admin/ThaiDatePicker";

const TYPES = [
  { key: "mobile", label: "รถโมบาย", icon: Bus, tone: "text-brand-600" },
  { key: "project", label: "โครงการ", icon: FolderKanban, tone: "text-purple-600" },
  { key: "seminar", label: "สัมมนา", icon: Presentation, tone: "text-accent-green" },
] as const;

export default function CalendarEventsManager({ items }: { items: EventItem[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Record<string, string>>({
    type: "project",
    date: todayValue(),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: string, value: string) => setDraft((prev) => ({ ...prev, [key]: value }));

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

  const patch = (id: string, body: Record<string, unknown>) =>
    call(`/api/admin/calendar-events/${id}/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  async function add() {
    const ok = await call("/api/admin/calendar-events/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    if (ok) setDraft({ type: "project", date: todayValue() });
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <h2 className="font-semibold text-gray-800">เพิ่มกิจกรรม</h2>
        <p className="mt-0.5 text-xs text-gray-500">
          เลือกวันที่จากปฏิทิน (เดือนไทย ปี พ.ศ.) — หน้าแรกจะขึ้นเฉพาะกิจกรรมของเดือนนั้น
          · วันหยุดทำการอยู่คนละเมนู ที่ &ldquo;วันหยุด&rdquo;
        </p>

        <div className="mt-3 grid gap-2.5 sm:grid-cols-[11rem_minmax(0,1fr)]">
          <div className="block">
            <span className="text-xs text-gray-500">วันที่</span>
            <ThaiDatePicker
              value={draft.date ?? ""}
              onChange={(next) => set("date", next)}
              className="mt-1"
            />
          </div>
          <label className="block">
            <span className="text-xs text-gray-500">ชื่อกิจกรรม</span>
            <input
              value={draft.title ?? ""}
              onChange={(e) => set("title", e.target.value)}
              placeholder="เช่น หน่วยบริการเคลื่อนที่ (รถโมบาย)"
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
            />
          </label>
        </div>

        <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs text-gray-500">สถานที่ (เว้นว่างได้)</span>
            <input
              value={draft.place ?? ""}
              onChange={(e) => set("place", e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
            />
          </label>
          <label className="block">
            <span className="text-xs text-gray-500">เวลา (เว้นว่างได้)</span>
            <input
              value={draft.time ?? ""}
              onChange={(e) => set("time", e.target.value)}
              placeholder="09:00 – 12:00 น."
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
            />
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-500">ประเภท:</span>
          {TYPES.map((t) => (
            <button
              key={t.key}
              onClick={() => set("type", t.key)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                (draft.type ?? "project") === t.key
                  ? "bg-brand-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <t.icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={add}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-brand-700 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            เพิ่มกิจกรรม
          </button>
          {error && <span className="text-sm text-red-500">{error}</span>}
        </div>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <h2 className="font-semibold text-gray-800">
          กิจกรรมทั้งหมด <span className="text-sm font-normal text-gray-400">({items.length})</span>
        </h2>

        {items.length === 0 ? (
          <p className="mt-4 rounded-xl bg-gray-50 py-8 text-center text-sm text-gray-400">
            ยังไม่มีกิจกรรม
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-gray-100">
            <AnimatePresence initial={false}>
              {items.map((item) => {
                const meta = TYPES.find((t) => t.key === item.type) ?? TYPES[1];
                return (
                  <motion.li
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                    className="flex items-center gap-3 py-3"
                  >
                    <span className="grid h-12 w-14 shrink-0 place-items-center rounded-xl bg-gray-50 leading-none text-gray-700">
                      <span className="text-base font-bold tabular-nums">{item.day}</span>
                      <span className="mt-0.5 text-[10px] text-gray-500">
                        {item.date ? thaiDateLabel(item.date, true).split(" ").slice(1).join(" ") : "ทุกเดือน"}
                      </span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block truncate text-sm font-medium ${
                          item.published ? "text-gray-800" : "text-gray-400 line-through"
                        }`}
                      >
                        {item.title}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-500">
                        <meta.icon className={`h-3.5 w-3.5 ${meta.tone}`} />
                        {meta.label}
                        {item.place ? ` · ${item.place}` : ""}
                        {item.time ? ` · ${item.time}` : ""}
                      </span>
                    </span>

                    <ThaiDatePicker
                      value={item.date}
                      onChange={(next) => next && patch(item.id, { date: next })}
                      placeholder="ระบุวันที่"
                      className="w-40 shrink-0"
                    />
                    <button
                      onClick={() => patch(item.id, { published: !item.published })}
                      disabled={busy}
                      title={item.published ? "ซ่อนจากปฏิทิน" : "แสดงบนปฏิทิน"}
                      className="shrink-0 rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-brand-600 disabled:opacity-50"
                    >
                      {item.published ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() =>
                        call(`/api/admin/calendar-events/${item.id}/`, { method: "DELETE" })
                      }
                      disabled={busy}
                      title="ลบ"
                      className="shrink-0 rounded-lg p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </section>
    </div>
  );
}
