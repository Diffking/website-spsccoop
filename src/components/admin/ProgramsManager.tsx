"use client";

import { useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  ImagePlus,
  Loader2,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { uploadWithProgress } from "@/lib/uploadClient";
import {
  DEFAULT_QUESTIONS,
  GROUP_LABEL,
  GROUP_ORDER,
  GROUP_TONE,
  SCALE_LABEL,
  type CheckupGroup,
  type CheckupQuestion,
  type ScaleKey,
} from "@/lib/financialCheckup";
import { PROGRAM_PAGES, type CheckupImages } from "@/lib/programPages";

/**
 * หน้าโปรแกรมในหลังบ้าน — ดูที่อยู่ของแต่ละโปรแกรม และแก้ของในโปรแกรมนั้น
 *
 * ตอนนี้มีโปรแกรมเดียว (ตรวจสุขภาพการเงิน) แก้ได้ทั้ง **คำถาม กลุ่ม ช่วงเงิน และภาพประกอบ**
 * — เพิ่มโปรแกรมใหม่ต้องไปต่อท้ายใน src/lib/programPages.ts
 *
 * ⚠️ **หน้านี้ต้องกดบันทึกเอง** (ต่างจากหน้าสไลด์ที่บันทึกให้ทันที) เพราะแก้ข้อความยาว ๆ
 * ถ้าบันทึกทุกครั้งที่พิมพ์จะยิงเข้าเซิร์ฟเวอร์รัวมาก · ยกเว้นการอัป/ลบภาพที่บันทึกให้เลย
 * เพราะกดครั้งเดียวจบและไม่มีอะไรให้พิมพ์ต่อ
 */

// ลำดับหมวดมาจากตัวกลาง — เพิ่มหมวดใหม่ที่นั่นแล้วช่องเลือกตรงนี้ได้ตามเอง
const GROUPS = GROUP_ORDER;
const SCALES: ScaleKey[] = ["small", "medium", "large"];

/** รหัสของข้อใหม่ — ต้องไม่ซ้ำของเดิม ไม่งั้นคำตอบสองข้อจะทับกันเอง */
const newId = (taken: Set<string>) => {
  let n = taken.size + 1;
  while (taken.has(`q${n}`)) n += 1;
  return `q${n}`;
};

export default function ProgramsManager({
  initialQuestions,
  initialImages,
  publicBase,
}: {
  initialQuestions: CheckupQuestion[];
  initialImages: CheckupImages;
  publicBase: string;
}) {
  const [questions, setQuestions] = useState<CheckupQuestion[]>(initialQuestions);
  const [images, setImages] = useState<CheckupImages>(initialImages);
  const [saved, setSaved] = useState(() => JSON.stringify(initialQuestions));
  const [busyId, setBusyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const dirty = JSON.stringify(questions) !== saved;

  async function send(body: Record<string, unknown>): Promise<boolean> {
    const response = await fetch("/api/admin/programs/", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setStatus({ kind: "error", text: data.error ?? "บันทึกไม่สำเร็จ" });
      return false;
    }
    return true;
  }

  async function saveQuestions() {
    setSaving(true);
    setStatus(null);
    const ok = await send({ checkupQuestions: questions });
    setSaving(false);
    if (!ok) return;
    setSaved(JSON.stringify(questions));
    setStatus({ kind: "ok", text: `บันทึกคำถามแล้ว ${questions.length} ข้อ` });
  }

  /** ภาพบันทึกให้เองทันที — ต้องส่งคำถามชุดปัจจุบันไปด้วย ไม่งั้นรหัสภาพของข้อใหม่จะถูกทิ้ง */
  async function saveImages(next: CheckupImages) {
    setImages(next);
    setStatus(null);
    if (await send({ checkupImages: next, checkupQuestions: questions })) {
      setSaved(JSON.stringify(questions));
      setStatus({ kind: "ok", text: "บันทึกภาพแล้ว" });
    }
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
    await saveImages({ ...images, [id]: result.data.url });
  }

  const patch = (id: string, next: Partial<CheckupQuestion>) =>
    setQuestions((list) => list.map((q) => (q.id === id ? { ...q, ...next } : q)));

  const move = (index: number, delta: number) =>
    setQuestions((list) => {
      const to = index + delta;
      if (to < 0 || to >= list.length) return list;
      const copy = [...list];
      [copy[index], copy[to]] = [copy[to], copy[index]];
      return copy;
    });

  function copyLink(path: string) {
    void navigator.clipboard?.writeText(`${publicBase}${path}`).then(() => {
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

          <p className="mt-3 rounded-lg bg-brand-50/70 px-3 py-2 text-xs text-brand-900">
            เอาที่อยู่นี้ไปวางได้ทั้งในเมนู (ส่วนหัวเว็บ) · ปุ่มบนสไลด์หน้าแรก · การ์ดบริการ
            หรือแทรกเป็นลิงก์ในหน้าเนื้อหาก็ได้
          </p>
        </section>
      ))}

      {/* คำถาม */}
      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-bold text-gray-800">คำถาม {questions.length} ข้อ</h2>
          <button
            type="button"
            onClick={() => {
              if (confirm("ดึงคำถามชุดตั้งต้นกลับมาทับของที่แก้ไว้ทั้งหมด?")) {
                setQuestions(DEFAULT_QUESTIONS);
              }
            }}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-400 transition hover:text-gray-700"
          >
            <RotateCcw className="h-3.5 w-3.5" /> ใช้คำถามชุดตั้งต้น
          </button>
        </div>
        <p className="mt-1 text-sm text-gray-600">
          แก้ข้อความ เพิ่มข้อ ลบข้อ สลับลำดับ และเลือกกลุ่มได้เอง —{" "}
          <b>กลุ่มมีผลกับกราฟสรุปผลและคำแนะนำ</b> ส่วน <b>ช่วงเงิน</b> คือเพดานของสเกลที่เลื่อนได้ในข้อนั้น
        </p>

        <ul className="mt-4 space-y-3">
          {questions.map((question, i) => {
            const tone = GROUP_TONE[question.group];
            const url = images[question.id];
            return (
              <li key={question.id} className={`rounded-xl p-3 ring-1 ${tone.bg} ${tone.ring}`}>
                <div className="flex items-start gap-2">
                  <span className="mt-2 w-6 shrink-0 text-right text-xs tabular-nums text-gray-400">
                    {i + 1}.
                  </span>

                  <div className="min-w-0 flex-1 space-y-2">
                    <textarea
                      value={question.text}
                      onChange={(e) => patch(question.id, { text: e.target.value })}
                      rows={2}
                      placeholder="คำถามที่สมาชิกเห็น"
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400"
                    />
                    <input
                      value={question.hint}
                      onChange={(e) => patch(question.id, { hint: e.target.value })}
                      placeholder="คำอธิบายใต้คำถาม (เว้นว่างได้)"
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-brand-400"
                    />

                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={question.group}
                        onChange={(e) => patch(question.id, { group: e.target.value as CheckupGroup })}
                        className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-brand-400"
                      >
                        {GROUPS.map((g) => (
                          <option key={g} value={g}>
                            {GROUP_LABEL[g]}
                          </option>
                        ))}
                      </select>
                      <select
                        value={question.scale}
                        onChange={(e) => patch(question.id, { scale: e.target.value as ScaleKey })}
                        className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-brand-400"
                      >
                        {SCALES.map((s) => (
                          <option key={s} value={s}>
                            ช่วงเงิน {SCALE_LABEL[s]}
                          </option>
                        ))}
                      </select>

                      <label className="cursor-pointer rounded-lg bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 ring-1 ring-gray-200 transition hover:bg-gray-50">
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
                    </div>
                  </div>

                  {/* กรอบรูปขนาดคงที่ — แถวจะได้ไม่สูงไม่เท่ากันตามรูปที่อัปมา */}
                  <div className="shrink-0 space-y-1">
                    <div className="grid h-12 w-16 place-items-center overflow-hidden rounded-lg bg-white ring-1 ring-gray-200">
                      {url ? (
                        // รูปมาจากหลังบ้าน ไม่รู้ขนาดล่วงหน้า จึงใช้ <img> ธรรมดา
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <ImagePlus className="h-4 w-4 text-gray-300" />
                      )}
                    </div>
                    {url && (
                      <button
                        type="button"
                        onClick={() => {
                          const next = { ...images };
                          delete next[question.id];
                          void saveImages(next);
                        }}
                        className="w-full text-center text-[11px] text-gray-400 transition hover:text-red-600"
                      >
                        เอาภาพออก
                      </button>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-col gap-0.5">
                    <button
                      type="button"
                      title="เลื่อนขึ้น"
                      disabled={i === 0}
                      onClick={() => move(i, -1)}
                      className="rounded p-1 text-gray-400 transition hover:bg-white hover:text-gray-700 disabled:opacity-25"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      title="เลื่อนลง"
                      disabled={i === questions.length - 1}
                      onClick={() => move(i, 1)}
                      className="rounded p-1 text-gray-400 transition hover:bg-white hover:text-gray-700 disabled:opacity-25"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      title="ลบข้อนี้"
                      onClick={() => {
                        if (confirm(`ลบคำถามข้อ ${i + 1}?`)) {
                          setQuestions((list) => list.filter((q) => q.id !== question.id));
                        }
                      }}
                      className="rounded p-1 text-gray-400 transition hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          onClick={() =>
            setQuestions((list) => [
              ...list,
              {
                id: newId(new Set(list.map((q) => q.id))),
                group: "need",
                scale: "small",
                text: "",
                hint: "",
              },
            ])
          }
          className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-gray-300 py-3 text-sm font-medium text-gray-500 transition hover:border-brand-400 hover:text-brand-700"
        >
          <Plus className="h-4 w-4" /> เพิ่มคำถาม
        </button>
      </section>

      {/*
        แถบบันทึกติดล่างจอตอนมีของค้าง — แนวเดียวกับหน้าเนื้อหา
        เพราะสองหน้านี้เหมือนกันตรงที่ "พิมพ์แล้วต้องกดบันทึกเอง"
      */}
      {dirty && (
        <div className="sticky bottom-3 z-10 flex items-center justify-between gap-3 rounded-xl bg-gray-900 px-4 py-3 text-sm text-white shadow-lg">
          <span>มีคำถามที่แก้ไว้ยังไม่ได้บันทึก</span>
          <button
            type="button"
            onClick={() => void saveQuestions()}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-gray-900 transition hover:bg-gray-100 disabled:opacity-60"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            บันทึกคำถาม
          </button>
        </div>
      )}
    </div>
  );
}
