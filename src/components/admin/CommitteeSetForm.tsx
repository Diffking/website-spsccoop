"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw, Save, Users } from "lucide-react";
import { COMMITTEE_PHOTO_BASE, COMMITTEE_PHOTO_SCALES } from "@/lib/committee";

/**
 * ชุดคณะกรรมการดำเนินการที่กำลังทำหน้าที่อยู่
 *
 * ใช้สองที่: หัวการ์ดบนหน้าแรก ("คณะกรรมการดำเนินการชุดที่ 45")
 * และชื่อโฟลเดอร์เก็บรูปฝั่ง FTP (assets/committees/set45)
 * แยกโฟลเดอร์ตามชุดไว้ พอเปลี่ยนชุดใหม่รูปชุดเก่าจะยังอยู่ครบ ไม่ปนกัน
 */
export default function CommitteeSetForm({
  initial,
  initialScale,
  storageBase,
}: {
  initial: number;
  /** ขนาดรูปบนการ์ดหน้าแรก คิดเป็น % ของกรอบเต็ม */
  initialScale: number;
  /** รากของที่เก็บไฟล์ เช่น https://beta.spsccoop.com/assets — ว่าง = เก็บในเครื่อง */
  storageBase: string;
}) {
  const router = useRouter();
  const [set, setSet] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [scale, setScale] = useState(initialScale);
  const [savedScale, setSavedScale] = useState(initialScale);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const dirty = set !== saved || scale !== savedScale;

  async function save() {
    setBusy(true);
    setStatus(null);

    const response = await fetch("/api/admin/home/", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ committeeSet: set, committeePhotoScale: scale }),
    });
    const data = await response.json().catch(() => ({}));
    setBusy(false);

    if (!response.ok) {
      setStatus({ kind: "error", text: data.error ?? "บันทึกไม่สำเร็จ" });
      return;
    }
    setSaved(set);
    setSavedScale(scale);
    setStatus({ kind: "ok", text: "บันทึกแล้ว — หน้าแรกเปลี่ยนตามทันที" });
    router.refresh();
  }

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
          <Users className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-semibold text-gray-800">ชุดคณะกรรมการดำเนินการ</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            ใช้เป็นหัวการ์ดบนหน้าแรก และเป็นชื่อโฟลเดอร์เก็บรูปแยกตามชุด
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-4">
        <label className="block">
          <span className="mb-1 block text-sm text-gray-600">ชุดที่</span>
          <input
            type="number"
            min={1}
            max={999}
            value={set}
            onChange={(e) => setSet(Number(e.target.value))}
            className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
          />
        </label>

        <div className="min-w-0 flex-1 space-y-1 text-xs">
          <p className="text-gray-500">
            หัวการ์ดหน้าแรก:{" "}
            <span className="font-medium text-gray-700">
              คณะกรรมการดำเนินการชุดที่ {set || "—"}
            </span>
          </p>
          <p className="text-gray-500">
            รูปเก็บที่:{" "}
            <code className="break-all font-mono text-gray-700">
              {storageBase ? `${storageBase}/committees/set${set || "?"}/` : "เก็บในเครื่องนี้ (/uploads)"}
            </code>
          </p>
        </div>
      </div>

      {/* ขนาดรูปบนการ์ดหน้าแรก */}
      <div className="mt-4 rounded-xl bg-gray-50 p-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-sm text-gray-700">ขนาดรูปบนการ์ดหน้าแรก</span>
          <span className="text-xs text-gray-500">
            {Math.round((COMMITTEE_PHOTO_BASE.width * scale) / 100)}×
            {Math.round((COMMITTEE_PHOTO_BASE.height * scale) / 100)} px
          </span>
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {COMMITTEE_PHOTO_SCALES.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setScale(value)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                scale === value
                  ? "bg-brand-600 text-white shadow"
                  : "bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50"
              }`}
            >
              {value}%
            </button>
          ))}
        </div>

        {/* กรอบตัวอย่างขนาดจริง จะได้เห็นก่อนว่าใหญ่แค่ไหนบนหน้าเว็บ */}
        <div className="mt-3 flex items-end gap-3">
          <div
            style={{
              width: (COMMITTEE_PHOTO_BASE.width * scale) / 100,
              height: (COMMITTEE_PHOTO_BASE.height * scale) / 100,
            }}
            className="grid shrink-0 place-items-center rounded-xl bg-gradient-to-b from-brand-100 to-brand-50 ring-1 ring-black/5"
          >
            <Users className="h-6 w-6 text-brand-300" />
          </div>
          <p className="pb-1 text-xs text-gray-400">กรอบนี้คือขนาดจริงที่จะขึ้นบนหน้าแรก</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          onClick={save}
          disabled={busy || !dirty}
          className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow transition hover:bg-brand-700 disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          บันทึกชุด
        </button>
        {dirty && (
          <button
            onClick={() => {
              setSet(saved);
              setScale(savedScale);
              setStatus(null);
            }}
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-sm text-gray-600 shadow-sm ring-1 ring-black/5 transition hover:text-gray-800"
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

      <p className="mt-3 text-xs text-gray-400">
        เปลี่ยนชุดแล้วรูปเดิมยังอยู่ที่โฟลเดอร์ชุดเก่าและยังแสดงได้ตามปกติ —
        อัปรูปชุดใหม่ทับทีละคนได้เลย
      </p>
    </section>
  );
}
