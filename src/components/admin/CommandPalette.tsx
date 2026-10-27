"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, FileText, LayoutList, Search, X } from "lucide-react";

/**
 * ค้นหาด่วนในหลังบ้าน — กด Ctrl+K (หรือ ⌘K) หรือปุ่ม "ค้นหา" บนเมนูซ้าย แล้วพิมพ์ชื่อเมนูหรือชื่อหน้า
 * (เจ้าของเว็บขอ 27 ต.ค. 2569: หลังบ้านใช้ยาก หาเมนูไม่เจอ)
 *
 * รายการมาจากเมนูที่คนนี้เปิดได้ + หน้าเนื้อหาที่คนนี้ดูแล (กรองสิทธิ์ฝั่งเซิร์ฟเวอร์แล้วใน layout)
 * ไม่ได้ข้ามด่านสิทธิ์ใด ๆ — กดไปแล้วหน้านั้นก็ตรวจสิทธิ์ซ้ำเองอยู่ดี
 */

export type PaletteEntry = { label: string; sub: string; href: string; kind: "menu" | "page" };

/** เทียบแบบไม่สนตัวพิมพ์ใหญ่เล็ก ช่องว่าง และวรรณยุกต์ซ้อน — พิมพ์ไทยตกหล่นนิดหน่อยก็ยังเจอ */
const norm = (s: string) => s.normalize("NFC").toLowerCase().replace(/\s+/g, "");

export default function CommandPalette({
  entries,
  open,
  onClose,
}: {
  entries: PaletteEntry[];
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const key = norm(q);
    const hit = key ? entries.filter((e) => norm(`${e.label} ${e.sub}`).includes(key)) : entries.filter((e) => e.kind === "menu");
    return hit.slice(0, 30);
  }, [q, entries]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  if (!open) return null;

  const go = (entry: PaletteEntry | undefined) => {
    if (!entry) return;
    setQ("");
    setCursor(0);
    onClose();
    router.push(entry.href);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/40 px-4 pt-[12vh] print:hidden" onClick={onClose}>
      <div
        role="dialog"
        aria-label="ค้นหาเมนูหรือหน้า"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/10"
      >
        <div className="flex items-center gap-2 border-b border-gray-100 px-4">
          <Search className="h-4 w-4 shrink-0 text-gray-400" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setCursor(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setCursor((c) => Math.min(c + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setCursor((c) => Math.max(c - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                go(results[cursor]);
              } else if (e.key === "Escape") {
                onClose();
              }
            }}
            placeholder="พิมพ์ชื่อเมนูหรือชื่อหน้า เช่น สไลด์ · ระเบียบ · วันหยุด"
            className="min-w-0 flex-1 bg-transparent py-3.5 text-sm outline-none"
          />
          <button type="button" onClick={onClose} aria-label="ปิด" className="rounded-lg p-1 text-gray-400 hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <ul className="max-h-[55vh] overflow-y-auto p-2">
          {results.length === 0 && <li className="px-3 py-6 text-center text-sm text-gray-400">ไม่พบ “{q}”</li>}
          {results.map((e, i) => (
            <li key={`${e.kind}:${e.href}`}>
              <button
                type="button"
                onMouseEnter={() => setCursor(i)}
                onClick={() => go(e)}
                className={`flex w-full min-w-0 items-center gap-3 rounded-xl px-3 py-2 text-left transition ${
                  i === cursor ? "bg-brand-50 text-brand-900" : "text-gray-700"
                }`}
              >
                {e.kind === "menu" ? (
                  <LayoutList className="h-4 w-4 shrink-0 text-brand-500" />
                ) : (
                  <FileText className="h-4 w-4 shrink-0 text-gray-400" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{e.label}</span>
                  <span className="block truncate text-xs text-gray-500">{e.sub}</span>
                </span>
                {i === cursor && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-brand-400" />}
              </button>
            </li>
          ))}
        </ul>
        <p className="border-t border-gray-100 px-4 py-2 text-[11px] text-gray-400">
          ↑ ↓ เลือก · Enter เปิด · Esc ปิด · กด Ctrl+K ได้จากทุกหน้าในหลังบ้าน
        </p>
      </div>
    </div>
  );
}
