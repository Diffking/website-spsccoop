"use client";

import { useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import Icon, { ICON_NAMES } from "@/components/ui/Icon";

/**
 * เลือกไอคอนด้วยการกด แทนการพิมพ์ชื่อภาษาอังกฤษให้ถูก
 *
 * เดิมต้องรู้ชื่อ lucide มาก่อน เช่น "HeartPulse" พิมพ์ผิดตัวเดียวก็ได้ไอคอนสำรอง
 * ตอนนี้เห็นของจริงทั้งหมดแล้วกดเลือก · ช่องค้นหาไว้ตอนไอคอนเยอะขึ้นในอนาคต
 *
 * ปกติพับไว้เหลือแค่ปุ่มไอคอนปัจจุบัน — ถ้ากางค้างทุกแถว หน้ารายการจะยาวจนเลื่อนหาไม่เจอ
 */
export default function IconPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const shown = keyword
    ? ICON_NAMES.filter((n) => n.toLowerCase().includes(keyword.toLowerCase().trim()))
    : ICON_NAMES;

  return (
    <div className="rounded-xl bg-gray-50 p-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-lg px-1 py-1 text-sm text-gray-700 hover:text-brand-700"
      >
        ไอคอน
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2 py-1 text-xs text-gray-500 ring-1 ring-gray-200">
          <Icon name={value || "FileText"} className="h-4 w-4 text-brand-600" />
          {value || "ยังไม่ได้เลือก"}
        </span>
        <span className="ml-auto flex items-center gap-1 text-xs text-gray-400">
          {open ? "ปิด" : "เปลี่ยน"}
          <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
        </span>
      </button>

      {open && (
        <div className="mt-2 border-t border-gray-200 pt-2">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="ค้นหา เช่น user, file"
              className="w-full rounded-lg border border-gray-200 py-1.5 pl-7 pr-2 text-xs outline-none focus:border-brand-400"
            />
          </label>

          <div className="mt-2 grid max-h-44 grid-cols-8 gap-1.5 overflow-y-auto sm:grid-cols-12">
            {shown.map((name) => (
              <button
                key={name}
                type="button"
                title={name}
                onClick={() => {
                  onChange(name);
                  setOpen(false);
                }}
                className={`relative grid aspect-square place-items-center rounded-lg transition ${
                  value === name
                    ? "bg-brand-600 text-white"
                    : "bg-white text-gray-500 ring-1 ring-gray-200 hover:text-brand-600 hover:ring-brand-300"
                }`}
              >
                <Icon name={name} className="h-4 w-4" />
                {value === name && (
                  <Check className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full bg-emerald-500 p-0.5 text-white" />
                )}
              </button>
            ))}
            {shown.length === 0 && (
              <p className="col-span-full py-4 text-center text-xs text-gray-400">
                ไม่เจอไอคอนที่ค้นหา
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
