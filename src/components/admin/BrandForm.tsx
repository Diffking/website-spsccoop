"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, Save, X } from "lucide-react";
import type { SiteBrand } from "@/lib/nav";
import UploadProgress from "@/components/admin/UploadProgress";
import { uploadWithProgress, type UploadPhase } from "@/lib/uploadClient";
import AssetImage from "@/components/admin/AssetImage";

/** ชื่อเว็บและโลโก้ที่ขึ้นบนแถบบนสุดของทุกหน้า */
export default function BrandForm({ initial }: { initial: SiteBrand }) {
  const [brand, setBrand] = useState<SiteBrand>(initial);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ phase: UploadPhase | null; percent: number; name: string }>(
    { phase: null, percent: 0, name: "" },
  );
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const filePicker = useRef<HTMLInputElement>(null);

  const set = (key: keyof SiteBrand, value: string) => setBrand((b) => ({ ...b, [key]: value }));

  async function upload(file: File) {
    setUploading(true);
    setStatus(null);
    setProgress({ phase: "upload", percent: 0, name: file.name });

    const form = new FormData();
    form.append("file", file);
    // เก็บแยกโฟลเดอร์ ไม่ปนกับแบนเนอร์สไลด์
    form.append("folder", "brand");
    const result = await uploadWithProgress<{ url: string }>("/api/admin/upload/", form, (percent, phase) =>
      setProgress((p) => ({ ...p, percent, phase })),
    );
    setUploading(false);

    if (!result.ok) {
      setStatus({ kind: "error", text: result.error });
      return;
    }
    set("logoUrl", result.data.url);
  }

  async function save() {
    setBusy(true);
    setStatus(null);

    const response = await fetch("/api/admin/header/", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brand }),
    });
    const data = await response.json().catch(() => ({}));
    setBusy(false);

    if (!response.ok) {
      setStatus({ kind: "error", text: data.error ?? "บันทึกไม่สำเร็จ" });
      return;
    }
    setStatus({ kind: "ok", text: "บันทึกแล้ว" });
  }

  const field = "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400";

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <h2 className="font-semibold text-gray-800">ชื่อเว็บและโลโก้</h2>
      <p className="mt-0.5 text-xs text-gray-500">ขึ้นบนแถบบนสุดของทุกหน้า และท้ายเว็บ</p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm text-gray-600">ชื่อเต็ม</span>
          <input value={brand.name} onChange={(e) => set("name", e.target.value)} className={field} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-gray-600">
            ชื่อย่อ <span className="text-gray-400">(ใช้บนจอมือถือ)</span>
          </span>
          <input value={brand.shortName} onChange={(e) => set("shortName", e.target.value)} className={field} />
        </label>
      </div>

      <div className="mt-4">
        <span className="mb-1.5 block text-sm text-gray-600">
          โลโก้{" "}
          <span className="text-gray-400">
            (รองรับ .svg — คมทุกความละเอียด · เว้นว่าง = ใช้โลโก้เดิมที่ติดมากับเว็บ)
          </span>
        </span>
        <div className="flex items-center gap-3">
          <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full bg-gray-100 ring-1 ring-black/5">
            {brand.logoUrl ? (
              <AssetImage src={brand.logoUrl} alt="โลโก้" className="h-12 w-12 object-contain" />
            ) : (
              <ImagePlus className="h-5 w-5 text-gray-400" />
            )}
          </span>

          <input
            ref={filePicker}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/svg+xml,.svg"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => filePicker.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3.5 py-2 text-sm font-medium text-brand-700 transition hover:bg-brand-100 disabled:opacity-50"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
            เลือกรูป
          </button>
          {brand.logoUrl && (
            <button
              type="button"
              onClick={() => set("logoUrl", "")}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-2 text-sm text-gray-500 transition hover:text-red-600"
            >
              <X className="h-4 w-4" /> เอาออก
            </button>
          )}
        </div>
      </div>

      <UploadProgress phase={progress.phase} percent={progress.percent} fileName={progress.name} />

      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow transition hover:bg-brand-700 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          บันทึก
        </button>
        {status && (
          <span className={`text-sm ${status.kind === "ok" ? "text-emerald-600" : "text-red-600"}`}>
            {status.text}
          </span>
        )}
      </div>
    </section>
  );
}
