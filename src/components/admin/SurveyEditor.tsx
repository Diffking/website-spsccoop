"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  CalendarClock,
  Check,
  CircleStop,
  Copy,
  ExternalLink,
  Loader2,
  Play,
  Plus,
  RotateCcw,
  Save,
  Send,
  Trash2,
  Undo2,
  Users,
  X,
} from "lucide-react";
import ThaiDatePicker from "@/components/admin/ThaiDatePicker";
import SurveyItemCard, { type Locks } from "@/components/admin/SurveyItemCard";
import { STATUS_TONE } from "@/components/admin/SurveysList";
import {
  KIND_HINT,
  KIND_LABEL,
  STATUS_LABEL,
  blankItem,
  cloneItem,
  numberOf,
  validateItems,
  type ItemKind,
  type SurveyItem,
  type SurveyStatus,
} from "@/lib/survey";
import { joinThai, splitThai, thaiDateTime } from "@/lib/surveyTime";

export type SurveyEditorProps = {
  id: string;
  url: string;
  title: string;
  description: string;
  items: SurveyItem[];
  opensAt: string | null;
  closesAt: string | null;
  closedAt: string | null;
  status: SurveyStatus;
  responses: number;
  updatedAt: string;
};

/** ปุ่มเพิ่มข้อ — เรียงตามที่ใช้บ่อยในแบบประเมินความพึงพอใจ */
const ADD_KINDS: ItemKind[] = ["grid", "choice", "checkbox", "text", "paragraph", "scale", "dropdown", "date", "section"];

const input =
  "w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none transition focus:border-brand-400";

function AddBar({ onAdd, compact = false }: { onAdd: (kind: ItemKind) => void; compact?: boolean }) {
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${compact ? "" : "rounded-2xl border border-dashed border-gray-300 bg-white/60 p-3"}`}>
      <span className="mr-1 inline-flex items-center gap-1 text-xs text-gray-500">
        <Plus className="h-3.5 w-3.5" /> {compact ? "แทรกต่อจากข้อนี้:" : "เพิ่มข้อใหม่:"}
      </span>
      {ADD_KINDS.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => onAdd(k)}
          title={KIND_HINT[k]}
          className="rounded-full bg-white px-2.5 py-1 text-xs text-gray-700 ring-1 ring-gray-200 transition hover:bg-brand-50 hover:text-brand-700 hover:ring-brand-300"
        >
          {KIND_LABEL[k]}
        </button>
      ))}
    </div>
  );
}

/** ช่องวันที่ + เวลา (เวลาไทย) — ว่าง = ไม่กำหนด */
function WhenField({
  label,
  hint,
  value,
  onChange,
  defaultTime,
}: {
  label: string;
  hint: string;
  value: { date: string; time: string };
  onChange: (next: { date: string; time: string }) => void;
  defaultTime: string;
}) {
  return (
    <div>
      <span className="text-xs text-gray-500">{label}</span>
      <div className="mt-1 flex items-center gap-2">
        <ThaiDatePicker
          value={value.date}
          onChange={(date) => onChange({ date, time: value.time || defaultTime })}
          placeholder="ไม่กำหนด"
          className="min-w-0 flex-1"
        />
        <input
          type="time"
          value={value.time}
          disabled={!value.date}
          onChange={(e) => onChange({ ...value, time: e.target.value })}
          className="w-28 rounded-xl border border-gray-200 px-2 py-2 text-sm outline-none focus:border-brand-400 disabled:bg-gray-50"
        />
        {value.date && (
          <button
            type="button"
            onClick={() => onChange({ date: "", time: "" })}
            title="ไม่กำหนด"
            className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-red-500"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <p className="mt-1 text-[11px] text-gray-400">{hint}</p>
    </div>
  );
}

export default function SurveyEditor(props: SurveyEditorProps) {
  const router = useRouter();
  const [title, setTitle] = useState(props.title);
  const [description, setDescription] = useState(props.description);
  const [items, setItems] = useState<SurveyItem[]>(props.items);
  const [opens, setOpens] = useState(splitThai(props.opensAt));
  const [closes, setCloses] = useState(splitThai(props.closesAt));
  const [active, setActive] = useState<string | null>(null);
  const [base, setBase] = useState(props.updatedAt);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  /**
   * ของที่มีคนตอบไปแล้ว — ล็อกจาก "ของที่โหลดมา" ไม่ใช่ของที่แก้อยู่
   * ข้อที่เพิ่งเพิ่มในรอบนี้ยังไม่มีใครตอบ ลบได้ตามปกติ
   */
  const locks = useMemo<Locks>(() => {
    if (props.responses === 0) return { items: new Set(), parts: new Set() };
    const parts = new Set<string>();
    for (const item of props.items) {
      for (const o of [...item.options, ...item.rows, ...item.columns]) parts.add(o.id);
      if (item.allowOther) parts.add(`${item.id}:other`);
    }
    return { items: new Set(props.items.map((i) => i.id)), parts };
  }, [props.items, props.responses]);

  const payload = {
    title,
    description,
    questions: items,
    opensAt: joinThai(opens.date, opens.time, "00:00"),
    closesAt: joinThai(closes.date, closes.time, "23:59"),
  };
  const snapshot = JSON.stringify(payload);
  const [saved, setSaved] = useState(snapshot);
  const dirty = snapshot !== saved;

  // กันปิดแท็บทั้งที่ยังไม่ได้บันทึก — หลักเดียวกับหน้าเนื้อหา
  useEffect(() => {
    if (!busy && !dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy, dirty]);

  const published = props.status !== "draft";
  const liveProblems = validateItems(items);

  /** บันทึก + สั่งเปลี่ยนสถานะในคำขอเดียว — ไม่มีจังหวะที่บันทึกแล้วแต่สถานะยังไม่เปลี่ยน */
  async function send(key: string, extra: Record<string, unknown> = {}) {
    setBusy(key);
    setError(null);
    setProblems([]);
    setNotice(null);
    const response = await fetch(`/api/admin/surveys/${props.id}/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, baseUpdatedAt: base, ...extra }),
    });
    const data = await response.json().catch(() => ({}));
    setBusy(null);
    if (!response.ok) {
      setError(data.error ?? "บันทึกไม่สำเร็จ");
      setProblems(Array.isArray(data.problems) ? data.problems : []);
      return false;
    }
    setBase(data.updatedAt);
    setSaved(snapshot);
    router.refresh();
    return true;
  }

  async function save() {
    if (await send("save")) setNotice("บันทึกแล้ว");
  }

  async function publish() {
    if (!window.confirm("เผยแพร่แบบประเมินนี้?\n\nเมื่อถึงวันเริ่ม สมาชิกที่มีลิงก์จะเข้ามาตอบได้")) return;
    if (await send("publish", { action: "publish" })) setNotice("เผยแพร่แล้ว");
  }

  async function unpublish() {
    if (await send("unpublish", { action: "unpublish" })) setNotice("กลับเป็นร่างแล้ว");
  }

  async function close() {
    const ok = window.confirm(
      `สิ้นสุดการประเมิน "${title}"?\n\n` +
        "• สมาชิกจะตอบเพิ่มไม่ได้ทันที\n" +
        "• ระบบประเมินผลสรุปและเตรียมรายชื่อผู้มีสิทธิ์จับรางวัล\n" +
        "• เปิดรับต่อได้ภายหลัง ถ้าต้องการขยายเวลา",
    );
    if (!ok) return;
    if (await send("close", { action: "close" })) setNotice("สิ้นสุดการประเมินแล้ว");
  }

  async function reopen() {
    const until = closes.date ? `ถึง ${thaiDateTime(payload.closesAt)}` : "จนกว่าจะกดปิดอีกครั้ง";
    if (!window.confirm(`เปิดรับคำตอบต่อ ${until}?`)) return;
    if (await send("reopen", { action: "reopen" })) setNotice("เปิดรับต่อแล้ว");
  }

  async function remove() {
    if (!window.confirm(`ลบแบบประเมิน "${title}" ทิ้ง?\n\nลบแล้วกู้คืนไม่ได้`)) return;
    setBusy("delete");
    const response = await fetch(`/api/admin/surveys/${props.id}/`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setBusy(null);
      setError(data.error ?? "ลบไม่สำเร็จ");
      return;
    }
    // ลบเสร็จไม่มีอะไรค้างให้เตือนแล้ว — ล้างก่อนย้ายหน้า ไม่งั้น beforeunload ถามซ้ำ
    setSaved(snapshot);
    router.push("/admin/surveys/");
  }

  async function copyLink() {
    await navigator.clipboard.writeText(props.url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  /* ---------- จัดการรายการข้อ ---------- */
  function insertAt(index: number, item: SurveyItem) {
    setItems((list) => [...list.slice(0, index), item, ...list.slice(index)]);
    setActive(item.id);
  }
  const update = (id: string, next: SurveyItem) => setItems((list) => list.map((i) => (i.id === id ? next : i)));
  const move = (index: number, by: number) =>
    setItems((list) => {
      const j = index + by;
      if (j < 0 || j >= list.length) return list;
      const next = [...list];
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  const removeItem = (id: string) => {
    const item = items.find((i) => i.id === id);
    const hasContent = item && (item.title || item.options.some((o) => o.label) || item.rows.length > 1);
    if (hasContent && !window.confirm(`ลบ "${item.title || KIND_LABEL[item.kind]}"?`)) return;
    setItems((list) => list.filter((i) => i.id !== id));
    setActive(null);
  };

  const shownCount = items.filter((i) => i.kind !== "section" && !i.hidden).length;

  return (
    <div className="space-y-4 pb-24">
      <Link href="/admin/surveys/" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-700">
        <ArrowLeft className="h-4 w-4" /> แบบประเมินทั้งหมด
      </Link>

      {/* ---------- หัว: ชื่อ · สถานะ · ลิงก์ ---------- */}
      <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
        <div className="h-2 bg-linear-to-r from-brand-600 to-sky-400" />
        <div className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_TONE[props.status]}`}>
              {STATUS_LABEL[props.status]}
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-gray-500">
              <Users className="h-3.5 w-3.5" /> ผู้ตอบ {props.responses.toLocaleString("th-TH")} คน
            </span>
            <span className="text-xs text-gray-400">· {shownCount} ข้อ</span>
            {props.closedAt && (
              <span className="text-xs text-gray-500">· กดปิดเมื่อ {thaiDateTime(props.closedAt)}</span>
            )}
          </div>

          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="ชื่อแบบประเมิน"
            className="w-full border-b border-gray-200 pb-1 text-xl font-bold text-gray-800 outline-none transition focus:border-brand-400"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="คำอธิบายที่สมาชิกเห็นด้านบนแบบประเมิน (เว้นว่างได้)"
            className={`${input} resize-y`}
          />

          {/* ลิงก์ที่แจกให้สมาชิก — www.spsccoop.com เปิดได้ตลอด 24 ชม. · QR มาในเฟสถัดไป */}
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-gray-50 px-3 py-2">
            <span className="text-xs text-gray-500">ลิงก์สำหรับสมาชิก</span>
            <code className="min-w-0 flex-1 truncate text-sm text-brand-700">{props.url}</code>
            <button
              type="button"
              onClick={copyLink}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-gray-600 ring-1 ring-gray-200 transition hover:bg-white hover:text-brand-700"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "คัดลอกแล้ว" : "คัดลอก"}
            </button>
          </div>
          {!published && (
            <p className="text-[11px] text-gray-400">
              ยังเป็นร่าง — ลิงก์นี้ยังเปิดไม่ได้จนกว่าจะกดเผยแพร่ (หน้าตอบสำหรับสมาชิกมาในเฟสถัดไป)
            </p>
          )}
        </div>
      </section>

      {/* ---------- ช่วงเปิดรับ + ปุ่มสถานะ ---------- */}
      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <h2 className="flex items-center gap-2 font-semibold text-gray-800">
          <CalendarClock className="h-5 w-5 text-brand-600" /> ช่วงเวลาเปิดรับ
        </h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <WhenField
            label="วันเริ่ม"
            hint="ไม่กำหนด = เปิดทันทีที่เผยแพร่"
            value={opens}
            onChange={setOpens}
            defaultTime="08:30"
          />
          <WhenField
            label="วันสิ้นสุด"
            hint="ไม่กำหนด = เปิดจนกว่าจะกดปุ่ม “สิ้นสุดการประเมิน”"
            value={closes}
            onChange={setCloses}
            defaultTime="23:59"
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
          {props.status === "draft" && (
            <button
              onClick={publish}
              disabled={busy !== null}
              className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-emerald-700 disabled:opacity-60"
            >
              {busy === "publish" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              บันทึกและเผยแพร่
            </button>
          )}
          {(props.status === "open" || props.status === "scheduled") && (
            <button
              onClick={close}
              disabled={busy !== null}
              className="inline-flex items-center gap-1.5 rounded-full bg-slate-800 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-slate-900 disabled:opacity-60"
            >
              {busy === "close" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CircleStop className="h-4 w-4" />}
              สิ้นสุดการประเมิน
            </button>
          )}
          {props.status === "closed" && (
            <button
              onClick={reopen}
              disabled={busy !== null}
              className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-emerald-700 disabled:opacity-60"
            >
              {busy === "reopen" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              เปิดรับต่อ (ขยายเวลา)
            </button>
          )}
          {published && props.responses === 0 && (
            <button
              onClick={unpublish}
              disabled={busy !== null}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm text-gray-600 ring-1 ring-gray-200 transition hover:bg-gray-50 disabled:opacity-60"
            >
              {busy === "unpublish" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
              กลับเป็นร่าง
            </button>
          )}
          {props.responses === 0 && (
            <button
              onClick={remove}
              disabled={busy !== null}
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-red-600 transition hover:bg-red-50 disabled:opacity-60"
            >
              <Trash2 className="h-4 w-4" /> ลบแบบประเมิน
            </button>
          )}
        </div>
        {props.status === "closed" && (
          <p className="mt-2 text-xs text-gray-500">
            <RotateCcw className="mr-1 inline h-3.5 w-3.5" />
            จะขยายเวลา: ตั้ง &quot;วันสิ้นสุด&quot; ใหม่ด้านบน (หรือกด ✕ ให้เป็นไม่กำหนด) แล้วกด &quot;เปิดรับต่อ&quot;
          </p>
        )}

        {/* ปัญหาที่ทำให้เผยแพร่ไม่ได้ — โชว์ล่วงหน้า ไม่ต้องรอกดแล้วโดนปฏิเสธ */}
        {(props.status === "draft" || dirty) && liveProblems.length > 0 && (
          <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200">
            <p className="font-semibold">ต้องแก้ก่อน{published ? "บันทึก" : "เผยแพร่"} ({liveProblems.length})</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {liveProblems.slice(0, 8).map((p) => (
                <li key={p}>{p}</li>
              ))}
              {liveProblems.length > 8 && <li>และอีก {liveProblems.length - 8} ข้อ</li>}
            </ul>
          </div>
        )}
      </section>

      {/* ---------- รายการคำถาม ---------- */}
      {props.responses > 0 && (
        <p className="rounded-xl bg-sky-50 px-3 py-2 text-xs text-sky-800 ring-1 ring-sky-200">
          มีคนตอบแล้ว — แก้ถ้อยคำ สลับลำดับ และเพิ่มข้อ/ตัวเลือกใหม่ได้ แต่ลบหรือเปลี่ยนชนิดข้อเดิมไม่ได้
          (คำตอบที่เก็บไว้จะชี้ไปของที่ไม่มีอยู่) ถ้าไม่อยากให้ข้อไหนขึ้นแล้ว ให้ติ๊ก &quot;ซ่อนข้อนี้&quot;
        </p>
      )}

      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={item.id} className="space-y-2">
            <SurveyItemCard
              item={item}
              number={numberOf(items, item.id)}
              active={active === item.id}
              locks={locks}
              first={index === 0}
              last={index === items.length - 1}
              onActivate={() => setActive(item.id)}
              onChange={(next) => update(item.id, next)}
              onMove={(by) => move(index, by)}
              onDuplicate={() => insertAt(index + 1, cloneItem(item))}
              onRemove={() => removeItem(item.id)}
            />
            {active === item.id && (
              <div className="pl-2">
                <AddBar compact onAdd={(kind) => insertAt(index + 1, blankItem(kind))} />
              </div>
            )}
          </div>
        ))}
        <AddBar onAdd={(kind) => insertAt(items.length, blankItem(kind))} />
      </div>

      {/* ---------- ปุ่มบันทึก + ผลลัพธ์ ---------- */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={save}
          disabled={busy !== null}
          className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-brand-700 disabled:opacity-60"
        >
          {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          บันทึก
        </button>
        {notice && !dirty && (
          <span className="inline-flex items-center gap-1 text-sm text-emerald-600">
            <Check className="h-4 w-4" /> {notice}
          </span>
        )}
        {props.status !== "draft" && (
          <a
            href={props.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-700"
          >
            <ExternalLink className="h-4 w-4" /> เปิดลิงก์
          </a>
        )}
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
          <p className="flex items-start gap-1.5">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
          </p>
          {problems.length > 1 && (
            <ul className="mt-1 list-disc space-y-0.5 pl-9 text-xs">
              {problems.slice(1, 8).map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/*
        แถบติดล่างจอ — หน้านี้ต้องกดบันทึกเอง (ไม่ได้บันทึกให้ทุกครั้งที่พิมพ์)
        แบบประเมินยาว ๆ ปุ่มบันทึกอยู่ล่างสุดจนมองไม่เห็น ต้องเตือนให้เห็นชัด
      */}
      {dirty && (
        <div className="sticky bottom-3 z-30 flex flex-wrap items-center gap-3 rounded-xl bg-gray-900/95 px-4 py-3 text-sm text-white shadow-lg">
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-300" />
          <span className="min-w-0 flex-1">
            แก้ไว้แล้วแต่ <b>ยังไม่ได้บันทึก</b> — ปิดหน้านี้ตอนนี้สิ่งที่แก้จะหาย
          </span>
          <button
            onClick={save}
            disabled={busy !== null}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 font-medium text-white transition hover:bg-brand-400 disabled:opacity-60"
          >
            {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            บันทึกเลย
          </button>
        </div>
      )}
    </div>
  );
}
