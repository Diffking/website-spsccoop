"use client";

import { useRef, useState } from "react";
import { Save, Loader2, Sparkles, Wand2 } from "lucide-react";
import type { InterestRates, UpdateMode } from "@/lib/settings";
import ModeSwitch from "./ModeSwitch";

export default function RatesForm({
  initial,
  mode,
  aiReady,
}: {
  initial: InterestRates;
  mode: UpdateMode;
  aiReady: boolean;
}) {
  const [rates, setRates] = useState(initial);
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const rateFile = useRef<HTMLInputElement>(null);

  /** ให้ AI อ่านภาพประกาศอัตราดอกเบี้ยแล้วเติมตารางให้ — ยังไม่บันทึก คนกดบันทึกเอง */
  async function readFromImage(file: File) {
    setStatus(null);
    setReading(true);

    const form = new FormData();
    form.append("file", file);
    form.append("target", "rates");
    const response = await fetch("/api/admin/ai/read-image/", { method: "POST", body: form });
    const data = await response.json().catch(() => ({}));
    setReading(false);

    if (!response.ok) {
      setStatus({ kind: "error", text: data.error ?? "AI อ่านภาพไม่สำเร็จ" });
      return;
    }
    const draft = data.data as InterestRates | undefined;
    if (!draft?.deposit?.length && !draft?.loan?.length) {
      setStatus({ kind: "error", text: "AI ไม่พบตารางอัตราดอกเบี้ยในภาพนี้" });
      return;
    }
    setRates({ deposit: draft.deposit ?? [], loan: draft.loan ?? [] });
    setStatus({ kind: "ok", text: "AI อ่านให้แล้ว — ตรวจตัวเลขทุกช่องก่อนกดบันทึก" });
  }

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
      body: JSON.stringify({ interestRates: rates }),
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
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-gray-800">อัตราดอกเบี้ย</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              ตารางบนหน้าแรก — ใส่เฉพาะตัวเลข ไม่ต้องใส่ %
            </p>
          </div>
          <ModeSwitch component="rates" value={mode} aiReady={aiReady} />
        </div>

        {mode === "ai" && (
          <div className="mt-3 rounded-xl border border-dashed border-gray-300 p-3">
            <input
              ref={rateFile}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) readFromImage(file);
                e.target.value = "";
              }}
            />
            <button
              onClick={() => rateFile.current?.click()}
              disabled={reading}
              className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3.5 py-2 text-sm font-medium text-brand-700 transition hover:bg-brand-100 disabled:opacity-60"
            >
              {reading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {reading ? "AI กำลังอ่านภาพ..." : "อัปภาพประกาศดอกเบี้ย ให้ AI อ่าน"}
            </button>
            <p className="mt-2 flex items-start gap-1.5 text-xs text-gray-500">
              <Wand2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              AI จะเติมตารางให้ แต่ยังไม่บันทึก — ตรวจตัวเลขทุกช่องแล้วกดบันทึกเอง
            </p>
          </div>
        )}

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

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-brand-700 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          บันทึกอัตราดอกเบี้ย
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
