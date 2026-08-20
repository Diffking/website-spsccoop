"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, CloudDownload, Loader2, Plus, RefreshCw } from "lucide-react";

/**
 * ดึงวันหยุดจากระบบสำนักงาน — ปุ่มเดียวจบ แต่ให้เห็นก่อนว่าจะเปลี่ยนอะไร
 *
 * ต้นทางเป็นระบบของคนอื่นในวงแลน (ดู src/lib/holidaySource.ts) เราไม่ได้คุมว่า
 * วันไหนจะโผล่มา จึงกด "ดูรายการ" ก่อน แล้วค่อยกดยืนยัน ไม่เปลี่ยนอะไรเงียบ ๆ
 */

type Item = {
  date: string;
  title: string;
  status: "new" | "same" | "renamed";
  currentTitle?: string;
};

const thaiDate = new Intl.DateTimeFormat("th-TH", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Bangkok",
});

const readable = (date: string) => {
  const d = new Date(`${date}T00:00:00+07:00`);
  return Number.isNaN(d.getTime()) ? date : thaiDate.format(d);
};

export default function HolidayImport({ from }: { from: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "load" | "save">(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [items, setItems] = useState<Item[] | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [updateNames, setUpdateNames] = useState(false);

  async function load() {
    setBusy("load");
    setError("");
    setDone("");
    const response = await fetch("/api/admin/holidays/source/");
    const data = await response.json().catch(() => ({}));
    setBusy(null);

    if (!response.ok) {
      setItems(null);
      setError(data.error ?? "ดึงข้อมูลไม่สำเร็จ");
      return;
    }
    setItems(data.items ?? []);
    setEnabled(data.enabled !== false);
  }

  async function apply() {
    setBusy("save");
    setError("");
    const response = await fetch("/api/admin/holidays/source/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updateNames }),
    });
    const data = await response.json().catch(() => ({}));
    setBusy(null);

    if (!response.ok) {
      setError(data.error ?? "บันทึกไม่สำเร็จ");
      return;
    }
    setItems(null);
    setDone(
      data.added || data.renamed
        ? `เพิ่ม ${data.added} วัน${data.renamed ? ` · แก้ชื่อ ${data.renamed} วัน` : ""}`
        : (data.message ?? "ตรงกับระบบสำนักงานอยู่แล้ว"),
    );
    router.refresh();
  }

  const added = items?.filter((i) => i.status === "new") ?? [];
  const renamed = items?.filter((i) => i.status === "renamed") ?? [];
  const same = items?.filter((i) => i.status === "same") ?? [];

  return (
    <section className="mb-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <div className="flex flex-wrap items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
          <CloudDownload className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-gray-800">ดึงวันหยุดจากระบบสำนักงาน</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            เอาวันหยุดที่ตั้งไว้ในระบบสำนักงาน ({from}) มาลงเว็บ — ไม่ต้องพิมพ์ซ้ำสองที่
            · ดึงมาแล้วยังแก้ชื่อ ใส่หมายเหตุ หรือซ่อนบางวันได้ตามปกติ
          </p>
        </div>
        <button
          onClick={load}
          disabled={busy !== null}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {busy === "load" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {items ? "ดูใหม่อีกครั้ง" : "ดูรายการ"}
        </button>
      </div>

      {error && (
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      {done && (
        <p className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          <Check className="h-4 w-4 shrink-0" /> {done}
        </p>
      )}

      {items && !enabled && (
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          ระบบต้นทางปิดการใช้งานวันหยุดอยู่ — รายการที่เห็นอาจเป็นของค้าง ดึงเข้าไม่ได้จนกว่าจะเปิดที่ต้นทาง
        </p>
      )}

      {items && (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-gray-600">
            ระบบสำนักงานมี {items.length} วัน —{" "}
            <strong className="font-semibold text-emerald-700">เพิ่มใหม่ {added.length} วัน</strong>
            {renamed.length > 0 && <> · ชื่อไม่ตรงกัน {renamed.length} วัน</>}
            {same.length > 0 && <> · ตรงกันอยู่แล้ว {same.length} วัน</>}
          </p>

          {added.length > 0 && (
            <ul className="max-h-64 space-y-1 overflow-y-auto rounded-xl bg-emerald-50/60 p-2">
              {added.map((item) => (
                <li key={item.date} className="flex items-center gap-2 px-1 text-sm text-gray-700">
                  <Plus className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                  <span className="w-40 shrink-0 text-xs text-gray-500">{readable(item.date)}</span>
                  <span className="min-w-0 truncate">{item.title}</span>
                </li>
              ))}
            </ul>
          )}

          {renamed.length > 0 && (
            <div className="rounded-xl bg-amber-50/70 p-2">
              <ul className="max-h-40 space-y-1 overflow-y-auto">
                {renamed.map((item) => (
                  <li key={item.date} className="flex items-center gap-2 px-1 text-sm text-gray-700">
                    <span className="w-40 shrink-0 text-xs text-gray-500">
                      {readable(item.date)}
                    </span>
                    <span className="min-w-0 truncate">
                      <span className="text-gray-400 line-through">{item.currentTitle}</span>{" "}
                      → {item.title}
                    </span>
                  </li>
                ))}
              </ul>
              <label className="mt-1.5 flex cursor-pointer items-center gap-2 px-1 text-xs text-amber-900">
                <input
                  type="checkbox"
                  checked={updateNames}
                  onChange={(e) => setUpdateNames(e.target.checked)}
                  className="h-3.5 w-3.5 accent-amber-600"
                />
                ใช้ชื่อจากระบบสำนักงานทับชื่อที่แก้ไว้ในเว็บด้วย
              </label>
            </div>
          )}

          {added.length === 0 && renamed.length === 0 ? (
            <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-500">
              ตรงกับระบบสำนักงานอยู่แล้ว ไม่มีอะไรต้องดึง
            </p>
          ) : (
            <button
              onClick={apply}
              disabled={busy !== null || !enabled}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
            >
              {busy === "save" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              ดึงเข้าเว็บ
              {added.length > 0 && ` — เพิ่ม ${added.length} วัน`}
              {updateNames && renamed.length > 0 && ` · แก้ชื่อ ${renamed.length} วัน`}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
