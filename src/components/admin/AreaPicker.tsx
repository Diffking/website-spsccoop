"use client";

import { AREAS, pageArea } from "@/lib/permissions";
import { ShieldAlert } from "lucide-react";

/**
 * เลือกว่าเจ้าหน้าที่คนนี้ดูแลส่วนไหนของเว็บบ้าง
 *
 * ไม่ติ๊กเลย = ดูแลได้ทั้งเว็บ (ผู้ใช้เดิมทุกคนเป็นแบบนี้ ไม่ได้ตั้งใจจะไปตัดสิทธิ์ใครย้อนหลัง)
 * ติ๊กแล้วเมนูที่เหลือจะหายไปจากหลังบ้านของเขาเลย ไม่ใช่แค่กดแล้วขึ้นว่าไม่มีสิทธิ์
 */
export default function AreaPicker({
  value,
  onChange,
  pageCategories,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  /** หมวดหน้าเนื้อหาที่มีอยู่จริงในฐาน เช่น ระเบียบสหกรณ์ · ดาวน์โหลดเอกสาร */
  pageCategories: string[];
}) {
  const toggle = (key: string) =>
    onChange(value.includes(key) ? value.filter((v) => v !== key) : [...value, key]);

  const groups = [...new Set(AREAS.map((a) => a.group))];

  const box = (key: string, label: string) => (
    <label
      key={key}
      className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-sm text-gray-700 transition hover:bg-gray-50"
    >
      <input
        type="checkbox"
        checked={value.includes(key)}
        onChange={() => toggle(key)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-brand-600"
      />
      <span className="min-w-0">{label}</span>
    </label>
  );

  return (
    <div className="space-y-3 rounded-xl bg-gray-50 p-3 ring-1 ring-gray-200">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-gray-800">หน้าที่รับผิดชอบ</p>
        {value.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="shrink-0 rounded-lg px-2 py-0.5 text-xs text-gray-500 transition hover:bg-gray-200"
          >
            ล้างทั้งหมด
          </button>
        )}
      </div>

      {value.length === 0 && (
        <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-2.5 py-2 text-xs leading-relaxed text-amber-800">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          ยังไม่ได้เลือก = <b>ดูแลได้ทั้งเว็บ</b> · ติ๊กเฉพาะส่วนที่เขารับผิดชอบ
          เมนูส่วนอื่นจะหายไปจากหลังบ้านของเขา
        </p>
      )}

      {groups.map((group) => (
        <div key={group}>
          <p className="px-2 text-xs font-semibold text-gray-500">{group}</p>
          <div className="grid sm:grid-cols-2">
            {AREAS.filter((a) => a.group === group).map((a) => box(a.key, a.label))}
            {group === "หน้าเนื้อหา" &&
              pageCategories.map((c) => box(pageArea(c), `หน้าเนื้อหา — หมวด ${c}`))}
          </div>
        </div>
      ))}
    </div>
  );
}
