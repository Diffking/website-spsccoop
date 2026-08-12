"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw, Save, Megaphone } from "lucide-react";
import type { TickerSettings } from "@/lib/settings";
import type { TickerEntry } from "@/lib/content";

/**
 * ตั้งค่าข่าววิ่ง + ดูตัวอย่างว่าจะวิ่งอะไรบ้าง
 *
 * ตัวอย่างมาจากเซิร์ฟเวอร์ (ของจริงที่คำนวณแล้ว) จึงเป็นชุดของค่าที่ "บันทึกไว้"
 * ไม่ใช่ค่าที่กำลังแก้ค้างอยู่ — กดบันทึกแล้วหน้าจะรีเฟรชตัวอย่างให้เอง
 */
export default function TickerSettingsForm({
  initial,
  preview,
}: {
  initial: TickerSettings;
  preview: TickerEntry[];
}) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  const set = <K extends keyof TickerSettings>(key: K, value: TickerSettings[K]) => {
    setStatus(null);
    setForm((f) => ({ ...f, [key]: value }));
  };

  async function save() {
    setBusy(true);
    setStatus(null);

    const response = await fetch("/api/admin/home/", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticker: form }),
    });
    const data = await response.json().catch(() => ({}));
    setBusy(false);

    if (!response.ok) {
      setStatus({ kind: "error", text: data.error ?? "บันทึกไม่สำเร็จ" });
      return;
    }
    setSaved(form);
    setStatus({ kind: "ok", text: "บันทึกแล้ว — หน้าแรกเปลี่ยนตามทันที" });
    router.refresh();
  }

  const field =
    "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400";

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
          <Megaphone className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-semibold text-gray-800">ดึงประกาศมาวิ่งอัตโนมัติ</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            ไม่ต้องมาพิมพ์ซ้ำ — ระบบหยิบประกาศล่าสุดจากเมนู “ประกาศ / จดหมายข่าว” มาวิ่งให้เอง
            ออกประกาศใหม่เมื่อไหร่ข่าววิ่งเปลี่ยนตามทันที
          </p>
        </div>
      </div>

      <label className="mt-4 flex items-start gap-2.5 rounded-xl bg-gray-50 p-3">
        <input
          type="checkbox"
          checked={form.auto}
          onChange={(e) => set("auto", e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-brand-600"
        />
        <span className="text-sm text-gray-700">
          เปิดใช้งาน
          <span className="mt-0.5 block text-xs text-gray-500">
            ปิดแล้วจะวิ่งเฉพาะข้อความที่พิมพ์เองด้านล่าง
          </span>
        </span>
      </label>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm text-gray-600">ดึงประกาศมากี่รายการ</span>
          <input
            type="number"
            min={1}
            max={30}
            value={form.limit}
            onChange={(e) => set("limit", Number(e.target.value))}
            disabled={!form.auto}
            className={`${field} disabled:bg-gray-50 disabled:text-gray-400`}
          />
          <span className="mt-1 block text-xs text-gray-400">มากสุด 30 · ปกติใช้ 10</span>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm text-gray-600">คำบนป้าย</span>
          <input
            value={form.badgeText}
            onChange={(e) => set("badgeText", e.target.value)}
            maxLength={12}
            placeholder="New"
            className={field}
          />
          <span className="mt-1 block text-xs text-gray-400">
            เปลี่ยนเป็น “ใหม่” “ด่วน” หรืออะไรก็ได้ · เว้นว่าง = ไม่ติดป้าย
          </span>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm text-gray-600">ติดป้ายให้กี่รายการแรก</span>
          <input
            type="number"
            min={0}
            max={30}
            value={form.badgeCount}
            onChange={(e) => set("badgeCount", Number(e.target.value))}
            className={field}
          />
          <span className="mt-1 block text-xs text-gray-400">0 = ไม่ติดป้ายเลย</span>
        </label>

        <label className="flex items-start gap-2.5 self-end pb-1">
          <input
            type="checkbox"
            checked={form.badgeBlink}
            onChange={(e) => set("badgeBlink", e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-brand-600"
          />
          <span className="text-sm text-gray-700">
            ให้ป้ายกระพริบ
            <span className="mt-0.5 block text-xs text-gray-500">
              เครื่องที่ตั้งค่าลดการเคลื่อนไหวไว้จะเห็นเป็นป้ายนิ่ง
            </span>
          </span>
        </label>
      </div>

      {/* ตัวอย่างป้าย — ใช้คลาสเดียวกับของจริงบนหน้าเว็บ */}
      <div className="mt-4 rounded-xl bg-gray-900 px-4 py-3">
        <p className="mb-2 text-[11px] text-gray-400">ตัวอย่างป้าย</p>
        {form.badgeText.trim() && form.badgeCount > 0 ? (
          <span className="inline-flex items-center gap-2 text-sm text-white">
            <span
              className={`rounded-full bg-accent-red px-2 py-0.5 text-[11px] font-bold uppercase leading-none text-white ${
                form.badgeBlink ? "animate-blink" : ""
              }`}
            >
              {form.badgeText}
            </span>
            ประกาศที่ 19/2569 จ่ายเงินสวัสดิการสงเคราะห์สมาชิกผู้เสียชีวิต
          </span>
        ) : (
          <span className="inline-flex items-center gap-2 text-sm text-white">
            <span className="text-accent-red">•</span>
            ประกาศที่ 19/2569 จ่ายเงินสวัสดิการสงเคราะห์สมาชิกผู้เสียชีวิต
            <span className="text-xs text-gray-500">(ไม่ติดป้าย)</span>
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          onClick={save}
          disabled={busy || !dirty}
          className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-brand-700 disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          บันทึกการตั้งค่า
        </button>
        {dirty && (
          <button
            onClick={() => {
              setForm(saved);
              setStatus(null);
            }}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2.5 text-sm font-medium text-gray-600 shadow-sm ring-1 ring-black/5 transition hover:text-gray-900 disabled:opacity-50"
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

      {/* ของที่กำลังวิ่งอยู่จริงตอนนี้ */}
      <div className="mt-5 border-t border-gray-100 pt-4">
        <p className="text-sm font-semibold text-gray-800">
          ตอนนี้วิ่งอยู่จริง <span className="font-normal text-gray-400">({preview.length} รายการ)</span>
        </p>
        {preview.length === 0 ? (
          <p className="mt-2 rounded-lg bg-gray-50 py-4 text-center text-xs text-gray-400">
            ยังไม่มีอะไรวิ่ง — แถบข่าววิ่งจะไม่ขึ้นบนหน้าแรกเลย
          </p>
        ) : (
          <ol className="mt-2 space-y-1.5">
            {preview.map((entry, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="w-5 shrink-0 text-right text-xs text-gray-400">{i + 1}</span>
                {entry.badge && (
                  <span className="mt-0.5 shrink-0 rounded-full bg-accent-red px-2 py-0.5 text-[11px] font-bold uppercase leading-none text-white">
                    {entry.badge}
                  </span>
                )}
                <span className="min-w-0 flex-1 text-gray-700">{entry.text}</span>
                {entry.href && <span className="shrink-0 text-xs text-brand-600">มีไฟล์แนบ</span>}
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
