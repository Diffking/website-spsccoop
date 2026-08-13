"use client";

import { useState } from "react";
import { Save, Loader2 } from "lucide-react";
import type { SiteInfo } from "@/lib/settings";

const FIELDS: { key: keyof SiteInfo; label: string; hint?: string }[] = [
  { key: "address", label: "ที่อยู่สหกรณ์" },
  { key: "phone", label: "เบอร์โทรศัพท์" },
  { key: "fax", label: "โทรสาร", hint: "เว้นว่างได้" },
  { key: "email", label: "อีเมล" },
  { key: "memberCount", label: "จำนวนสมาชิก", hint: "ใส่ตัวเลขพร้อมคอมมา เช่น 220,031" },
  { key: "facebook", label: "ลิงก์เฟซบุ๊ก", hint: "เว้นว่าง = ซ่อนปุ่มเฟซบุ๊กที่ท้ายเว็บ" },
];

export default function SiteInfoForm({ initial }: { initial: SiteInfo }) {
  const [siteInfo, setSiteInfo] = useState(initial);
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setStatus(null);

    const response = await fetch("/api/admin/home/", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siteInfo }),
    });
    const data = await response.json().catch(() => ({}));

    setStatus(
      response.ok
        ? { kind: "ok", text: "บันทึกแล้ว" }
        : { kind: "error", text: data.error ?? "บันทึกไม่สำเร็จ" },
    );
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <h2 className="font-semibold text-gray-800">ข้อมูลสหกรณ์</h2>
        <p className="mt-0.5 text-xs text-gray-500">แสดงที่ส่วนติดต่อเราและท้ายเว็บ</p>

        <div className="mt-3 space-y-3">
          {FIELDS.map((field) => (
            <label key={field.key} className="block text-sm text-gray-600">
              {field.label}
              {field.hint && <span className="ml-1 text-xs text-gray-400">({field.hint})</span>}
              <input
                value={siteInfo[field.key]}
                onChange={(e) => setSiteInfo({ ...siteInfo, [field.key]: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-base outline-none focus:border-brand-500"
              />
            </label>
          ))}
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-brand-700 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          บันทึกข้อมูลสหกรณ์
        </button>
        {status && (
          <span className={`text-sm ${status.kind === "ok" ? "text-emerald-600" : "text-red-500"}`}>
            {status.text}
          </span>
        )}
      </div>
    </div>
  );
}
