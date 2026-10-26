"use client";

import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  Loader2,
  LogIn,
  Pencil,
  Send,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import ThaiDatePicker from "@/components/admin/ThaiDatePicker";
import { fadeSwap, STACKED } from "@/lib/slideMotion";
import { HAS_OPTIONS, numberOf, type SurveyItem } from "@/lib/survey";
import {
  OTHER,
  answerable,
  checkAnswers,
  type Answer,
  type Answers,
  type CheckboxAnswer,
  type ChoiceAnswer,
  type GridAnswer,
} from "@/lib/surveyAnswers";

type Step = "identify" | "confirm" | "offline" | "answer" | "review" | "done" | "already";

/** ข้อมูลผู้ตอบที่โชว์ให้ยืนยัน — ปิดบังบางส่วนมาจากเซิร์ฟเวอร์แล้ว (ดู identify/route.ts) */
type Who = { name: string; membNo: string; department: string };

/**
 * ยิงคำขอแล้วอ่านผล — ทนกรณีที่ไม่ได้ JSON กลับมา
 *
 * offline = ยืนยันตัวตนสดไม่ได้ ต้องเปลี่ยนเป็นโหมด "ฝากคำตอบ ตรวจทีหลัง"
 *   · หลังบ้านบอกมาเอง (ฐานสมาชิกไม่พร้อม → { offline: true })
 *   · หรือไม่ได้ JSON กลับมาเลย — เครื่องสำนักงานปิด Worker ตอบหน้า error / ตัวกลางตอบเปล่า
 *     ตัวมิเรอร์ตอบ 204 เปล่า หรือ Cloudflare ตอบหน้า error (ดู php-frontend/index.php)
 *     ห้ามถือว่า "สำเร็จ" เด็ดขาด ไม่งั้นสมาชิกนึกว่าส่งแล้ว
 * ส่วนเน็ตของสมาชิกเองหลุด (fetch throw) ไม่ใช่ offline — ให้ลองใหม่ ไม่ใช่เปลี่ยนโหมด
 */
async function post(url: string, body: unknown) {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (!data) {
      return { ok: false, offline: true, status: response.status, data: {} as Record<string, unknown> };
    }
    return { ok: response.ok, offline: data.offline === true, status: response.status, data };
  } catch {
    return {
      ok: false,
      offline: false,
      status: 0,
      data: { error: "เชื่อมต่อไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่" } as Record<string, unknown>,
    };
  }
}

/** เบอร์มือถือ 10 หลัก หรือเลขที่สมาชิก — ตรงกับ readIdentifier() ฝั่งเซิร์ฟเวอร์ */
const idLooksOk = (v: string) => {
  const d = v.replace(/\D/g, "");
  return /^0[689]\d{8}$/.test(d) || /^\d{1,8}$/.test(d);
};

/** แบ่งเป็นหน้า ๆ ตามหัวตอน — เหมือน Google Form ที่กด "ถัดไป" ทีละตอน */
function paginate(items: SurveyItem[]): { head: SurveyItem | null; items: SurveyItem[] }[] {
  const pages: { head: SurveyItem | null; items: SurveyItem[] }[] = [];
  for (const item of items) {
    if (item.hidden) continue;
    if (item.kind === "section") pages.push({ head: item, items: [] });
    else {
      if (pages.length === 0) pages.push({ head: null, items: [] });
      pages[pages.length - 1].items.push(item);
    }
  }
  // หัวตอนที่ไม่มีคำถามตามมา (ตอนท้ายที่เป็นข้อความขอบคุณ) ไม่ต้องเป็นหน้าเปล่าให้กดผ่าน
  return pages.filter((p) => p.items.length > 0);
}

const box = "rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5";

/** บัตรผู้ตอบ — ใช้ทั้งขั้นยืนยันตัวตนและหน้าตรวจทานก่อนส่ง ให้เห็นหน้าตาเดียวกันสองที่ */
function WhoCard({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="divide-y divide-gray-100 rounded-xl bg-gray-50 px-4 text-left ring-1 ring-gray-100">
      {rows
        .filter(([, v]) => v)
        .map(([k, v]) => (
          <div key={k} className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-2 py-2.5 text-sm">
            <dt className="text-gray-500">{k}</dt>
            <dd className="font-semibold text-gray-800">{v}</dd>
          </div>
        ))}
    </dl>
  );
}

/* ------------------------------------------------------------ ชนิดคำถาม */

function OptionRow({
  type,
  checked,
  label,
  onSelect,
}: {
  type: "radio" | "checkbox";
  checked: boolean;
  label: React.ReactNode;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role={type}
      aria-checked={checked}
      onClick={onSelect}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[15px] ring-1 transition ${
        checked ? "bg-brand-50 text-brand-900 ring-brand-400" : "bg-white text-gray-700 ring-gray-200 hover:ring-brand-200"
      }`}
    >
      <span
        className={`grid h-5 w-5 shrink-0 place-items-center border-2 transition ${
          type === "checkbox" ? "rounded-md" : "rounded-full"
        } ${checked ? "border-brand-600 bg-brand-600" : "border-gray-300"}`}
      >
        {checked && <span className={`bg-white ${type === "checkbox" ? "h-2 w-2 rounded-sm" : "h-2 w-2 rounded-full"}`} />}
      </span>
      <span className="min-w-0 flex-1">{label}</span>
    </button>
  );
}

function OtherInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      placeholder="โปรดระบุ"
      maxLength={300}
      className="mt-1 w-full border-b border-gray-300 bg-transparent py-1 text-sm outline-none focus:border-brand-500"
    />
  );
}

function Question({
  item,
  value,
  onChange,
}: {
  item: SurveyItem;
  value: Answer | undefined;
  onChange: (v: Answer | undefined) => void;
}) {
  switch (item.kind) {
    case "text":
      return (
        <input
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value || undefined)}
          maxLength={500}
          placeholder="คำตอบของท่าน"
          className="w-full border-b-2 border-gray-200 bg-transparent py-2 text-[15px] outline-none transition focus:border-brand-500"
        />
      );
    case "paragraph":
      return (
        <textarea
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value || undefined)}
          maxLength={4000}
          rows={4}
          placeholder="คำตอบของท่าน"
          className="w-full resize-y rounded-xl border border-gray-200 px-3 py-2 text-[15px] outline-none transition focus:border-brand-500"
        />
      );
    case "date":
      return <ThaiDatePicker value={(value as string) ?? ""} onChange={(v) => onChange(v || undefined)} />;
    case "dropdown": {
      const v = (value as ChoiceAnswer | undefined)?.v ?? "";
      return (
        <select
          value={v}
          onChange={(e) => onChange(e.target.value ? { v: e.target.value } : undefined)}
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-[15px] outline-none focus:border-brand-500"
        >
          <option value="">— เลือก —</option>
          {item.options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      );
    }
    case "choice": {
      const a = value as ChoiceAnswer | undefined;
      return (
        <div className="space-y-2">
          {item.options.map((o) => (
            <OptionRow key={o.id} type="radio" checked={a?.v === o.id} label={o.label} onSelect={() => onChange({ v: o.id })} />
          ))}
          {item.allowOther && (
            <OptionRow
              type="radio"
              checked={a?.v === OTHER}
              onSelect={() => onChange({ v: OTHER, other: a?.other ?? "" })}
              label={
                <>
                  อื่น ๆ
                  {a?.v === OTHER && (
                    <OtherInput value={a.other ?? ""} onChange={(other) => onChange({ v: OTHER, other })} />
                  )}
                </>
              }
            />
          )}
        </div>
      );
    }
    case "checkbox": {
      const a = (value as CheckboxAnswer | undefined) ?? { v: [] };
      const toggle = (id: string) => {
        const v = a.v.includes(id) ? a.v.filter((x) => x !== id) : [...a.v, id];
        onChange(v.length ? { ...a, v } : undefined);
      };
      return (
        <div className="space-y-2">
          {item.options.map((o) => (
            <OptionRow key={o.id} type="checkbox" checked={a.v.includes(o.id)} label={o.label} onSelect={() => toggle(o.id)} />
          ))}
          {item.allowOther && (
            <OptionRow
              type="checkbox"
              checked={a.v.includes(OTHER)}
              onSelect={() => toggle(OTHER)}
              label={
                <>
                  อื่น ๆ
                  {a.v.includes(OTHER) && (
                    <OtherInput value={a.other ?? ""} onChange={(other) => onChange({ ...a, other })} />
                  )}
                </>
              }
            />
          )}
        </div>
      );
    }
    case "scale": {
      const nums = Array.from({ length: item.scaleMax - item.scaleMin + 1 }, (_, i) => item.scaleMin + i);
      return (
        <div>
          <div className="flex flex-wrap gap-2">
            {nums.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onChange(n)}
                className={`grid h-11 w-11 place-items-center rounded-full text-base font-semibold ring-1 transition ${
                  value === n ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-gray-700 ring-gray-200 hover:ring-brand-300"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          {(item.scaleMinLabel || item.scaleMaxLabel) && (
            <p className="mt-2 flex justify-between text-xs text-gray-500">
              <span>
                {item.scaleMin} = {item.scaleMinLabel}
              </span>
              <span>
                {item.scaleMax} = {item.scaleMaxLabel}
              </span>
            </p>
          )}
        </div>
      );
    }
    case "grid": {
      const a = (value as GridAnswer | undefined) ?? {};
      const scored = item.columns.filter((c) => !c.na);
      const na = item.columns.filter((c) => c.na);
      return (
        <div className="space-y-2.5">
          {item.rows.map((row, i) => (
            <div key={row.id} className={`rounded-xl p-3 ring-1 ${a[row.id] ? "bg-brand-50/40 ring-brand-100" : "bg-gray-50/60 ring-gray-100"}`}>
              <p className="text-[15px] text-gray-800">
                <span className="mr-1 text-gray-400">{i + 1}.</span>
                {row.label}
              </p>
              {/* ปุ่มคะแนนเรียงแถวเดียวเท่ากันทุกปุ่ม ตาไล่ซ้ายไปขวาได้ทันทีว่ามากไปน้อย */}
              <div className="mt-2 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${scored.length}, minmax(0, 1fr))` }}>
                {scored.map((c) => {
                  const on = a[row.id] === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => onChange({ ...a, [row.id]: c.id })}
                      title={c.label}
                      className={`flex min-w-0 flex-col items-center rounded-lg px-1 py-1.5 ring-1 transition ${
                        on ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-gray-700 ring-gray-200 hover:ring-brand-300"
                      }`}
                    >
                      <span className="text-base font-bold leading-none">{c.score}</span>
                      <span className={`mt-1 w-full truncate text-center text-[10px] leading-none ${on ? "text-white/90" : "text-gray-500"}`}>
                        {c.label}
                      </span>
                    </button>
                  );
                })}
              </div>
              {na.map((c) => {
                const on = a[row.id] === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onChange({ ...a, [row.id]: c.id })}
                    className={`mt-1.5 w-full rounded-lg px-2 py-1.5 text-xs ring-1 transition ${
                      on ? "bg-gray-700 text-white ring-gray-700" : "bg-white text-gray-500 ring-gray-200 hover:ring-gray-300"
                    }`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      );
    }
    default:
      return null;
  }
}

/* ---------------------------------------------------------------- หน้าจอ */

export default function SurveyForm({
  code,
  title,
  description,
  items,
  preview = false,
}: {
  code: string;
  title: string;
  description: string;
  items: SurveyItem[];
  /** ตัวอย่างในหลังบ้าน — ข้ามขั้นยืนยันตัวตน และส่งจริงไม่ได้ */
  preview?: boolean;
}) {
  const pages = useMemo(() => paginate(items), [items]);
  const [step, setStep] = useState<Step>(preview ? "answer" : "identify");
  const [idText, setIdText] = useState("");
  const [name, setName] = useState("");
  const [who, setWho] = useState<Omit<Who, "name">>({ membNo: "", department: "" });
  const [token, setToken] = useState("");
  const [answeredAt, setAnsweredAt] = useState("");
  /** โหมดฝากคำตอบ — ระบบยืนยันตัวตนไม่พร้อม สมาชิกกรอกเบอร์ + ชื่อเอง แล้วตรวจกับฐานทีหลัง */
  const [offline, setOffline] = useState(false);
  const [claimedName, setClaimedName] = useState("");
  /** เปลี่ยนโหมดตอนกดส่ง (ระบบล่มกลางทาง) — คำตอบกรอกไว้ครบแล้ว กรอกเบอร์+ชื่อแล้วส่งได้เลย */
  const [answersReady, setAnswersReady] = useState(false);
  const [queued, setQueued] = useState(false);
  const [answers, setAnswers] = useState<Answers>({});
  const [page, setPage] = useState(0);
  const [missing, setMissing] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  const scrollTop = () => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  async function identify() {
    setBusy(true);
    setError(null);
    const r = await post(`/api/survey/${code}/identify/`, { id: idText });
    setBusy(false);
    if (r.offline) {
      setOffline(true);
      setStep("offline");
      return;
    }
    if (!r.ok) {
      setError(String(r.data.error ?? "ยืนยันตัวตนไม่สำเร็จ"));
      return;
    }
    setName(String(r.data.name ?? ""));
    if (r.data.already) {
      setAnsweredAt(String(r.data.at ?? ""));
      setStep("already");
      return;
    }
    setWho({ membNo: String(r.data.membNo ?? ""), department: String(r.data.department ?? "") });
    setToken(String(r.data.token ?? ""));
    setStep("confirm");
  }

  function notMe() {
    setToken("");
    setName("");
    setWho({ membNo: "", department: "" });
    setIdText("");
    setStep("identify");
  }

  const setAnswer = (id: string, v: Answer | undefined) => {
    setAnswers((prev) => {
      const next = { ...prev };
      if (v === undefined) delete next[id];
      else next[id] = v;
      return next;
    });
    setMissing((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  /** ข้อบังคับในหน้านี้ที่ยังไม่ครบ — ใช้ตัวตรวจตัวเดียวกับเซิร์ฟเวอร์ */
  function missingOn(index: number): string[] {
    const ids = new Set(pages[index].items.map((i) => i.id));
    return checkAnswers(items, answers).missing.filter((id) => ids.has(id));
  }

  function jumpToFirst(ids: string[]) {
    setMissing(new Set(ids));
    setError(`ยังตอบไม่ครบ ${ids.length} ข้อ — ข้อที่ต้องตอบมีกรอบสีแดง`);
    setTimeout(() => document.getElementById(`q-${ids[0]}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  }

  function next() {
    const miss = missingOn(page);
    if (miss.length) return jumpToFirst(miss);
    setError(null);
    setPage((p) => p + 1);
    scrollTop();
  }

  function back() {
    setError(null);
    setPage((p) => Math.max(0, p - 1));
    scrollTop();
  }

  /** หน้าสุดท้ายตอบครบแล้ว → หน้าตรวจทาน (ข้อมูลผู้ตอบ + ตอบไปแล้วกี่ข้อ) ก่อนกดส่งจริง */
  function review() {
    const miss = missingOn(page);
    if (miss.length) return jumpToFirst(miss);
    setError(null);
    setStep("review");
    scrollTop();
  }

  function editPage(index: number) {
    setError(null);
    setPage(index);
    setStep("answer");
    scrollTop();
  }

  async function submit() {
    // ตรวจทั้งชุดอีกรอบ — กันกรณีกลับไปแก้แล้วลบคำตอบข้อบังคับทิ้งในหน้าอื่น
    const miss = checkAnswers(items, answers).missing;
    if (miss.length) {
      const at = pages.findIndex((p) => p.items.some((i) => miss.includes(i.id)));
      if (at >= 0) setPage(at);
      setStep("answer");
      return jumpToFirst(miss);
    }
    if (preview) {
      setError("นี่คือหน้าตัวอย่าง — ส่งจริงไม่ได้");
      return;
    }
    if (offline) return submitQueued();
    setBusy(true);
    setError(null);
    const r = await post(`/api/survey/${code}/submit/`, { token, answers });
    setBusy(false);
    if (r.offline) {
      // ระบบล่มระหว่างทำ — คำตอบยังอยู่ครบ ขอเบอร์ + ชื่อแล้วฝากไว้แทน
      setOffline(true);
      setAnswersReady(true);
      setStep("offline");
      scrollTop();
      return;
    }
    if (r.ok) {
      setStep("done");
      scrollTop();
      return;
    }
    if (r.data.already) {
      setStep("already");
      return;
    }
    if (r.data.restart) {
      // บัตรผ่านหมดอายุ — คำตอบที่กรอกไว้ยังอยู่ใน state ยืนยันตัวตนใหม่แล้วส่งต่อได้เลย
      // (กด "ใช่" แล้วกลับมาหน้าสุดท้าย → "ตรวจทานก่อนส่ง" อีกครั้ง)
      setPage(pages.length - 1);
      setToken("");
      setStep("identify");
      setError(String(r.data.error));
      return;
    }
    const serverMiss = Array.isArray(r.data.missing) ? (r.data.missing as string[]) : [];
    if (serverMiss.length) {
      const at = pages.findIndex((p) => p.items.some((i) => serverMiss.includes(i.id)));
      if (at >= 0) setPage(at);
      setStep("answer");
      return jumpToFirst(serverMiss);
    }
    setError(String(r.data.error ?? "ส่งคำตอบไม่สำเร็จ"));
  }

  /**
   * ฝากคำตอบ — ไปที่ /queue/ · เครื่องสำนักงานปิดอยู่ โฮสต์จะพักไว้ให้แล้วตอบ { queued: true }
   * ได้ JSON ที่ไม่ ok หรือไม่ได้ JSON เลย = ยังไม่ถูกเก็บที่ไหน ต้องบอกให้ลองใหม่
   */
  async function submitQueued() {
    setBusy(true);
    setError(null);
    const r = await post(`/api/survey/${code}/queue/`, { phone: idText, name: claimedName, answers });
    setBusy(false);
    if (r.ok) {
      setQueued(true);
      setName("");
      setStep("done");
      scrollTop();
      return;
    }
    const serverMiss = Array.isArray(r.data.missing) ? (r.data.missing as string[]) : [];
    if (serverMiss.length) {
      setStep("answer");
      const at = pages.findIndex((p) => p.items.some((i) => serverMiss.includes(i.id)));
      if (at >= 0) setPage(at);
      return jumpToFirst(serverMiss);
    }
    setError(String(r.data.error ?? "ส่งคำตอบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"));
  }

  const offlineReady = idLooksOk(idText) && claimedName.trim().length >= 3;

  const current = pages[page];
  const last = page === pages.length - 1;
  const totalQuestions = items.filter(answerable).length;

  return (
    <div ref={topRef} className="scroll-mt-4 space-y-4">
      {/* ---------- หัวแบบประเมิน — เห็นทุกขั้น ---------- */}
      <header className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
        <div className="h-2 bg-linear-to-r from-brand-600 to-sky-400" />
        <div className="p-5">
          {preview && (
            <p className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
              <Eye className="h-3.5 w-3.5" /> ตัวอย่างสำหรับเจ้าหน้าที่ — สมาชิกจะเห็นหน้าตาแบบนี้
            </p>
          )}
          <h1 className="text-xl font-bold leading-snug text-brand-900 sm:text-2xl">{title}</h1>
          {description && <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-gray-600">{description}</p>}
          <p className="mt-3 text-xs text-gray-400">{totalQuestions} ข้อ · ตอบได้ท่านละ 1 ครั้ง</p>
        </div>
      </header>

      {/* ของเก่ากับของใหม่ซ้อนในช่องกริดเดียวกันตอนจางสลับ — ไม่มีวูบว่าง (ห้าม mode="wait") */}
      <div className="grid">
      <AnimatePresence initial={false}>
        <motion.div key={step === "answer" ? `answer-${page}` : step} {...fadeSwap(0.5)} style={STACKED} className="min-w-0">
          {/* ---------- ยืนยันตัวตน ---------- */}
          {step === "identify" && (
            <section className={box}>
              <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-800">
                <ShieldCheck className="h-5 w-5 text-brand-600" /> ยืนยันตัวตนสมาชิก
              </h2>
              <p className="mt-1 text-sm text-gray-500">ใส่เบอร์มือถือที่ให้ไว้กับสหกรณ์ หรือเลขที่สมาชิก</p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!busy && idText.trim()) identify();
                }}
                className="mt-4 space-y-3"
              >
                <input
                  value={idText}
                  onChange={(e) => setIdText(e.target.value)}
                  inputMode="numeric"
                  autoComplete="tel"
                  placeholder="เช่น 0812345678 หรือ 07337"
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-center text-lg tracking-wider outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                />
                <button
                  type="submit"
                  disabled={busy || !idText.trim()}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 font-semibold text-white shadow transition hover:bg-brand-700 disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />}
                  ตรวจสอบ
                </button>
              </form>
              <p className="mt-4 rounded-xl bg-gray-50 px-3 py-2 text-[11px] leading-relaxed text-gray-500">
                สหกรณ์ใช้ข้อมูลนี้เพื่อยืนยันว่าท่านเป็นสมาชิก ประเมินผลความพึงพอใจ และจับรางวัลสำหรับผู้ตอบแบบประเมินเท่านั้น
              </p>
            </section>
          )}

          {/* ---------- ยืนยันชื่อ ---------- */}
          {step === "confirm" && (
            <section className={`${box} text-center`}>
              <UserCheck className="mx-auto h-10 w-10 text-brand-600" />
              <p className="mt-3 text-sm text-gray-500">พบข้อมูลสมาชิก</p>
              <p className="mt-1 text-2xl font-bold text-gray-800">{name}</p>
              <div className="mt-4">
                <WhoCard
                  rows={[
                    ["เลขที่สมาชิก", who.membNo],
                    ["หน่วยงาน", who.department],
                  ]}
                />
              </div>
              <p className="mt-3 text-sm text-gray-500">ใช่ท่านหรือไม่</p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={notMe}
                  className="rounded-xl px-4 py-3 text-sm font-medium text-gray-600 ring-1 ring-gray-200 transition hover:bg-gray-50"
                >
                  ไม่ใช่
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setStep("answer");
                  }}
                  className="rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow transition hover:bg-brand-700"
                >
                  ใช่ เริ่มทำแบบประเมิน
                </button>
              </div>
            </section>
          )}

          {/* ---------- โหมดฝากคำตอบ: กรอกเบอร์ + ชื่อเอง ตรวจกับทะเบียนทีหลัง ---------- */}
          {step === "offline" && (
            <section className={box}>
              <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-800">
                <ShieldCheck className="h-5 w-5 text-amber-500" /> กรอกข้อมูลผู้ตอบ
              </h2>
              <p className="mt-1 rounded-xl bg-amber-50 px-3 py-2 text-sm leading-relaxed text-amber-800 ring-1 ring-amber-200">
                ขณะนี้ระบบตรวจสอบทะเบียนสมาชิกยังไม่พร้อม ท่าน{answersReady ? "ส่ง" : "ตอบ"}แบบประเมินได้ตามปกติ ·
                สหกรณ์จะตรวจสอบข้อมูลกับทะเบียนสมาชิกอีกครั้งเมื่อระบบพร้อม
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!offlineReady || busy) return;
                  // ตอบครบแล้ว (ระบบล่มตอนกดส่ง หรือกลับมาแก้ชื่อจากหน้าตรวจทาน) → กลับหน้าตรวจทาน
                  setError(null);
                  setStep(answersReady ? "review" : "answer");
                  scrollTop();
                }}
                className="mt-4 space-y-3"
              >
                <label className="block">
                  <span className="text-sm text-gray-600">เบอร์มือถือที่ให้ไว้กับสหกรณ์ (หรือเลขที่สมาชิก)</span>
                  <input
                    value={idText}
                    onChange={(e) => setIdText(e.target.value)}
                    inputMode="numeric"
                    autoComplete="tel"
                    placeholder="เช่น 0812345678"
                    className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 text-lg tracking-wider outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                  />
                </label>
                <label className="block">
                  <span className="text-sm text-gray-600">ชื่อ-สกุล (ตามที่ให้ไว้กับสหกรณ์)</span>
                  <input
                    value={claimedName}
                    onChange={(e) => setClaimedName(e.target.value)}
                    autoComplete="name"
                    maxLength={200}
                    placeholder="เช่น นางสาวสมใจ ใจดี"
                    className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 text-lg outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                  />
                </label>
                <button
                  type="submit"
                  disabled={busy || !offlineReady}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 font-semibold text-white shadow transition hover:bg-brand-700 disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowRight className="h-5 w-5" />}
                  {answersReady ? "ตรวจทานก่อนส่ง" : "เริ่มทำแบบประเมิน"}
                </button>
              </form>
              <p className="mt-4 rounded-xl bg-gray-50 px-3 py-2 text-[11px] leading-relaxed text-gray-500">
                ข้อมูลต้องตรงกับทะเบียนสมาชิก จึงจะนับเป็นผู้ตอบแบบประเมินและมีสิทธิ์จับรางวัล ·
                สหกรณ์ใช้ข้อมูลนี้เพื่อยืนยันตัวตน ประเมินผล และจับรางวัลเท่านั้น
              </p>
            </section>
          )}

          {/* ---------- ตอบคำถามทีละตอน ---------- */}
          {step === "answer" && current && (
            <div className="space-y-3">
              {pages.length > 1 && (
                <div className="flex items-center gap-3 px-1">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-200">
                    <div
                      className="h-full rounded-full bg-brand-500 transition-all"
                      style={{ width: `${((page + 1) / pages.length) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500">
                    ตอน {page + 1}/{pages.length}
                  </span>
                </div>
              )}

              {current.head && (
                <section className="rounded-2xl bg-brand-700 px-5 py-4 text-white shadow-sm">
                  <h2 className="text-lg font-bold">{current.head.title}</h2>
                  {current.head.description && <p className="mt-1 text-sm text-white/80">{current.head.description}</p>}
                </section>
              )}

              {current.items.map((item) => {
                const bad = missing.has(item.id);
                return (
                  <section
                    key={item.id}
                    id={`q-${item.id}`}
                    className={`${box} scroll-mt-6 ${bad ? "ring-2 ring-red-400" : ""}`}
                  >
                    <p className="text-[15px] font-semibold leading-snug text-gray-800">
                      <span className="mr-1 text-brand-600">{numberOf(items, item.id)}.</span>
                      {item.title}
                      {item.required && <span className="ml-1 text-red-500">*</span>}
                    </p>
                    {item.description && <p className="mt-1 text-xs text-gray-500">{item.description}</p>}
                    {HAS_OPTIONS.includes(item.kind) && item.kind === "checkbox" && (
                      <p className="mt-1 text-xs text-gray-400">เลือกได้มากกว่า 1 ข้อ</p>
                    )}
                    <div className="mt-3">
                      <Question item={item} value={answers[item.id]} onChange={(v) => setAnswer(item.id, v)} />
                    </div>
                    {bad && <p className="mt-2 text-xs font-medium text-red-500">ข้อนี้ต้องตอบ{item.kind === "grid" ? "ให้ครบทุกหัวข้อ" : ""}</p>}
                  </section>
                );
              })}

              <div className="flex items-center gap-3 pt-1">
                {page > 0 && (
                  <button
                    type="button"
                    onClick={back}
                    className="inline-flex items-center gap-1.5 rounded-xl px-4 py-3 text-sm font-medium text-gray-600 ring-1 ring-gray-200 transition hover:bg-white"
                  >
                    <ArrowLeft className="h-4 w-4" /> ย้อนกลับ
                  </button>
                )}
                {last ? (
                  <button
                    type="button"
                    onClick={review}
                    className="ml-auto inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white shadow transition hover:bg-brand-700"
                  >
                    ตรวจทานก่อนส่ง <ArrowRight className="h-5 w-5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={next}
                    className="ml-auto inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white shadow transition hover:bg-brand-700"
                  >
                    ถัดไป <ArrowRight className="h-5 w-5" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ---------- ตรวจทานก่อนส่ง: ใครเป็นคนตอบ + ตอบครบแต่ละตอนไหม ---------- */}
          {step === "review" && (
            <div className="space-y-3">
              <section className={box}>
                <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-800">
                  <ClipboardCheck className="h-5 w-5 text-brand-600" /> ตรวจทานก่อนส่ง
                </h2>
                <p className="mt-1 text-sm text-gray-500">ข้อมูลผู้ตอบแบบประเมิน</p>
                <div className="mt-3">
                  <WhoCard
                    rows={
                      offline
                        ? [
                            ["ชื่อ-สกุล", claimedName.trim()],
                            ["เบอร์ / เลขสมาชิก", idText.replace(/\D/g, "")],
                          ]
                        : [
                            ["ชื่อ-สกุล", preview ? "(ตัวอย่าง)" : name],
                            ["เลขที่สมาชิก", who.membNo],
                            ["หน่วยงาน", who.department],
                          ]
                    }
                  />
                </div>
                {offline && (
                  <p className="mt-2 text-xs leading-relaxed text-amber-700">
                    สหกรณ์จะตรวจข้อมูลนี้กับทะเบียนสมาชิกอีกครั้ง — พิมพ์ผิดแก้ได้ที่ปุ่มด้านล่าง
                  </p>
                )}
                {offline && (
                  <button
                    type="button"
                    onClick={() => {
                      setAnswersReady(true);
                      setStep("offline");
                      scrollTop();
                    }}
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 hover:underline"
                  >
                    <Pencil className="h-3.5 w-3.5" /> แก้ข้อมูลผู้ตอบ
                  </button>
                )}
              </section>

              <section className={box}>
                <p className="text-sm text-gray-500">คำตอบของท่าน</p>
                <ul className="mt-2 grid grid-cols-1 divide-y divide-gray-100">
                  {pages.map((p, i) => {
                    const qs = p.items.filter(answerable);
                    const done = qs.filter((q) => answers[q.id] !== undefined).length;
                    return (
                      <li key={p.head?.id ?? i} className="flex min-w-0 items-center gap-3 py-2.5">
                        <CheckCircle2
                          className={`h-5 w-5 shrink-0 ${done === qs.length ? "text-emerald-500" : "text-gray-300"}`}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-gray-800">
                            {p.head?.title ?? `ตอนที่ ${i + 1}`}
                          </p>
                          <p className="text-xs text-gray-500">
                            ตอบ {done}/{qs.length} ข้อ
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => editPage(i)}
                          className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-brand-700 ring-1 ring-brand-200 transition hover:bg-brand-50"
                        >
                          <Pencil className="h-3.5 w-3.5" /> แก้ไข
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => editPage(pages.length - 1)}
                  className="inline-flex items-center gap-1.5 rounded-xl px-4 py-3 text-sm font-medium text-gray-600 ring-1 ring-gray-200 transition hover:bg-white"
                >
                  <ArrowLeft className="h-4 w-4" /> ย้อนกลับ
                </button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={busy}
                  className="ml-auto inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 font-semibold text-white shadow transition hover:bg-emerald-700 disabled:opacity-60"
                >
                  {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                  ยืนยันส่งคำตอบ
                </button>
              </div>
            </div>
          )}

          {/* ---------- เสร็จ / เคยตอบแล้ว ---------- */}
          {(step === "done" || step === "already") && (
            <section className={`${box} py-10 text-center`}>
              <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" />
              <h2 className="mt-3 text-xl font-bold text-gray-800">
                {step === "done" ? "ส่งคำตอบเรียบร้อยแล้ว" : "ท่านตอบแบบประเมินนี้แล้ว"}
              </h2>
              <p className="mt-2 text-sm text-gray-500">
                {name && <>{name} · </>}
                {step === "done" ? "ขอบคุณที่สละเวลาให้ความคิดเห็นกับสหกรณ์" : `ตอบไว้เมื่อ ${answeredAt}`}
              </p>
              {queued && (
                <p className="mx-auto mt-3 max-w-sm rounded-xl bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
                  สหกรณ์ได้รับคำตอบแล้ว และจะตรวจสอบชื่อกับทะเบียนสมาชิกอีกครั้งเมื่อระบบพร้อม
                </p>
              )}
              <p className="mt-1 text-xs text-gray-400">ตอบได้ท่านละ 1 ครั้ง</p>
            </section>
          )}
        </motion.div>
      </AnimatePresence>
      </div>

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </p>
      )}
    </div>
  );
}
