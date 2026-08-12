"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Check, Loader2, Sparkles } from "lucide-react";
import type { UploadPhase } from "@/lib/uploadClient";

/**
 * แถบความคืบหน้าตอนอัปไฟล์ — ใช้ร่วมกันทุกที่ที่มีปุ่มอัปไฟล์
 *
 * มีเปอร์เซ็นต์เฉพาะช่วงส่งไฟล์ เพราะเป็นช่วงเดียวที่รู้จริงว่าไปถึงไหนแล้ว
 * ช่วงที่เหลือ (บีบไฟล์ / ให้ AI อ่าน) ไม่มีทางรู้ว่าเหลืออีกเท่าไหร่ —
 * ถ้าปั้นเปอร์เซ็นต์ปลอมขึ้นมาแล้วมันค้างที่ 90% ผู้ใช้จะยิ่งไม่เชื่อระบบ
 * จึงบอกเป็น "ขั้นที่ทำอยู่ + เวลาที่ผ่านไป" แทน ซึ่งจริงและดูออกว่ายังไม่ค้าง
 */

const STEPS: { key: UploadPhase; label: string }[] = [
  { key: "upload", label: "ส่งไฟล์" },
  { key: "process", label: "จัดการไฟล์" },
  { key: "ai", label: "AI อ่านเอกสาร" },
];

/**
 * ตัวนับวินาที — ผูก key ไว้กับช่วงงาน พอเปลี่ยนช่วงจะถูกสร้างใหม่แล้วเริ่มนับจากศูนย์เอง
 * (ง่ายและถูกต้องกว่าการรีเซ็ตตัวนับใน effect)
 */
function Elapsed() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);
  return <>{seconds} วิ</>;
}

export default function UploadProgress({
  phase,
  percent,
  fileName,
  message,
  showAi = false,
}: {
  phase: UploadPhase | null;
  percent: number;
  fileName?: string;
  /** หน้านั้นมีขั้น "AI อ่านเอกสาร" ต่อจากอัปโหลดไหม */
  showAi?: boolean;
  /** ข้อความสรุปตอนเสร็จ เช่น "บีบไฟล์ที่ 150 dpi จาก 30.0 MB เหลือ 1.2 MB" */
  message?: string;
}) {
  if (!phase) return null;

  const done = phase === "done";
  const failed = phase === "error";
  const label =
    phase === "upload"
      ? `กำลังส่งไฟล์ ${percent}%`
      : phase === "process"
        ? "ส่งครบแล้ว — กำลังบีบและจัดเก็บไฟล์…"
        : phase === "ai"
          ? "AI กำลังอ่าน 3 หน้าแรกของเอกสาร…"
          : done
            ? "เรียบร้อย"
            : "ไม่สำเร็จ";

  return (
    <div
      role="status"
      aria-live="polite"
      className={`mt-3 rounded-xl px-3 py-2.5 ring-1 ${
        failed
          ? "bg-red-50 ring-red-200"
          : done
            ? "bg-emerald-50 ring-emerald-200"
            : "bg-brand-50 ring-brand-100"
      }`}
    >
      <div className="flex items-center gap-2">
        {failed ? (
          <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
        ) : done ? (
          <Check className="h-4 w-4 shrink-0 text-emerald-600" />
        ) : phase === "ai" ? (
          <Sparkles className="h-4 w-4 shrink-0 animate-pulse text-brand-600" />
        ) : (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-brand-600" />
        )}

        <span
          className={`min-w-0 flex-1 truncate text-sm font-medium ${
            failed ? "text-red-700" : done ? "text-emerald-700" : "text-brand-700"
          }`}
        >
          {label}
        </span>

        {phase === "upload" && (
          <span className="shrink-0 text-sm font-semibold tabular-nums text-brand-700">
            {percent}%
          </span>
        )}
        {(phase === "process" || phase === "ai") && (
          <span className="shrink-0 text-sm tabular-nums text-brand-600">
            <Elapsed key={phase} />
          </span>
        )}
      </div>

      {/* หลอดความคืบหน้า — ช่วงรอเซิร์ฟเวอร์ทำงานจะเป็นแถบวิ่งเพราะไม่รู้ว่าเหลืออีกเท่าไหร่ */}
      {!failed && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/70">
          <div
            className={`h-full rounded-full transition-all duration-200 ${
              done
                ? "bg-emerald-500"
                : phase === "upload"
                  ? "bg-brand-500"
                  : "animate-pulse bg-brand-400"
            }`}
            style={{ width: `${done || phase === "process" || phase === "ai" ? 100 : Math.max(percent, 4)}%` }}
          />
        </div>
      )}

      {/* ไล่ขั้นให้เห็นว่าอยู่ตรงไหนของกระบวนการ และเหลืออีกกี่ขั้น */}
      {!failed && (
        <ol className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
          {STEPS.filter((step) => step.key !== "ai" || showAi).map((step, i, all) => {
            const order = all.findIndex((x) => x.key === phase);
            const state = done || (order !== -1 && i < order) ? "ผ่านแล้ว" : step.key === phase ? "กำลังทำ" : "รอ";
            return (
              <li key={step.key} className="flex items-center gap-1.5">
                <span
                  className={`grid h-4 w-4 place-items-center rounded-full text-[9px] font-bold ${
                    state === "ผ่านแล้ว"
                      ? "bg-emerald-500 text-white"
                      : state === "กำลังทำ"
                        ? "bg-brand-600 text-white"
                        : "bg-white text-gray-400 ring-1 ring-gray-300"
                  }`}
                >
                  {state === "ผ่านแล้ว" ? "✓" : i + 1}
                </span>
                <span className={state === "รอ" ? "text-gray-400" : "text-gray-600"}>{step.label}</span>
                {i < all.length - 1 && <span className="text-gray-300">›</span>}
              </li>
            );
          })}
        </ol>
      )}

      {(fileName || message) && (
        <p
          className={`mt-1.5 truncate text-xs ${
            failed ? "text-red-600" : done ? "text-emerald-700" : "text-gray-500"
          }`}
        >
          {[fileName, message].filter(Boolean).join(" · ")}
        </p>
      )}
    </div>
  );
}
