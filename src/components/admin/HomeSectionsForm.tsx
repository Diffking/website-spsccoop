"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  GripVertical,
  Loader2,
  RotateCcw,
  Save,
} from "lucide-react";
import Toggle from "@/components/ui/Toggle";
import {
  HOME_SECTIONS,
  HOME_TONES,
  orderedSections,
  resolveTones,
  SECTION_NOTE,
  type HomeOrder,
  type HomeSectionKey,
  type HomeSections,
  type HomeTones,
  type ToneKey,
} from "@/lib/homeSections";

/**
 * เปิด/ปิด · จัดลำดับ · เลือกสีพื้นหลัง ของแต่ละส่วนบนหน้าแรก
 *
 * ปิดแล้วส่วนนั้นหายจากหน้าเว็บทันที แต่ข้อมูลยังอยู่ครบ เปิดกลับมาเมื่อไหร่ก็ได้ของเดิม
 * มีไว้ให้ลองจัดหน้าดูก่อนว่าจะเอาอะไรขึ้นบ้าง เรียงยังไง โดยไม่ต้องลบข้อมูลทิ้ง
 *
 * ต่างจากรายการอื่นในหลังบ้านตรงที่ลากแล้ว "ยังไม่บันทึกทันที" — ต้องกดบันทึกเอง
 * เพราะกล่องนี้แก้ทีเดียวได้สามอย่าง (เปิดปิด/ลำดับ/สี) ให้กดยืนยันครั้งเดียวจบ
 */
export default function HomeSectionsForm({
  initial,
  initialTones,
  initialOrder,
}: {
  initial: HomeSections;
  initialTones: HomeTones;
  initialOrder: HomeOrder;
}) {
  const router = useRouter();
  const [sections, setSections] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [tones, setTones] = useState(initialTones);
  const [savedTones, setSavedTones] = useState(initialTones);
  const [order, setOrder] = useState(initialOrder);
  const [savedOrder, setSavedOrder] = useState(initialOrder);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [dragKey, setDragKey] = useState<HomeSectionKey | null>(null);
  /** ลากได้เฉพาะตอนกดค้างที่จุดจับ ไม่งั้นกดสวิตช์/เลือกสีในแถวไม่ได้ */
  const [handleOn, setHandleOn] = useState<HomeSectionKey | null>(null);

  const dirty =
    JSON.stringify(sections) !== JSON.stringify(saved) ||
    JSON.stringify(tones) !== JSON.stringify(savedTones) ||
    JSON.stringify(order) !== JSON.stringify(savedOrder);
  /** สีที่จะได้จริง — คิดแบบเดียวกับหน้าเว็บ จะได้เห็นผลของ "สลับให้เอง" ก่อนบันทึก */
  const resolved = resolveTones(tones, (key) => sections[key], order);

  /** ย้ายส่วนหนึ่งไปอยู่ตำแหน่งที่ต้องการ — ใช้ทั้งตอนลากและตอนกดปุ่มขึ้น/ลง */
  function moveTo(key: HomeSectionKey, toIndex: number) {
    setStatus(null);
    setOrder((current) => {
      const from = current.indexOf(key);
      if (from === -1 || toIndex < 0 || toIndex >= current.length || from === toIndex) {
        return current;
      }
      const next = [...current];
      next.splice(from, 1);
      next.splice(toIndex, 0, key);
      return next;
    });
  }
  const swatchOf = (className: string) =>
    HOME_TONES.find((t) => t.className === className)?.swatch ?? "#ffffff";
  const shown = HOME_SECTIONS.filter((s) => sections[s.key]).length;

  async function save() {
    setBusy(true);
    setStatus(null);

    const response = await fetch("/api/admin/home/", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ homeSections: sections, homeTones: tones, homeOrder: order }),
    });
    const data = await response.json().catch(() => ({}));
    setBusy(false);

    if (!response.ok) {
      setStatus({ kind: "error", text: data.error ?? "บันทึกไม่สำเร็จ" });
      return;
    }
    setSaved(sections);
    setSavedTones(tones);
    setSavedOrder(order);
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
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-500">
            <GripVertical className="h-3.5 w-3.5 text-gray-400" />
            ลากที่จุดจับเพื่อสลับลำดับ — บนสุดขึ้นก่อนบนหน้าเว็บ · เสร็จแล้วกดบันทึก
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
        {orderedSections(order).map((section, i) => (
          <li
            key={section.key}
            draggable={handleOn === section.key}
            onDragStart={(e) => {
              setDragKey(section.key);
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", section.key);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              if (dragKey && dragKey !== section.key) moveTo(dragKey, i);
            }}
            onDragEnd={() => {
              setDragKey(null);
              setHandleOn(null);
            }}
            className={`flex items-center gap-2 py-2.5 transition ${
              dragKey === section.key ? "opacity-40" : ""
            }`}
          >
            <span
              onMouseDown={() => setHandleOn(section.key)}
              onMouseUp={() => setHandleOn(null)}
              onTouchStart={() => setHandleOn(section.key)}
              onTouchEnd={() => setHandleOn(null)}
              title="ลากเพื่อจัดลำดับ"
              aria-hidden="true"
              className="shrink-0 cursor-grab rounded text-gray-300 transition hover:text-gray-500 active:cursor-grabbing"
            >
              <GripVertical className="h-4 w-4" />
            </span>
            <span className="w-5 shrink-0 text-right text-xs tabular-nums text-gray-400">
              {i + 1}
            </span>
            <span className="flex shrink-0 flex-col">
              <button
                type="button"
                title="เลื่อนขึ้น"
                disabled={i === 0}
                onClick={() => moveTo(section.key, i - 1)}
                className="rounded p-0.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:opacity-25"
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                title="เลื่อนลง"
                disabled={i === order.length - 1}
                onClick={() => moveTo(section.key, i + 1)}
                className="rounded p-0.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:opacity-25"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
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
              {SECTION_NOTE[section.key] && (
                <span className="mt-0.5 block text-[11px] text-gray-400">
                  {SECTION_NOTE[section.key]}
                </span>
              )}
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
              setOrder(savedOrder);
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
