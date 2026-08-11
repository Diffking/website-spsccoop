"use client";

import { useState } from "react";
import { HardDrive, Server, Loader2, PlugZap } from "lucide-react";

/** แถบบอกว่ารูปที่อัปจะไปเก็บที่ไหน + ปุ่มทดสอบการเชื่อมต่อ FTP */
export default function StorageStatus({
  kind,
  label,
}: {
  kind: "ftp" | "local";
  label: string;
}) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function test() {
    setBusy(true);
    setResult(null);
    const response = await fetch("/api/admin/ftp-test/");
    const data = await response.json().catch(() => ({ ok: false, message: "เรียกไม่สำเร็จ" }));
    setResult(data);
    setBusy(false);
  }

  return (
    <div className="mb-4 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
            kind === "ftp" ? "bg-brand-50 text-brand-600" : "bg-gray-100 text-gray-500"
          }`}
        >
          {kind === "ftp" ? <Server className="h-4 w-4" /> : <HardDrive className="h-4 w-4" />}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block text-xs text-gray-500">รูปที่อัปจะไปเก็บที่</span>
          <span className="block truncate text-sm font-medium text-gray-800">{label}</span>
        </span>

        {kind === "ftp" && (
          <button
            onClick={test}
            disabled={busy}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-200 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlugZap className="h-3.5 w-3.5" />}
            ทดสอบการเชื่อมต่อ
          </button>
        )}
      </div>

      {kind === "local" && (
        <p className="mt-2 text-xs leading-relaxed text-gray-500">
          ยังไม่ได้ตั้งค่า FTP — ใส่ค่า <code className="font-mono">FTP_*</code> กับ{" "}
          <code className="font-mono">ASSETS_BASE_URL</code> ใน <code className="font-mono">.env</code>{" "}
          (ดูตัวอย่างใน <code className="font-mono">.env.example</code>) แล้วรีสตาร์ตระบบ
        </p>
      )}

      {result && (
        <p
          className={`mt-2 rounded-lg px-3 py-2 text-xs ${
            result.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
          }`}
        >
          {result.message}
        </p>
      )}
    </div>
  );
}
