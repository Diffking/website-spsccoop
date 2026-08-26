"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { uploadWithProgress } from "@/lib/uploadClient";
import { CHECKUP_QUESTIONS, GROUP_LABEL, GROUP_TONE } from "@/lib/financialCheckup";
import { PROGRAM_PAGES, type CheckupImages } from "@/lib/programPages";

/**
 * หน้าโปรแกรมในหลังบ้าน — ดูที่อยู่ของแต่ละโปรแกรม และตั้งค่าของโปรแกรมนั้น
 *
 * ตอนนี้มีโปรแกรมเดียว (ตรวจสุขภาพการเงิน) ที่ตั้งค่าได้อย่างเดียวคือภาพประกอบคำถาม
 * — เพิ่มโปรแกรมใหม่ต้องไปต่อท้ายใน src/lib/programPages.ts
 *
 * บันทึกให้เองทันทีที่อัปรูปเสร็จหรือกดเอาออก (แนวเดียวกับหน้าสไลด์)
 * เพราะงานที่นี่คือ "อัปรูปทีละข้อ" ไม่ใช่กรอกฟอร์มยาวแล้วค่อยกดบันทึกรอบเดียว
 */
export default function ProgramsManager({ initial, publicBase }: { initial: CheckupImages; publicBase: string }) {
  const [images, setImages] = useState<CheckupImages>(initial);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  async function save(next: CheckupImages) {
    setImages(next);
    const response = await fetch("/api/admin/programs/", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checkupImages: next }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setStatus({ kind: "error", text: data.error ?? "บันทึกไม่สำเร็จ" });
      return;
    }
    setStatus({ kind: "ok", text: "บันทึกแล้ว" });
  }

  async function upload(id: string, file: File) {
    setBusyId(id);
    setStatus(null);
    const form = new FormData();
    form.append("file", file);
    form.append("folder", "page_images");
    // 600px พอสำหรับแถบภาพหัวการ์ดคำถาม — เพดานเดียวกับทั้งเว็บ ห้ามขยับขึ้น
    form.append("maxEdge", "600");
    const result = await uploadWithProgress<{ url: string }>("/api/admin/upload/", form, () => {});
    setBusyId(null);
    if (!result.ok) {
      setStatus({ kind: "error", text: result.error });
      return;
    }
    await save({ ...images, [id]: result.data.url });
  }

  function copyLink(path: string) {
    const url = `${publicBase}${path}`;
    void navigator.clipboard?.writeText(url).then(() => {
      setCopied(path);
      window.setTimeout(() => setCopied(null), 1600);
    });
  }

  return (
    <div className="space-y-6">
      {status && (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            status.kind === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
          }`}
        >
          {status.text}
        </p>
      )}

      {/* ทะเบียนโปรแกรม — สิ่งที่เจ้าหน้าที่มาหาที่หน้านี้บ่อยที่สุดคือ "ที่อยู่เอาไปวางที่ไหน" */}
      {PROGRAM_PAGES.map((program) => (
        <section key={program.path} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
          <h2 className="text-lg font-bold text-gray-800">{program.title}</h2>
          <p className="mt-1 text-sm text-gray-600">{program.desc}</p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm text-gray-700">{program.path}</code>
            <button
              type="button"
              onClick={() => copyLink(program.path)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-700 transition hover:bg-brand-100"
            >
              {copied === program.path ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied === program.path ? "คัดลอกแล้ว" : "คัดลอกที่อยู่เต็ม"}
            </button>
            <a
              href={program.path}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-500 transition hover:bg-gray-100"
            >
              <ExternalLink className="h-3.5 w-3.5" /> เปิดดู
            </a>
          </div>

          <ul className="mt-3 space-y-1 text-sm text-gray-500">
            {program.features.map((line) => (
              <li key={line}>· {line}</li>
            ))}
          </ul>

          <p className="mt-3 rounded-lg bg-brand-50/70 px-3 py-2 text-xs text-brand-900">
            เอาที่อยู่นี้ไปวางได้ทั้งในเมนู (ส่วนหัวเว็บ) · ปุ่มบนสไลด์หน้าแรก · การ์ดบริการ
            หรือแทรกเป็นลิงก์ในหน้าเนื้อหาก็ได้
          </p>
        </section>
      ))}

      {/* ภาพประกอบรายข้อ */}
      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
        <h2 className="text-lg font-bold text-gray-800">ภาพประกอบคำถาม</h2>
        <p className="mt-1 text-sm text-gray-600">
          ใส่ภาพให้ข้อไหนก็ได้ ไม่ใส่ก็ได้ — ข้อที่ไม่มีภาพจะแสดงเป็นแถบสีอ่อนกับไอคอนแทน
          ความสูงเท่ากันเสมอ การ์ดคำถามจึงไม่กระตุกตอนเปลี่ยนข้อ
        </p>

        <ul className="mt-4 divide-y divide-gray-100">
          {CHECKUP_QUESTIONS.map((question, i) => {
            const tone = GROUP_TONE[question.group];
            const url = images[question.id];
            return (
              <li key={question.id} className="flex items-center gap-3 py-3">
                <span className="w-6 shrink-0 text-right text-xs tabular-nums text-gray-400">{i + 1}.</span>

                {/* กรอบรูปขนาดคงที่ — แถวจะได้ไม่สูงไม่เท่ากันตามรูปที่อัปมา */}
                <div className={`grid h-12 w-16 shrink-0 place-items-center overflow-hidden rounded-lg ${tone.bg}`}>
                  {url ? (
                    // รูปมาจากหลังบ้าน ไม่รู้ขนาดล่วงหน้า จึงใช้ <img> ธรรมดา
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <ImagePlus className={`h-4 w-4 opacity-40 ${tone.text}`} />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-700">{question.text}</p>
                  <p className={`text-xs ${tone.text}`}>{GROUP_LABEL[question.group]}</p>
                </div>

                <label className="shrink-0 cursor-pointer rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-200">
                  {busyId === question.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : url ? (
                    "เปลี่ยนภาพ"
                  ) : (
                    "เพิ่มภาพ"
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file) void upload(question.id, file);
                    }}
                  />
                </label>

                {url && (
                  <button
                    type="button"
                    title="เอาภาพออก"
                    onClick={() => {
                      const next = { ...images };
                      delete next[question.id];
                      void save(next);
                    }}
                    className="shrink-0 rounded-lg p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
