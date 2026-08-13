"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw, Save, Megaphone } from "lucide-react";
import type { TickerSettings } from "@/lib/settings";
import type { TickerEntry } from "@/lib/content";
import {
  KINDS,
  KIND_LABEL,
  KIND_BADGE_CLASS,
  KIND_BADGE_SWATCH,
  type Kind,
} from "@/lib/announcementKinds";

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

  const setCount = (kind: Kind, value: number) => {
    setStatus(null);
    setForm((f) => ({ ...f, badgeCounts: { ...f.badgeCounts, [kind]: value } }));
  };

  /**
   * ป้ายของแต่ละรายการในตัวอย่าง — คิดแบบเดียวกับฝั่งเซิร์ฟเวอร์ (นับโควตาแยกหมวด)
   * จะได้เห็นผลของเลขที่กำลังแก้ค้างอยู่ก่อนกดบันทึก
   */
  const previewBadges = (() => {
    const given: Record<Kind, number> = { ANNOUNCEMENT: 0, NEWSLETTER: 0, REPORT: 0 };
    const label = form.badgeText.trim();
    return preview.map((entry) => {
      if (!label || !entry.kind) return null;
      if (given[entry.kind] >= (form.badgeCounts[entry.kind] ?? 0)) return null;
      given[entry.kind] += 1;
      return { label, kind: entry.kind };
    });
  })();

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
          <Megaphone className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-semibold text-gray-800">ดึงประกาศมาวิ่งอัตโนมัติ</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            ไม่ต้องมาพิมพ์ซ้ำ — ระบบหยิบเรื่องล่าสุดจากเมนู “ประกาศ / จดหมายข่าว” มาวิ่งให้เอง
            หมวดละไม่เกินจำนวนที่ตั้งไว้ วิ่งเรียงทีละหมวด (ประกาศ → จดหมายข่าว → รายงานกิจการ)
            ออกเรื่องใหม่เมื่อไหร่ข่าววิ่งเปลี่ยนตามทันที
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
          <span className="mb-1 block text-sm text-gray-600">ดึงมากี่เรื่องต่อหมวด</span>
          <input
            type="number"
            min={1}
            max={20}
            value={form.perKind}
            onChange={(e) => set("perKind", Number(e.target.value))}
            disabled={!form.auto}
            className={`${field} disabled:bg-gray-50 disabled:text-gray-400`}
          />
          <span className="mt-1 block text-xs text-gray-400">
            นับแยกทั้งสามหมวด · ปกติใช้ 5 (รวมได้มากสุด {form.perKind * 3} เรื่อง)
          </span>
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

      {/* โควตาป้ายแยกตามหมวด */}
      <div className="mt-4 rounded-xl bg-gray-50 p-3">
        <p className="text-sm text-gray-700">ติดป้ายให้กี่รายการแรกของแต่ละหมวด</p>
        <p className="mt-0.5 text-xs text-gray-500">
          สีป้ายบอกหมวดให้เอง เปลี่ยนสีไม่ได้ · 0 = หมวดนั้นไม่ติดป้าย · ใส่มากกว่าจำนวนที่ดึงมา
          ({form.perKind} เรื่องต่อหมวด) ส่วนที่เกินไม่มีผล
        </p>

        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {KINDS.map((kind) => (
            <label key={kind} className="block rounded-lg bg-white p-2.5 ring-1 ring-gray-200">
              <span className="mb-1.5 flex items-center gap-1.5 text-sm text-gray-700">
                <span
                  style={{ background: KIND_BADGE_SWATCH[kind] }}
                  className="h-3 w-3 shrink-0 rounded-full ring-1 ring-black/10"
                />
                {KIND_LABEL[kind]}
              </span>
              <input
                type="number"
                min={0}
                max={30}
                value={form.badgeCounts[kind]}
                onChange={(e) => setCount(kind, Number(e.target.value))}
                className={field}
              />
            </label>
          ))}
        </div>
      </div>

      {/* ความเร็ว */}
      <div className="mt-4 rounded-xl bg-gray-50 p-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-sm text-gray-700">ความเร็วที่วิ่ง</span>
          <span className="text-xs text-gray-500">
            {form.secondsPerItem} วินาทีต่อ 1 รายการ
            {preview.length > 0 && (
              <> · วิ่งครบรอบใน {form.secondsPerItem * preview.length} วินาที</>
            )}
          </span>
        </div>

        <input
          type="range"
          min={3}
          max={30}
          step={1}
          value={form.secondsPerItem}
          onChange={(e) => set("secondsPerItem", Number(e.target.value))}
          aria-label="ความเร็วข่าววิ่ง"
          className="mt-2 w-full accent-brand-600"
        />
        <div className="flex justify-between text-[11px] text-gray-400">
          <span>เร็ว</span>
          <span>ช้า</span>
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {(
            [
              [5, "เร็ว"],
              [9, "ปกติ"],
              [14, "ช้า"],
              [20, "ช้ามาก"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => set("secondsPerItem", value)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                form.secondsPerItem === value
                  ? "bg-brand-600 text-white"
                  : "bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <p className="mt-2 text-xs text-gray-400">
          คิดต่อรายการ ไม่ใช่ต่อรอบ — วันไหนมีประกาศเยอะข้อความจะได้ไม่วิ่งเร็วขึ้นเองจนอ่านไม่ทัน
        </p>
      </div>

      {/* ตัวอย่างของจริง — ใช้คลาสและความเร็วเดียวกับหน้าเว็บ */}
      {preview.length > 0 && (
        <div className="mt-4 rounded-xl border-y border-brand-100 bg-white p-3 ring-1 ring-black/5">
          <p className="mb-2 text-[11px] text-gray-400">ตัวอย่างที่วิ่งจริง (เอาเมาส์ชี้เพื่อหยุด)</p>
          <div className="ticker-pause relative overflow-hidden">
            <div
              key={`${form.secondsPerItem}-${form.badgeText}-${JSON.stringify(form.badgeCounts)}-${form.badgeBlink}`}
              style={{ animationDuration: `${preview.length * form.secondsPerItem}s` }}
              className="animate-ticker flex w-max gap-10 whitespace-nowrap text-sm text-gray-600"
            >
              {[0, 1].map((copy) =>
                preview.map((entry, i) => (
                  <span key={`${copy}-${i}`} className="flex items-center gap-2">
                    {previewBadges[i] ? (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase leading-none ${
                          KIND_BADGE_CLASS[previewBadges[i]!.kind]
                        } ${form.badgeBlink ? "animate-blink" : ""}`}
                      >
                        {previewBadges[i]!.label}
                      </span>
                    ) : (
                      <span className="text-accent-red">•</span>
                    )}
                    {entry.text}
                  </span>
                )),
              )}
            </div>
          </div>
        </div>
      )}

      {/* ตัวอย่างป้ายทั้งสามหมวด — ใช้คลาสเดียวกับของจริงบนหน้าเว็บ */}
      <div className="mt-4 space-y-2 rounded-xl bg-gray-900 px-4 py-3">
        <p className="text-[11px] text-gray-400">ตัวอย่างป้ายแต่ละหมวด</p>
        {KINDS.map((kind) => (
          <span key={kind} className="flex items-center gap-2 text-sm text-white">
            {form.badgeText.trim() && form.badgeCounts[kind] > 0 ? (
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase leading-none ${
                  KIND_BADGE_CLASS[kind]
                } ${form.badgeBlink ? "animate-blink" : ""}`}
              >
                {form.badgeText}
              </span>
            ) : (
              <span className="text-accent-red">•</span>
            )}
            {KIND_LABEL[kind]}
            <span className="text-xs text-gray-500">
              {form.badgeText.trim() && form.badgeCounts[kind] > 0
                ? `(${form.badgeCounts[kind]} รายการแรก)`
                : "(ไม่ติดป้าย)"}
            </span>
          </span>
        ))}
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
                  <span
                    className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase leading-none ${
                      entry.kind ? KIND_BADGE_CLASS[entry.kind] : "bg-accent-red text-white"
                    }`}
                  >
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
