"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, RotateCcw, Save } from "lucide-react";
import Toggle from "@/components/ui/Toggle";
import {
  HOME_SECTIONS,
  HOME_TONES,
  resolveTones,
  type HomeSections,
  type HomeTones,
  type ToneKey,
} from "@/lib/homeSections";

/**
 * เปิด/ปิดแต่ละส่วนของหน้าแรก
 *
 * ปิดแล้วส่วนนั้นหายจากหน้าเว็บทันที แต่ข้อมูลยังอยู่ครบ เปิดกลับมาเมื่อไหร่ก็ได้ของเดิม
 * มีไว้ให้ลองจัดหน้าดูก่อนว่าจะเอาอะไรขึ้นบ้าง โดยไม่ต้องลบข้อมูลทิ้ง
 */
export default function HomeSectionsForm({
  initial,
  initialTones,
}: {
  initial: HomeSections;
  initialTones: HomeTones;
}) {
  const router = useRouter();
  const [sections, setSections] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [tones, setTones] = useState(initialTones);
  const [savedTones, setSavedTones] = useState(initialTones);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const dirty =
    JSON.stringify(sections) !== JSON.stringify(saved) ||
    JSON.stringify(tones) !== JSON.stringify(savedTones);
  /** สีที่จะได้จริง — คิดแบบเดียวกับหน้าเว็บ จะได้เห็นผลของ "สลับให้เอง" ก่อนบันทึก */
  const resolved = resolveTones(tones, (key) => sections[key]);
  const swatchOf = (className: string) =>
    HOME_TONES.find((t) => t.className === className)?.swatch ?? "#ffffff";
  const shown = HOME_SECTIONS.filter((s) => sections[s.key]).length;

  async function save() {
    setBusy(true);
    setStatus(null);

    const response = await fetch("/api/admin/home/", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ homeSections: sections, homeTones: tones }),
    });
    const data = await response.json().catch(() => ({}));
    setBusy(false);

    if (!response.ok) {
      setStatus({ kind: "error", text: data.error ?? "บันทึกไม่สำเร็จ" });
      return;
    }
    setSaved(sections);
    setSavedTones(tones);
    setStatus({ kind: "ok", text: "บันทึกแล้ว — กดโหลดใหม่ในพรีวิวเพื่อดูผล" });
    router.refresh();
  }

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-gray-800">ส่วนที่แสดงบนหน้าแรก</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            ปิดแล้วส่วนนั้นหายจากหน้าเว็บทันที แต่ข้อมูลยังอยู่ครบ เปิดกลับมาเมื่อไหร่ก็ได้ของเดิม
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
          เปิดอยู่ {shown} / {HOME_SECTIONS.length} ส่วน
        </span>
      </div>

      <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
        <span>สีพื้นหลัง:</span>
        {HOME_TONES.map((tone) => (
          <span key={tone.key} className="inline-flex items-center gap-1">
            <span
              style={{ background: tone.swatch }}
              className="h-3.5 w-3.5 rounded-full ring-1 ring-gray-300"
            />
            {tone.label}
          </span>
        ))}
        <span className="text-gray-400">· ช่องสี่เหลี่ยมท้ายแถว = สีที่จะขึ้นจริง</span>
      </p>

      <ul className="mt-3 divide-y divide-gray-100">
        {HOME_SECTIONS.map((section, i) => (
          <li key={section.key} className="flex items-center gap-3 py-2.5">
            <span className="w-5 shrink-0 text-right text-xs tabular-nums text-gray-400">
              {i + 1}
            </span>
            <span className="min-w-0 flex-1">
              <Toggle
                checked={sections[section.key]}
                onChange={(next) => {
                  setStatus(null);
                  setSections((prev) => ({ ...prev, [section.key]: next }));
                }}
                label={section.label}
              />
            </span>
            {sections[section.key] && section.key !== "hero" && (
              <span className="flex shrink-0 items-center gap-1">
                {HOME_TONES.map((tone) => (
                  <button
                    key={tone.key}
                    type="button"
                    title={tone.label}
                    onClick={() => {
                      setStatus(null);
                      setTones((prev) => ({ ...prev, [section.key]: tone.key as ToneKey }));
                    }}
                    style={{ background: tone.swatch }}
                    className={`h-5 w-5 rounded-full ring-1 transition ${
                      tones[section.key] === tone.key
                        ? "ring-2 ring-brand-600 ring-offset-1"
                        : "ring-gray-300 hover:ring-gray-400"
                    }`}
                  />
                ))}
                {/* สีที่ได้จริงหลังคิด "สลับให้เอง" แล้ว */}
                <span
                  style={{ background: swatchOf(resolved[section.key]) }}
                  title="สีที่จะขึ้นจริง"
                  className="ml-1 h-5 w-8 rounded-md ring-1 ring-gray-300"
                />
              </span>
            )}

            <span
              className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                sections[section.key]
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-gray-100 text-gray-400"
              }`}
            >
              {sections[section.key] ? (
                <>
                  <Eye className="h-3 w-3" /> แสดง
                </>
              ) : (
                <>
                  <EyeOff className="h-3 w-3" /> ซ่อน
                </>
              )}
            </span>
          </li>
        ))}
      </ul>

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
              setSections(saved);
              setTones(savedTones);
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
