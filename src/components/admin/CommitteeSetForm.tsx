"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw, Save, Users } from "lucide-react";

/**
 * ชุดคณะกรรมการดำเนินการที่กำลังทำหน้าที่อยู่
 *
 * ใช้สองที่: หัวการ์ดบนหน้าแรก ("คณะกรรมการชุดที่ 45")
 * และชื่อโฟลเดอร์เก็บรูปฝั่ง FTP (assets/committees/set45)
 * แยกโฟลเดอร์ตามชุดไว้ พอเปลี่ยนชุดใหม่รูปชุดเก่าจะยังอยู่ครบ ไม่ปนกัน
 */
export default function CommitteeSetForm({
  initial,
  storageBase,
}: {
  initial: number;
  /** รากของที่เก็บไฟล์ เช่น https://beta.spsccoop.com/assets — ว่าง = เก็บในเครื่อง */
  storageBase: string;
}) {
  const router = useRouter();
  const [set, setSet] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const dirty = set !== saved;

  async function save() {
    setBusy(true);
    setStatus(null);

    const response = await fetch("/api/admin/home/", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ committeeSet: set }),
    });
    const data = await response.json().catch(() => ({}));
    setBusy(false);

    if (!response.ok) {
      setStatus({ kind: "error", text: data.error ?? "บันทึกไม่สำเร็จ" });
      return;
    }
    setSaved(set);
    setStatus({ kind: "ok", text: "บันทึกแล้ว — รูปที่อัปหลังจากนี้จะลงโฟลเดอร์ของชุดใหม่" });
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
            <span className="font-medium text-gray-700">คณะกรรมการชุดที่ {set || "—"}</span>
          </p>
          <p className="text-gray-500">
            รูปเก็บที่:{" "}
            <code className="break-all font-mono text-gray-700">
              {storageBase ? `${storageBase}/committees/set${set || "?"}/` : "เก็บในเครื่องนี้ (/uploads)"}
            </code>
          </p>
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
