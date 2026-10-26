"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Trash2, Users } from "lucide-react";

/**
 * สถานะทะเบียนสมาชิกที่ sync-agent ส่งมา (วันละ 2 รอบ 08:50 / 16:50) + ปุ่มลบทิ้งตอนจบการประเมิน
 * ลบแล้วคำตอบที่ตรวจผ่านไม่กระทบ (ข้อมูลอยู่ในแถวคำตอบเอง) แต่สมาชิกจะยืนยันตัวตนสดไม่ได้จนกว่ารอบส่งถัดไป
 */
export default function MemberSyncPanel({
  count,
  receivedAt,
  generatedAt,
  stale,
  configured,
  endpoint,
  canClear,
}: {
  /** ปุ่มลบทะเบียน — ADMIN เท่านั้น (API กันซ้ำอีกชั้น) */
  canClear: boolean;
  count: number;
  receivedAt: string | null;
  generatedAt: string | null;
  stale: boolean;
  configured: boolean;
  endpoint: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function clear() {
    if (!confirm(`ลบทะเบียนสมาชิก ${count.toLocaleString("th-TH")} คนออกจากเว็บ?\n\nทำเมื่อจบการประเมินแล้ว · คำตอบที่ตรวจผ่านไม่หาย\nอย่าลืมแจ้งผู้ดูแล sync-agent ให้ปิด EVAL_API_KEY ด้วย`)) return;
    setBusy(true);
    setError(null);
    const r = await fetch("/api/admin/members/", { method: "DELETE" }).catch(() => null);
    setBusy(false);
    if (!r?.ok) {
      setError(((await r?.json().catch(() => null)) as { error?: string } | null)?.error ?? "ลบไม่สำเร็จ");
      return;
    }
    router.refresh();
  }

  const warn = !configured || count === 0 || stale;
  return (
    <section className={`rounded-2xl p-4 shadow-sm ring-1 ${warn ? "bg-amber-50 ring-amber-200" : "bg-white ring-black/5"}`}>
      <div className="flex flex-wrap items-start gap-3">
        <Users className={`mt-0.5 h-5 w-5 shrink-0 ${warn ? "text-amber-600" : "text-brand-600"}`} />
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-semibold text-gray-800">ทะเบียนสมาชิก (จาก sync-agent)</p>
          {!configured ? (
            <p className="mt-0.5 text-amber-800">
              ยังไม่ได้ตั้ง EVAL_API_KEY / EVAL_PHONE_PEPPER ใน .env — สมาชิกยืนยันตัวตนสดไม่ได้ (ตอบได้ผ่านโหมดฝากคำตอบ)
            </p>
          ) : count === 0 ? (
            <p className="mt-0.5 text-amber-800">ยังไม่มีทะเบียน — รอ sync-agent ส่งรอบ 08:50 / 16:50 · ระหว่างนี้สมาชิกตอบผ่านโหมดฝากคำตอบ</p>
          ) : (
            <p className="mt-0.5 text-gray-600">
              {count.toLocaleString("th-TH")} คน · รับล่าสุด {receivedAt ?? "—"}
              {generatedAt && <span className="text-gray-400"> · ข้อมูล ณ {generatedAt}</span>}
            </p>
          )}
          {configured && count > 0 && stale && (
            <p className="mt-1 flex items-center gap-1 text-xs font-medium text-amber-800">
              <AlertTriangle className="h-3.5 w-3.5" /> ไม่ได้รับทะเบียนใหม่เกิน 3 วัน — ตรวจว่า sync-agent ยังส่งอยู่ไหม
            </p>
          )}
          <p className="mt-1 break-all text-[11px] text-gray-400">ที่อยู่รับข้อมูล: {endpoint}</p>
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </div>
        {canClear && count > 0 && (
          <button
            type="button"
            onClick={clear}
            disabled={busy}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-red-700 ring-1 ring-red-200 transition hover:bg-red-50 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            ลบทะเบียน (จบการประเมิน)
          </button>
        )}
      </div>
    </section>
  );
}
