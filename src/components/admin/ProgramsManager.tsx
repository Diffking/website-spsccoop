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
  GROUP_HINT,
  GROUP_LABEL,
  GROUP_ORDER,
  GROUP_TONE,
  SCALE_LABEL,
  type CheckupGroup,
  type CheckupQuestion,
  type ScaleKey,
} from "@/lib/financialCheckup";
import {
  CHECKUP_CREDIT,
  CHECKUP_VERSION,
  COUNT_TOKEN,
  DEFAULT_INTEREST_INTRO,
  DEFAULT_INTRO,
  PROGRAM_PAGES,
  type CheckupImages,
  type CheckupIntro,
  type InterestIntro,
} from "@/lib/programPages";
import type { RateRow } from "@/lib/interestCalc";

/**
 * หน้าโปรแกรมในหลังบ้าน — ดูที่อยู่ของแต่ละโปรแกรม และแก้ของในโปรแกรมนั้น
 *
 * ตอนนี้มีสองโปรแกรม — **ตรวจสุขภาพการเงิน** แก้ได้ทั้งคำถาม กลุ่ม ช่วงเงิน และภาพประกอบ ·
 * **คำนวณดอกเบี้ย** เลือกได้ว่าให้ขึ้นปุ่มลัดอัตราดอกเบี้ยเงินกู้ประเภทไหนบ้าง
 * — เพิ่มโปรแกรมใหม่ต้องไปต่อท้ายใน src/lib/programPages.ts
 *
 * ⚠️ **หน้านี้ต้องกดบันทึกเอง** (ต่างจากหน้าสไลด์ที่บันทึกให้ทันที) เพราะแก้ข้อความยาว ๆ
 * ถ้าบันทึกทุกครั้งที่พิมพ์จะยิงเข้าเซิร์ฟเวอร์รัวมาก · ยกเว้นการอัป/ลบภาพที่บันทึกให้เลย
 * เพราะกดครั้งเดียวจบและไม่มีอะไรให้พิมพ์ต่อ
 */

// ลำดับหมวดมาจากตัวกลาง — เพิ่มหมวดใหม่ที่นั่นแล้วช่องเลือกตรงนี้ได้ตามเอง
const GROUPS = GROUP_ORDER;
const SCALES: ScaleKey[] = ["small", "medium", "large"];

/** ติ๊กเข้า/ออกจากรายการที่ซ่อน — ใช้ร่วมกันทั้งฝั่งเงินกู้และเงินรับฝาก */
const flip = (list: string[], name: string) =>
  list.includes(name) ? list.filter((item) => item !== name) : [...list, name];

/** รหัสของข้อใหม่ — ต้องไม่ซ้ำของเดิม ไม่งั้นคำตอบสองข้อจะทับกันเอง */
const newId = (taken: Set<string>) => {
  let n = taken.size + 1;
  while (taken.has(`q${n}`)) n += 1;
  return `q${n}`;
};

export default function ProgramsManager({
  initialQuestions,
  initialImages,
  initialLogo,
  initialIntro,
  loanRates,
  depositRates,
  initialHiddenLoan,
  initialHiddenDeposit,
  initialInterestIntro,
  publicBase,
}: {
  initialQuestions: CheckupQuestion[];
  initialImages: CheckupImages;
  initialLogo: string;
  initialIntro: CheckupIntro;
  /** อัตราดอกเบี้ยทั้งหมดที่ตั้งไว้ที่ หลังบ้าน → อัตราดอกเบี้ย (หน้านี้ไม่ได้แก้ตัวเลข) */
  loanRates: RateRow[];
  depositRates: RateRow[];
  /** ประเภทที่ติ๊กไว้ว่าไม่ต้องขึ้นในโปรแกรมคำนวณดอกเบี้ย — ว่าง = ขึ้นทั้งหมด */
  initialHiddenLoan: string[];
  initialHiddenDeposit: string[];
  /** คำอธิบายว่าโปรแกรมคำนวณดอกเบี้ยมีไว้ทำอะไร — ขึ้นใต้เครื่องคิดเลข */
  initialInterestIntro: InterestIntro;
  publicBase: string;
}) {
  const [questions, setQuestions] = useState<CheckupQuestion[]>(initialQuestions);
  const [images, setImages] = useState<CheckupImages>(initialImages);
  const [logo, setLogo] = useState(initialLogo);
  const [intro, setIntro] = useState<CheckupIntro>(initialIntro);
  const [savedIntro, setSavedIntro] = useState(() => JSON.stringify(initialIntro));
  const [saved, setSaved] = useState(() => JSON.stringify(initialQuestions));
  const [busyId, setBusyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  /**
   * หมวดที่กำลังดูอยู่ — "all" = ดูทั้งหมดตามลำดับที่ถามจริง
   *
   * เจ้าของเว็บขอไว้ 26 ส.ค. 2026 ว่าอยากเห็นชื่อหมวดในหน้านี้ จะได้แยกง่าย
   * ⚠️ **ไม่จัดกลุ่มถาวรให้** เพราะลำดับในรายการนี้คือลำดับที่สมาชิกถูกถามจริง
   * ถ้าเรียงใหม่ตามหมวด คนแก้จะเข้าใจผิดว่าคำถามถูกถามเรียงเป็นหมวด ๆ ซึ่งไม่ใช่
   */
  const [only, setOnly] = useState<CheckupGroup | "all">("all");
  /** ประเภทที่ติ๊กไว้ว่าไม่ต้องขึ้นในโปรแกรมคำนวณดอกเบี้ย (เก็บเป็นชื่อรายการ) แยกสองฝั่ง */
  const [hiddenLoan, setHiddenLoan] = useState<string[]>(initialHiddenLoan);
  const [savedLoan, setSavedLoan] = useState(() => JSON.stringify(initialHiddenLoan));
  const [hiddenDeposit, setHiddenDeposit] = useState<string[]>(initialHiddenDeposit);
  const [savedDeposit, setSavedDeposit] = useState(() => JSON.stringify(initialHiddenDeposit));
  /** บทความใต้เครื่องคิดเลขของโปรแกรมคำนวณดอกเบี้ย */
  const [rateIntro, setRateIntro] = useState<InterestIntro>(initialInterestIntro);
  const [savedRateIntro, setSavedRateIntro] = useState(() =>
    JSON.stringify(initialInterestIntro),
  );
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const dirty = JSON.stringify(questions) !== saved;
  const introDirty = JSON.stringify(intro) !== savedIntro;
  const loanDirty = JSON.stringify(hiddenLoan) !== savedLoan;
  const depositDirty = JSON.stringify(hiddenDeposit) !== savedDeposit;
  const rateIntroDirty = JSON.stringify(rateIntro) !== savedRateIntro;

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

  /**
   * รายการอัตราที่ติ๊กไว้ — ต้องกดบันทึกเอง (ติ๊กหลายอันรวดเดียวแล้วค่อยบันทึกทีเดียว)
   * ⚠️ ส่งเฉพาะฝั่งที่กดบันทึก ไม่ส่งอีกฝั่งไปด้วย ไม่งั้นของที่อีกฝั่งแก้ค้างไว้จะถูกบันทึกตามไปเงียบ ๆ
   */
  async function saveRates(which: "loan" | "deposit") {
    const loan = which === "loan";
    const hidden = loan ? hiddenLoan : hiddenDeposit;
    const rows = loan ? loanRates : depositRates;

    setSaving(true);
    setStatus(null);
    const ok = await send(loan ? { interestRatesHidden: hidden } : { interestDepositHidden: hidden });
    setSaving(false);
    if (!ok) return;

    (loan ? setSavedLoan : setSavedDeposit)(JSON.stringify(hidden));
    const shown = rows.filter((row) => !hidden.includes(row.label.trim())).length;
    setStatus({
      kind: "ok",
      text: `บันทึกแล้ว — ฝั่ง${loan ? "เงินกู้" : "เงินรับฝาก"}จะขึ้นปุ่มลัด ${shown} ประเภท`,
    });
  }

  /** บทความของโปรแกรมคำนวณดอกเบี้ย — กดบันทึกเอง เหมือนข้อความยาว ๆ ที่อื่นในหน้านี้ */
  async function saveRateIntro() {
    setSaving(true);
    setStatus(null);
    const ok = await send({ interestIntro: rateIntro });
    setSaving(false);
    if (!ok) return;
    setSavedRateIntro(JSON.stringify(rateIntro));
    setStatus({ kind: "ok", text: "บันทึกคำอธิบายโปรแกรมคำนวณดอกเบี้ยแล้ว" });
  }

  async function saveIntro() {
    setSaving(true);
    setStatus(null);
    const ok = await send({ checkupIntro: intro });
    setSaving(false);
    if (!ok) return;
    setSavedIntro(JSON.stringify(intro));
    setStatus({ kind: "ok", text: "บันทึกข้อความหน้าแรกแล้ว" });
  }

  /** โลโก้บันทึกให้เองทันทีเหมือนภาพประกอบ — กดครั้งเดียวจบ ไม่มีอะไรให้พิมพ์ต่อ */
  async function uploadLogo(file: File) {
    setBusyId("__logo");
    setStatus(null);
    const form = new FormData();
    form.append("file", file);
    form.append("folder", "brand");
    // โลโก้เป็นจัตุรัส 600px พอสำหรับกรอบ 128px บนจอความละเอียดสูง
    form.append("maxEdge", "600");
    const result = await uploadWithProgress<{ url: string }>("/api/admin/upload/", form, () => {});
    setBusyId(null);
    if (!result.ok) {
      setStatus({ kind: "error", text: result.error });
      return;
    }
    setLogo(result.data.url);
    if (await send({ checkupLogo: result.data.url })) {
      setStatus({ kind: "ok", text: "บันทึกโลโก้แล้ว" });
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

      {/* ---------------- ของโปรแกรมคำนวณดอกเบี้ยอย่างเดียว ---------------- */}
      <h2 className="border-t border-gray-200 pt-5 text-sm font-semibold text-gray-500">
        ตั้งค่าเฉพาะของโปรแกรมคำนวณดอกเบี้ย
      </h2>

      <RatePicker
        title="อัตราดอกเบี้ยเงินกู้"
        hint="ปุ่มลัดที่ขึ้นเมื่อสมาชิกเลือกฝั่ง “เงินกู้” ในขั้นที่ 1 ของโปรแกรม"
        rows={loanRates}
        hidden={hiddenLoan}
        dirty={loanDirty}
        saving={saving}
        onToggle={(name) => setHiddenLoan((list) => flip(list, name))}
        onAll={() => setHiddenLoan([])}
        onSave={() => void saveRates("loan")}
      />

      <RatePicker
        title="อัตราดอกเบี้ยเงินรับฝาก"
        hint="ปุ่มลัดที่ขึ้นเมื่อสมาชิกเลือกฝั่ง “เงินรับฝาก” — สูตรเดียวกัน ต่างกันแค่อัตราและถ้อยคำ"
        rows={depositRates}
        hidden={hiddenDeposit}
        dirty={depositDirty}
        saving={saving}
        onToggle={(name) => setHiddenDeposit((list) => flip(list, name))}
        onAll={() => setHiddenDeposit([])}
        onSave={() => void saveRates("deposit")}
      />

      {/* บทความใต้เครื่องคิดเลข — บอกสมาชิกว่าโปรแกรมนี้มีไว้ทำอะไร */}
      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-bold text-gray-800">คำอธิบายว่าโปรแกรมนี้มีไว้ทำอะไร</h2>
          <button
            type="button"
            onClick={() => {
              if (confirm("ดึงข้อความชุดตั้งต้นกลับมาทับของที่แก้ไว้?"))
                setRateIntro(DEFAULT_INTEREST_INTRO);
            }}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-400 transition hover:text-gray-700"
          >
            <RotateCcw className="h-3.5 w-3.5" /> ใช้ข้อความชุดตั้งต้น
          </button>
        </div>
        <p className="mt-1 text-sm text-gray-600">
          ขึ้นเป็นบทความ<b>ใต้เครื่องคิดเลข</b>ในขั้นที่ 1 — บอกว่านี่คือสื่อการเรียนรู้ให้สมาชิก
          ได้ฝึกคิดเอง ไม่ใช่ระบบแจ้งยอดหนี้จริง · <b>พิมพ์เป็นข้อความล้วน</b> ใส่แท็ก HTML
          ลงไปจะโผล่เป็นตัวหนังสือให้สมาชิกเห็น
        </p>

        <label className="mt-4 block text-sm font-medium text-gray-700">
          หัวเรื่อง
          <input
            value={rateIntro.heading}
            onChange={(e) => setRateIntro({ ...rateIntro, heading: e.target.value })}
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
          />
        </label>

        <label className="mt-3 block text-sm font-medium text-gray-700">
          ย่อหน้านำ <span className="font-normal text-gray-400">(ตัวหนากว่าย่อหน้าอื่น)</span>
          <textarea
            value={rateIntro.lead}
            onChange={(e) => setRateIntro({ ...rateIntro, lead: e.target.value })}
            rows={3}
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
          />
        </label>

        <p className="mt-4 text-sm font-medium text-gray-700">เนื้อหา (ย่อหน้าละหนึ่งช่อง)</p>
        <ul className="mt-1.5 space-y-2">
          {rateIntro.paragraphs.map((text, i) => (
            <li key={i} className="flex items-start gap-2">
              <textarea
                value={text}
                rows={3}
                onChange={(e) =>
                  setRateIntro({
                    ...rateIntro,
                    paragraphs: rateIntro.paragraphs.map((t, n) =>
                      n === i ? e.target.value : t,
                    ),
                  })
                }
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
              />
              <button
                type="button"
                title="ลบย่อหน้านี้"
                onClick={() =>
                  setRateIntro({
                    ...rateIntro,
                    paragraphs: rateIntro.paragraphs.filter((_, n) => n !== i),
                  })
                }
                className="mt-1 shrink-0 rounded p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() =>
            setRateIntro({ ...rateIntro, paragraphs: [...rateIntro.paragraphs, ""] })
          }
          className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 transition hover:text-brand-800"
        >
          <Plus className="h-3.5 w-3.5" /> เพิ่มย่อหน้า
        </button>

        <p className="mt-4 text-sm font-medium text-gray-700">บรรทัด “ลองฝึกดูแบบนี้” (กรอบสีฟ้าอ่อน)</p>
        <ul className="mt-1.5 space-y-2">
          {rateIntro.tips.map((tip, i) => (
            <li key={i} className="flex items-center gap-2">
              <input
                value={tip}
                onChange={(e) =>
                  setRateIntro({
                    ...rateIntro,
                    tips: rateIntro.tips.map((t, n) => (n === i ? e.target.value : t)),
                  })
                }
                className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-brand-400"
              />
              <button
                type="button"
                title="ลบบรรทัดนี้"
                onClick={() =>
                  setRateIntro({ ...rateIntro, tips: rateIntro.tips.filter((_, n) => n !== i) })
                }
                className="shrink-0 rounded p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setRateIntro({ ...rateIntro, tips: [...rateIntro.tips, ""] })}
          className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 transition hover:text-brand-800"
        >
          <Plus className="h-3.5 w-3.5" /> เพิ่มบรรทัด
        </button>

        {rateIntroDirty && (
          <button
            type="button"
            onClick={() => void saveRateIntro()}
            disabled={saving}
            className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white shadow transition hover:bg-brand-700 disabled:opacity-60"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            บันทึกคำอธิบาย
          </button>
        )}
      </section>

      {/*
        ตั้งแต่บรรทัดนี้ลงไปเป็นของ "ตรวจสุขภาพการเงิน" อย่างเดียว
        — มีโปรแกรมมากกว่าหนึ่งตัวแล้ว ต้องบอกให้ชัด ไม่งั้นเจ้าหน้าที่จะนึกว่า
        โลโก้กับคำถามข้างล่างนี้เป็นของทุกโปรแกรมรวมกัน
      */}
      <h2 className="border-t border-gray-200 pt-5 text-sm font-semibold text-gray-500">
        ตั้งค่าเฉพาะของโปรแกรมตรวจสุขภาพการเงิน
      </h2>

      {/* โลโก้โปรแกรม */}
      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
        <h2 className="text-lg font-bold text-gray-800">โลโก้โปรแกรม</h2>
        <p className="mt-1 text-sm text-gray-600">
          ขึ้นที่หน้าแรกของโปรแกรมก่อนกดเริ่มตรวจ — ไม่ใส่ก็ได้ ระบบจะใช้ไอคอนกระเป๋าเงินแทน
        </p>

        <div className="mt-4 flex items-center gap-4">
          <div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-2xl bg-gray-50 ring-1 ring-gray-200">
            {logo ? (
              // รูปมาจากหลังบ้าน ไม่รู้ขนาดล่วงหน้า จึงใช้ <img> ธรรมดา
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="" className="h-full w-full object-contain" />
            ) : (
              <ImagePlus className="h-6 w-6 text-gray-300" />
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="cursor-pointer rounded-lg bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700 transition hover:bg-brand-100">
              {busyId === "__logo" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : logo ? (
                "เปลี่ยนโลโก้"
              ) : (
                "อัปโลโก้"
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void uploadLogo(file);
                }}
              />
            </label>
            {logo && (
              <button
                type="button"
                onClick={() => {
                  setLogo("");
                  void send({ checkupLogo: "" });
                }}
                className="rounded-lg px-3 py-2 text-sm font-medium text-gray-400 transition hover:bg-red-50 hover:text-red-600"
              >
                เอาโลโก้ออก
              </button>
            )}
          </div>
        </div>

        {/* เครดิตกับเวอร์ชันอยู่ในโค้ด แก้ที่นี่ไม่ได้ — บอกไว้ให้รู้ว่าหน้าเว็บโชว์อะไรอยู่ */}
        <p className="mt-4 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
          ท้ายหน้าโปรแกรมแสดงว่า <b>{CHECKUP_CREDIT}</b> · เวอร์ชัน <b>{CHECKUP_VERSION}</b>{" "}
          — สองอย่างนี้กำหนดไว้ในโค้ด แก้จากหน้านี้ไม่ได้ (เวอร์ชันต้องตรงกับโค้ดจริงเสมอ)
        </p>
      </section>

      {/* ข้อความหน้าแรกของโปรแกรม */}
      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-bold text-gray-800">ข้อความหน้าแรกของโปรแกรม</h2>
          <button
            type="button"
            onClick={() => {
              if (confirm("ดึงข้อความชุดตั้งต้นกลับมาทับของที่แก้ไว้?")) setIntro(DEFAULT_INTRO);
            }}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-400 transition hover:text-gray-700"
          >
            <RotateCcw className="h-3.5 w-3.5" /> ใช้ข้อความชุดตั้งต้น
          </button>
        </div>
        <p className="mt-1 text-sm text-gray-600">
          ข้อความที่สมาชิกเห็นก่อนกดเริ่มตรวจ · พิมพ์{" "}
          <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">{COUNT_TOKEN}</code>{" "}
          ตรงไหน ระบบจะแทนที่ด้วยจำนวนคำถามจริงให้เอง (ตอนนี้ {questions.length} ข้อ)
          — <b>อย่าพิมพ์เลขเอง</b> ไม่งั้นวันที่เพิ่มหรือลบคำถาม ตัวเลขจะไม่ตรงกับของจริง
        </p>

        <label className="mt-4 block text-sm font-medium text-gray-700">
          หัวเรื่อง
          <textarea
            value={intro.heading}
            onChange={(e) => setIntro({ ...intro, heading: e.target.value })}
            rows={2}
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
          />
        </label>

        <label className="mt-3 block text-sm font-medium text-gray-700">
          ย่อหน้าแรก
          <textarea
            value={intro.lead}
            onChange={(e) => setIntro({ ...intro, lead: e.target.value })}
            rows={3}
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
          />
        </label>

        <label className="mt-3 block text-sm font-medium text-gray-700">
          ย่อหน้าที่สอง <span className="font-normal text-gray-400">(เว้นว่างได้)</span>
          <textarea
            value={intro.detail}
            onChange={(e) => setIntro({ ...intro, detail: e.target.value })}
            rows={3}
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
          />
        </label>

        <p className="mt-4 text-sm font-medium text-gray-700">บรรทัดวิธีใช้ (ในกรอบสีเทา)</p>
        <ul className="mt-1.5 space-y-2">
          {intro.tips.map((tip, i) => (
            <li key={i} className="flex items-center gap-2">
              <input
                value={tip}
                onChange={(e) =>
                  setIntro({
                    ...intro,
                    tips: intro.tips.map((t, n) => (n === i ? e.target.value : t)),
                  })
                }
                className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-brand-400"
              />
              <button
                type="button"
                title="ลบบรรทัดนี้"
                onClick={() => setIntro({ ...intro, tips: intro.tips.filter((_, n) => n !== i) })}
                className="shrink-0 rounded p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setIntro({ ...intro, tips: [...intro.tips, ""] })}
          className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 transition hover:text-brand-800"
        >
          <Plus className="h-3.5 w-3.5" /> เพิ่มบรรทัด
        </button>

        {introDirty && (
          <button
            type="button"
            onClick={() => void saveIntro()}
            disabled={saving}
            className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white shadow transition hover:bg-brand-700 disabled:opacity-60"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            บันทึกข้อความ
          </button>
        )}
      </section>

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
          แก้ข้อความ เพิ่มข้อ ลบข้อ สลับลำดับ และเลือกหมวดได้เอง —{" "}
          <b>หมวดมีผลกับกราฟสรุปผลและคำแนะนำ</b> ส่วน <b>ช่วงเงิน</b> คือเพดานของสเกลที่เลื่อนได้ในข้อนั้น
        </p>

        {/*
          แถบหมวด — กดเพื่อดูเฉพาะหมวดนั้น · ตัวเลขคือจำนวนข้อในหมวด
          หมวดที่ยังไม่มีคำถามก็ต้องขึ้น (จาง ๆ) ไม่งั้นเจ้าหน้าที่จะไม่รู้ว่ามีหมวดนี้ให้เลือก
        */}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setOnly("all")}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              only === "all" ? "bg-gray-800 text-white shadow" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            ทั้งหมด <span className="tabular-nums opacity-70">{questions.length}</span>
          </button>
          {GROUPS.map((group) => {
            const tone = GROUP_TONE[group];
            const n = questions.filter((q) => q.group === group).length;
            const on = only === group;
            return (
              <button
                key={group}
                type="button"
                onClick={() => setOnly(on ? "all" : group)}
                title={GROUP_HINT[group]}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  on ? `${tone.bar} text-white shadow` : `${tone.bg} ${tone.text} hover:brightness-95`
                } ${n === 0 && !on ? "opacity-50" : ""}`}
              >
                {GROUP_LABEL[group]} <span className="tabular-nums opacity-70">{n}</span>
              </button>
            );
          })}
        </div>

        {only !== "all" && (
          <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
            กำลังดูเฉพาะหมวด <b>{GROUP_LABEL[only]}</b> — {GROUP_HINT[only]} ·
            เลขข้อยังเป็นลำดับจริงในแบบสอบถาม · <b>ปุ่มสลับลำดับกดได้ตอนดูทั้งหมด</b>
          </p>
        )}

        <ul className="mt-4 space-y-3">
          {questions.map((question, i) => {
            if (only !== "all" && question.group !== only) return null;
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
                      {/* ชื่อหมวดโชว์เป็นป้ายสีด้วย ไม่ใช่เห็นแค่ในช่องเลือก — กวาดตาหาง่ายกว่า */}
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold text-white ${tone.bar}`}
                      >
                        {GROUP_LABEL[question.group]}
                      </span>
                      <select
                        value={question.group}
                        onChange={(e) => patch(question.id, { group: e.target.value as CheckupGroup })}
                        aria-label="เปลี่ยนหมวด"
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
                      title={only === "all" ? "เลื่อนขึ้น" : "สลับลำดับได้ตอนดูทั้งหมด"}
                      disabled={only !== "all" || i === 0}
                      onClick={() => move(i, -1)}
                      className="rounded p-1 text-gray-400 transition hover:bg-white hover:text-gray-700 disabled:opacity-25"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      title={only === "all" ? "เลื่อนลง" : "สลับลำดับได้ตอนดูทั้งหมด"}
                      disabled={only !== "all" || i === questions.length - 1}
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

/* ------------------------------------------------------------------ *
 * ตัวเลือกอัตราดอกเบี้ยของโปรแกรมคำนวณดอกเบี้ย
 * ------------------------------------------------------------------ */

/**
 * ติ๊กว่าอัตราประเภทไหนให้ขึ้นเป็นปุ่มลัดในโปรแกรม — ใช้ตัวเดียวกันทั้งเงินกู้และเงินรับฝาก
 *
 * ⚠️ **หน้านี้แก้ตัวเลขอัตราไม่ได้** ตัวเลขอยู่ที่ หลังบ้าน → อัตราดอกเบี้ย ที่เดียว
 * ถ้าให้แก้ได้สองที่ เดี๋ยวตัวเลขบนหน้าแรกกับในโปรแกรมจะไม่ตรงกันโดยไม่มีใครรู้
 */
function RatePicker({
  title,
  hint,
  rows,
  hidden,
  dirty,
  saving,
  onToggle,
  onAll,
  onSave,
}: {
  title: string;
  hint: string;
  rows: RateRow[];
  hidden: string[];
  dirty: boolean;
  saving: boolean;
  onToggle: (name: string) => void;
  onAll: () => void;
  onSave: () => void;
}) {
  const shown = rows.filter((row) => !hidden.includes(row.label.trim()));

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold text-gray-800">{title}</h2>
        <span className="text-xs text-gray-400">
          ขึ้น {shown.length} จาก {rows.length} ประเภท
        </span>
      </div>
      <p className="mt-1 text-sm text-gray-600">
        {hint}
        <br />
        <b>ตัวเลขอัตราแก้ที่นี่ไม่ได้</b> ต้องไปแก้ที่ <b>หลังบ้าน → อัตราดอกเบี้ย</b>{" "}
        หน้านี้เลือกได้แค่ว่าจะให้ขึ้นหรือไม่ขึ้น
      </p>

      {rows.length === 0 ? (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          ยังไม่มีอัตราในระบบ — ไปเพิ่มที่ หลังบ้าน → อัตราดอกเบี้ย ก่อน แล้วรายการจะมาขึ้นที่นี่เอง
        </p>
      ) : (
        <>
          <ul className="mt-3 divide-y divide-gray-100 rounded-xl ring-1 ring-gray-200">
            {rows.map((row, index) => {
              const name = row.label.trim();
              const on = !hidden.includes(name);
              return (
                <li key={`${name}-${index}`}>
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 transition hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => onToggle(name)}
                      className="h-4 w-4 shrink-0 accent-brand-600"
                    />
                    <span className="min-w-0 flex-1 truncate text-sm text-gray-700">
                      {name || <span className="text-gray-400">(ไม่ได้ตั้งชื่อรายการ)</span>}
                    </span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-gray-800">
                      {row.rate}%
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!dirty || saving}
              onClick={onSave}
              className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white transition ${
                dirty && !saving ? "bg-brand-600 hover:bg-brand-700" : "cursor-not-allowed bg-gray-300"
              }`}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              บันทึกรายการที่เลือก
            </button>
            <button
              type="button"
              onClick={onAll}
              className="rounded-lg px-3 py-2 text-sm font-medium text-gray-500 transition hover:bg-gray-100"
            >
              เลือกทั้งหมด
            </button>
            {dirty && <span className="text-xs text-amber-700">ยังไม่ได้บันทึก</span>}
          </div>

          {/*
            เตือนเรื่องที่มองไม่เห็นจากหน้าจอ — เก็บเป็น "ชื่อรายการ" ไม่ใช่ลำดับ
            เปลี่ยนชื่อที่หน้าอัตราดอกเบี้ยเมื่อไหร่ การติ๊กปิดจะหลุด แล้วรายการนั้นกลับมาขึ้นเอง
          */}
          <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
            เพิ่มประเภทใหม่ที่หน้าอัตราดอกเบี้ย จะขึ้นในโปรแกรมเองทันทีโดยไม่ต้องมาติ๊กซ้ำ ·
            แต่ถ้า <b>เปลี่ยนชื่อรายการที่ติ๊กปิดไว้</b> รายการนั้นจะกลับมาขึ้นอีก ต้องมาติ๊กปิดใหม่
          </p>
        </>
      )}
    </section>
  );
}
