"use client";

import { useState } from "react";
import { Save, Loader2 } from "lucide-react";
import type { InterestRates, SiteInfo } from "@/lib/settings";

const FIELDS: { key: keyof SiteInfo; label: string; hint?: string }[] = [
  { key: "address", label: "ที่อยู่สหกรณ์" },
  { key: "phone", label: "เบอร์โทรศัพท์" },
  { key: "fax", label: "โทรสาร", hint: "เว้นว่างได้" },
  { key: "email", label: "อีเมล" },
  { key: "officeHours", label: "เวลาทำการ" },
  { key: "memberCount", label: "จำนวนสมาชิก", hint: "ใส่ตัวเลขพร้อมคอมมา เช่น 220,031" },
];

export default function HomeSettings({
  initialSiteInfo,
  initialRates,
}: {
  initialSiteInfo: SiteInfo;
  initialRates: InterestRates;
}) {
  const [siteInfo, setSiteInfo] = useState(initialSiteInfo);
  const [rates, setRates] = useState(initialRates);
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  function setRate(group: "deposit" | "loan", index: number, field: "label" | "rate", value: string) {
    setRates((prev) => ({
      ...prev,
      [group]: prev[group].map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    }));
  }

  async function save() {
    setBusy(true);
    setStatus(null);

    const response = await fetch("/api/admin/home/", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siteInfo, interestRates: rates }),
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

      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <h2 className="font-semibold text-gray-800">อัตราดอกเบี้ย</h2>
        <p className="mt-0.5 text-xs text-gray-500">ตารางบนหน้าแรก — ใส่เฉพาะตัวเลข ไม่ต้องใส่ %</p>

        {(
          [
            ["deposit", "เงินฝาก", "text-emerald-700"],
            ["loan", "เงินกู้", "text-orange-700"],
          ] as const
        ).map(([group, label, color]) => (
          <div key={group} className="mt-4">
            <p className={`text-sm font-medium ${color}`}>{label}</p>
            <div className="mt-2 space-y-2">
              {rates[group].map((item, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    value={item.label}
                    onChange={(e) => setRate(group, index, "label", e.target.value)}
                    className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
                  />
                  <input
                    value={item.rate}
                    onChange={(e) => setRate(group, index, "rate", e.target.value)}
                    inputMode="decimal"
                    className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-right text-sm outline-none focus:border-brand-500"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      {status && (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            status.kind === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
          }`}
        >
          {status.text}
        </p>
      )}

      <button
        onClick={save}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        บันทึกข้อมูลสหกรณ์และดอกเบี้ย
      </button>
    </div>
  );
}
