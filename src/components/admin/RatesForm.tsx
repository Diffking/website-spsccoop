"use client";

import { useRef, useState } from "react";
import {
  Save,
  Loader2,
  Sparkles,
  Wand2,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  RotateCcw,
} from "lucide-react";
import type { InterestRates } from "@/lib/settings";

type Group = "deposit" | "loan";

export default function RatesForm({
  initial,
  aiReady,
}: {
  initial: InterestRates;
  aiReady: boolean;
}) {
  const [rates, setRates] = useState(initial);
  /** ชุดที่บันทึกไว้ล่าสุด — ใช้เทียบว่ามีอะไรค้างยังไม่บันทึก และใช้ตอนกดยกเลิก */
  const [saved, setSaved] = useState(initial);
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const rateFile = useRef<HTMLInputElement>(null);

  const dirty = JSON.stringify(rates) !== JSON.stringify(saved);

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

  function setRate(group: Group, index: number, field: "label" | "rate", value: string) {
    setRates((prev) => ({
      ...prev,
      [group]: prev[group].map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    }));
  }

  function addRate(group: Group) {
    setStatus(null);
    setRates((prev) => ({ ...prev, [group]: [...prev[group], { label: "", rate: "" }] }));
  }

  function removeRate(group: Group, index: number) {
    setStatus(null);
    setRates((prev) => ({ ...prev, [group]: prev[group].filter((_, i) => i !== index) }));
  }

  function moveRate(group: Group, index: number, step: number) {
    setRates((prev) => {
      const target = index + step;
      if (target < 0 || target >= prev[group].length) return prev;
      const next = [...prev[group]];
      [next[index], next[target]] = [next[target], next[index]];
      return { ...prev, [group]: next };
    });
  }

  async function save() {
    // ตรวจก่อนยิง จะได้บอกได้ว่าแถวไหนผิด แทนที่จะได้ข้อความรวม ๆ กลับมาจากเซิร์ฟเวอร์
    for (const [group, label] of [
      ["deposit", "เงินฝาก"],
      ["loan", "เงินกู้"],
    ] as const) {
      const bad = rates[group].findIndex(
        (item) => !item.label.trim() || !/^\d+(\.\d+)?$/.test(item.rate.trim()),
      );
      if (bad !== -1) {
        setStatus({
          kind: "error",
          text: `${label} รายการที่ ${bad + 1}: ต้องมีชื่อ และอัตราต้องเป็นตัวเลข (เช่น 1.75 ไม่ต้องใส่ %)`,
        });
        return;
      }
    }

    setBusy(true);
    setStatus(null);

    // ตัดช่องว่างหัวท้ายก่อนบันทึก ไม่งั้นชื่อที่มีเว้นวรรคติดมาจะโชว์เพี้ยนบนหน้าเว็บ
    const cleaned: InterestRates = {
      deposit: rates.deposit.map((r) => ({ label: r.label.trim(), rate: r.rate.trim() })),
      loan: rates.loan.map((r) => ({ label: r.label.trim(), rate: r.rate.trim() })),
    };

    const response = await fetch("/api/admin/home/", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ interestRates: cleaned }),
    });
    const data = await response.json().catch(() => ({}));

    if (response.ok) {
      setRates(cleaned);
      setSaved(cleaned);
      setStatus({ kind: "ok", text: "บันทึกแล้ว — หน้าแรกเปลี่ยนตามทันที" });
    } else {
      setStatus({ kind: "error", text: data.error ?? "บันทึกไม่สำเร็จ" });
    }
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
        </div>

        {aiReady && (
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
            ["deposit", "เงินฝาก", "text-emerald-700", "เช่น ออมทรัพย์พิเศษ"],
            ["loan", "เงินกู้", "text-orange-700", "เช่น เงินกู้ฉุกเฉิน"],
          ] as const
        ).map(([group, label, color, hint]) => (
          <div key={group} className="mt-5">
            <div className="flex items-baseline justify-between">
              <p className={`text-sm font-medium ${color}`}>{label}</p>
              <p className="text-xs text-gray-400">{rates[group].length} รายการ</p>
            </div>

            {rates[group].length === 0 ? (
              <p className="mt-2 rounded-lg bg-gray-50 py-4 text-center text-xs text-gray-400">
                ยังไม่มีรายการ — กด “เพิ่มรายการ” ด้านล่าง
              </p>
            ) : (
              <div className="mt-2 space-y-2">
                {rates[group].map((item, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="w-5 shrink-0 text-right text-xs text-gray-400">{index + 1}</span>
                    <input
                      value={item.label}
                      onChange={(e) => setRate(group, index, "label", e.target.value)}
                      placeholder={hint}
                      className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
                    />
                    <input
                      value={item.rate}
                      onChange={(e) => setRate(group, index, "rate", e.target.value)}
                      inputMode="decimal"
                      placeholder="1.75"
                      className="w-20 rounded-lg border border-gray-300 px-3 py-2 text-right text-sm outline-none focus:border-brand-500"
                    />
                    <span className="shrink-0 text-xs text-gray-400">%</span>

                    <span className="flex shrink-0 items-center">
                      <button
                        type="button"
                        onClick={() => moveRate(group, index, -1)}
                        disabled={index === 0}
                        title="เลื่อนขึ้น"
                        className="rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:opacity-25"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveRate(group, index, 1)}
                        disabled={index === rates[group].length - 1}
                        title="เลื่อนลง"
                        className="rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:opacity-25"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeRate(group, index)}
                        title="ลบรายการนี้"
                        className="rounded-lg p-1 text-gray-400 transition hover:bg-red-50 hover:text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => addRate(group)}
              className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3.5 py-1.5 text-sm font-medium text-brand-700 transition hover:bg-brand-100"
            >
              <Plus className="h-4 w-4" /> เพิ่มรายการ{label}
            </button>
          </div>
        ))}

        <p className="mt-4 text-xs text-gray-400">
          ลบหรือแก้แล้วยังไม่ถูกใจ กด “ยกเลิก” เพื่อย้อนกลับไปชุดที่บันทึกไว้ล่าสุด —
          ตราบใดที่ยังไม่กดบันทึก หน้าเว็บจริงยังไม่เปลี่ยน
        </p>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={save}
          disabled={busy || !dirty}
          className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-brand-700 disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          บันทึกอัตราดอกเบี้ย
        </button>

        {dirty && (
          <button
            onClick={() => {
              setRates(saved);
              setStatus(null);
            }}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2.5 text-sm font-medium text-gray-600 shadow-sm ring-1 ring-black/5 transition hover:text-gray-900 disabled:opacity-50"
          >
            <RotateCcw className="h-4 w-4" /> ยกเลิก
          </button>
        )}

        {!dirty && !status && <span className="text-sm text-gray-400">ยังไม่มีอะไรเปลี่ยน</span>}

        {status && (
          <span className={`text-sm ${status.kind === "ok" ? "text-emerald-600" : "text-red-500"}`}>
            {status.text}
          </span>
        )}
      </div>
    </div>
  );
}
