"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Loader2, RotateCcw, Save } from "lucide-react";
import {
  DAY_NAMES,
  DAY_SHORT,
  describeClosedDays,
  describeOfficeHours,
  type OfficeHours,
} from "@/lib/officeHours";

/**
 * ตั้งวันและเวลาทำการ
 *
 * ค่านี้ใช้สองที่พร้อมกัน — ป้าย "เปิดทำการ / ปิดทำการ" บนหัวเว็บ และข้อความเวลาทำการท้ายเว็บ
 * เดิมข้อความท้ายเว็บพิมพ์เอง ส่วนป้ายบนหัวเว็บฮาร์ดโค้ดว่าเปิดตลอด สองอันจึงไม่ตรงกัน
 */
export default function OfficeHoursForm({ initial }: { initial: OfficeHours }) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  const closed = describeClosedDays(form);

  const toggleDay = (day: number) => {
    setStatus(null);
    setForm((f) => ({
      ...f,
      days: f.days.includes(day) ? f.days.filter((d) => d !== day) : [...f.days, day].sort(),
    }));
  };

  async function save() {
    setBusy(true);
    setStatus(null);

    const response = await fetch("/api/admin/home/", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ officeHours: form }),
    });
    const data = await response.json().catch(() => ({}));
    setBusy(false);

    if (!response.ok) {
      setStatus({ kind: "error", text: data.error ?? "บันทึกไม่สำเร็จ" });
      return;
    }
    setSaved(form);
    setStatus({ kind: "ok", text: "บันทึกแล้ว — หัวเว็บและท้ายเว็บเปลี่ยนตามทันที" });
    router.refresh();
  }

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
          <Clock className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-semibold text-gray-800">วันและเวลาทำการ</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            ใช้ทั้งป้าย “เปิดทำการ / ปิดทำการ” บนหัวเว็บ และข้อความเวลาทำการท้ายเว็บ ·
            วันหยุดสหกรณ์ที่ตั้งไว้ในเมนู “วันหยุด” ถือเป็นปิดทำการเสมอ ไม่ต้องมาตั้งซ้ำที่นี่
          </p>
        </div>
      </div>

      <p className="mt-4 text-sm text-gray-600">วันทำการ</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {DAY_NAMES.map((name, day) => {
          const on = form.days.includes(day);
          return (
            <button
              key={name}
              type="button"
              onClick={() => toggleDay(day)}
              title={`วัน${name}`}
              className={`grid h-10 w-12 place-items-center rounded-xl text-sm font-medium transition ${
                on
                  ? "bg-brand-600 text-white shadow-sm"
                  : "bg-gray-100 text-gray-400 hover:bg-gray-200"
              }`}
            >
              {DAY_SHORT[day]}
            </button>
          );
        })}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs text-gray-500">เปิด</span>
          <input
            type="time"
            value={form.open}
            onChange={(e) => {
              setStatus(null);
              setForm((f) => ({ ...f, open: e.target.value }));
            }}
            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
          />
        </label>
        <label className="block">
          <span className="text-xs text-gray-500">ปิด</span>
          <input
            type="time"
            value={form.close}
            onChange={(e) => {
              setStatus(null);
              setForm((f) => ({ ...f, close: e.target.value }));
            }}
            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
          />
        </label>
      </div>

      {/* ข้อความที่จะขึ้นจริงบนเว็บ — เห็นก่อนบันทึก */}
      <div className="mt-4 rounded-xl bg-gray-50 p-3 text-sm">
        <p className="text-gray-700">{describeOfficeHours(form)}</p>
        {closed && <p className="mt-1 text-gray-500">{closed} และวันหยุดสหกรณ์ — ปิดทำการ</p>}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          onClick={save}
          disabled={busy || !dirty}
          className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow transition hover:bg-brand-700 disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          บันทึก
        </button>
        {dirty && (
          <button
            onClick={() => {
              setForm(saved);
              setStatus(null);
            }}
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-sm text-gray-600 shadow-sm ring-1 ring-black/5 transition hover:text-gray-800"
          >
            <RotateCcw className="h-4 w-4" /> ยกเลิก
          </button>
        )}
        {!dirty && !status && <span className="text-sm text-gray-400">ยังไม่มีอะไรเปลี่ยน</span>}
        {status && (
          <span className={`text-sm ${status.kind === "ok" ? "text-emerald-600" : "text-red-500"}`}>
            {status.text}
          </span>
        )}
      </div>
    </section>
  );
}
