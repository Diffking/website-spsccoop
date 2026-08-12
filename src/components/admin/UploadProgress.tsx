"use client";

import { AlertCircle, Check, Loader2 } from "lucide-react";
import type { UploadPhase } from "@/lib/uploadClient";

/**
 * แถบความคืบหน้าตอนอัปไฟล์ — ใช้ร่วมกันทุกที่ที่มีปุ่มอัปไฟล์
 *
 * แยกให้เห็นสองช่วงชัด ๆ เพราะช่วงหลังไม่มีเปอร์เซ็นต์ให้นับ:
 * ส่งไฟล์ (0-100) → ระบบจัดการต่อ (บีบ/ย่อ/ส่งขึ้น FTP) → สำเร็จ
 */

export default function UploadProgress({
  phase,
  percent,
  fileName,
  message,
}: {
  phase: UploadPhase | null;
  percent: number;
  fileName?: string;
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
        ? "ส่งครบแล้ว — ระบบกำลังจัดการไฟล์…"
        : done
          ? "อัปโหลดสำเร็จ"
          : "อัปโหลดไม่สำเร็จ";

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
      </div>

      {/* หลอดความคืบหน้า — ช่วงรอเซิร์ฟเวอร์ทำงานจะเป็นแถบวิ่งเพราะไม่รู้ว่าเหลืออีกเท่าไหร่ */}
      {!failed && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/70">
          <div
            className={`h-full rounded-full transition-all duration-200 ${
              done ? "bg-emerald-500" : phase === "process" ? "animate-pulse bg-brand-400" : "bg-brand-500"
            }`}
            style={{ width: `${done ? 100 : Math.max(percent, 4)}%` }}
          />
        </div>
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
