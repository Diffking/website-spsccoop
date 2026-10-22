"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Check,
  Copy,
  Filter,
  Link2,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import ThaiDatePicker from "@/components/admin/ThaiDatePicker";
import { FeedbackSummaryList, type FeedbackGroup } from "@/components/admin/SurveyCharts";
import { joinThai, splitThai, thaiDateTime } from "@/lib/surveyTime";

type Dim = { key: string; label: string; values: { value: string; label: string }[] };

/* ------------------------------------------------------------ ตัวกรอง */

/**
 * ตัวกรองแถวเดียวเหนือกราฟ — เปลี่ยนแล้วหน้าคิดใหม่ทั้งหน้า (เก็บใน URL ?f.<มิติ>=ค่า)
 * แชร์ลิงก์ที่กรองไว้ให้เพื่อนร่วมงานได้ และกด F5 แล้วตัวกรองไม่หาย
 */
export function FilterBar({ dims }: { dims: Dim[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const active = dims.filter((d) => params.get(`f.${d.key}`));

  function set(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(`f.${key}`, value);
    else next.delete(`f.${key}`);
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  }

  if (dims.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1 text-xs text-gray-500">
        <Filter className="h-3.5 w-3.5" /> กรอง:
      </span>
      {dims.map((d) => (
        <select
          key={d.key}
          value={params.get(`f.${d.key}`) ?? ""}
          onChange={(e) => set(d.key, e.target.value)}
          className={`max-w-[12rem] rounded-lg border px-2 py-1 text-sm outline-none ${
            params.get(`f.${d.key}`) ? "border-brand-400 bg-brand-50 text-brand-800" : "border-gray-200 bg-white text-gray-700"
          }`}
          title={d.label}
        >
          <option value="">{d.label}: ทั้งหมด</option>
          {d.values.map((v) => (
            <option key={v.value} value={v.value}>
              {v.label}
            </option>
          ))}
        </select>
      ))}
      {active.length > 0 && (
        <button
          onClick={() => {
            const next = new URLSearchParams(params.toString());
            for (const d of dims) next.delete(`f.${d.key}`);
            router.push(`${pathname}?${next.toString()}`, { scroll: false });
          }}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-gray-500 hover:bg-gray-100"
        >
          <X className="h-3.5 w-3.5" /> ล้างตัวกรอง
        </button>
      )}
    </div>
  );
}

/** เลือกมิติสำหรับตารางเทียบกลุ่ม (?by=) */
export function BreakdownPicker({ dims, current }: { dims: Dim[]; current: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <select
      value={current}
      onChange={(e) => {
        const next = new URLSearchParams(params.toString());
        next.set("by", e.target.value);
        router.push(`${pathname}?${next.toString()}#breakdown`, { scroll: false });
      }}
      className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-sm text-gray-700 outline-none"
    >
      {dims.map((d) => (
        <option key={d.key} value={d.key}>
          แยกตาม{d.label}
        </option>
      ))}
    </select>
  );
}

/* --------------------------------------------------------- ลิงก์กรรมการ */

export function SharePanel({
  surveyId,
  closed,
  url,
  expiresAt,
}: {
  surveyId: string;
  closed: boolean;
  url: string | null;
  expiresAt: string | null;
}) {
  const router = useRouter();
  const [until, setUntil] = useState(splitThai(expiresAt).date);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function call(method: "POST" | "DELETE", body?: unknown) {
    setBusy(true);
    setError(null);
    const r = await fetch(`/api/admin/surveys/${surveyId}/share/`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setError(data.error ?? "ทำรายการไม่สำเร็จ");
    router.refresh();
  }

  const expiry = joinThai(until, "23:59", "23:59");

  return (
    <div className="space-y-2">
      {!closed && (
        <p className="text-xs text-amber-700">เปิดลิงก์ให้กรรมการได้หลังกด &quot;สิ้นสุดการประเมิน&quot; แล้ว</p>
      )}
      {url ? (
        <>
          <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 ring-1 ring-gray-200">
            <code className="min-w-0 flex-1 truncate text-sm text-brand-700">{url}</code>
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(url).catch(() => {});
                setCopied(true);
                setTimeout(() => setCopied(false), 1800);
              }}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs text-gray-600 ring-1 ring-gray-200 hover:bg-white"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "คัดลอกแล้ว" : "คัดลอก"}
            </button>
          </div>
          <p className="text-xs text-gray-500">
            {expiresAt ? `ใช้ได้ถึง ${thaiDateTime(expiresAt)}` : "ไม่มีวันหมดอายุ — ใช้ได้จนกว่าจะกดยกเลิก"} · ไม่มีชื่อ เบอร์ หรือเลขสมาชิกของใครในหน้านั้น
          </p>
        </>
      ) : (
        <p className="text-sm text-gray-500">ยังไม่ได้เปิดลิงก์</p>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <div className="w-44">
          <span className="text-xs text-gray-500">หมดอายุ (เว้นว่าง = ไม่หมด)</span>
          <ThaiDatePicker value={until} onChange={setUntil} placeholder="ไม่หมดอายุ" className="mt-1" />
        </div>
        <button
          onClick={() => call("POST", { expiresAt: expiry, keep: true })}
          disabled={busy || !closed}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
          {url ? "บันทึกวันหมดอายุ" : "เปิดลิงก์ให้กรรมการ"}
        </button>
        {url && (
          <>
            <button
              onClick={() => window.confirm("ออกลิงก์ใหม่? ลิงก์เดิมที่ส่งไปแล้วจะใช้ไม่ได้") && call("POST", { expiresAt: expiry })}
              disabled={busy}
              className="rounded-lg px-3 py-2 text-sm text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50 disabled:opacity-50"
            >
              ออกลิงก์ใหม่
            </button>
            <button
              onClick={() => window.confirm("ยกเลิกลิงก์กรรมการ?") && call("DELETE")}
              disabled={busy}
              className="rounded-lg px-3 py-2 text-sm text-red-600 ring-1 ring-red-200 hover:bg-red-50 disabled:opacity-50"
            >
              ยกเลิกลิงก์
            </button>
          </>
        )}
      </div>
      <p className="text-[11px] text-gray-400">
        ลิงก์อยู่บน www.spsccoop.com เปิดได้ตลอด · ยกเลิกแล้วสำเนาบนโฮสต์ยังเปิดได้อีกไม่เกิน 2 นาที
        (ถ้าเครื่องสำนักงานปิดอยู่ จะเปิดได้จนกว่าเครื่องเปิด) · ระหว่างเปิดรับต่อ ลิงก์แสดงผล ณ 12:00
      </p>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

/* --------------------------------------------------- สรุปข้อเสนอแนะ */

/**
 * AI จัดกลุ่มข้อเสนอแนะที่พูดซ้ำกัน → เจ้าหน้าที่แก้ใจความ/จำนวน ลบกลุ่ม เพิ่มกลุ่มเองได้
 * ฉบับที่บันทึกคือฉบับที่กรรมการเห็น — AI ไม่เคยขึ้นตรงถึงกรรมการโดยไม่มีคนดู
 */
export function FeedbackEditor({
  surveyId,
  initial,
  at,
  aiReady,
  textCount,
}: {
  surveyId: string;
  initial: FeedbackGroup[];
  at: string | null;
  aiReady: boolean;
  textCount: number;
}) {
  const router = useRouter();
  const [groups, setGroups] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    if (initial.length && !window.confirm("ให้ AI สรุปใหม่? ที่แก้ไว้จะถูกแทนที่")) return;
    setBusy("ai");
    setError(null);
    const r = await fetch(`/api/admin/surveys/${surveyId}/feedback/`, { method: "POST" });
    const data = await r.json().catch(() => ({}));
    setBusy(null);
    if (!r.ok) return setError(data.error ?? "AI สรุปไม่สำเร็จ");
    setGroups(data.groups);
    router.refresh();
  }

  async function save() {
    setBusy("save");
    setError(null);
    const r = await fetch(`/api/admin/surveys/${surveyId}/feedback/`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groups }),
    });
    const data = await r.json().catch(() => ({}));
    setBusy(null);
    if (!r.ok) return setError(data.error ?? "บันทึกไม่สำเร็จ");
    setGroups(data.groups);
    setEditing(false);
    router.refresh();
  }

  const set = (i: number, patch: Partial<FeedbackGroup>) => setGroups((g) => g.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {aiReady && (
          <button
            onClick={generate}
            disabled={busy !== null || textCount === 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy === "ai" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {initial.length ? "ให้ AI สรุปใหม่" : "ให้ AI สรุปข้อเสนอแนะ"}
          </button>
        )}
        {!editing && groups.length > 0 && (
          <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50">
            <Pencil className="h-4 w-4" /> แก้ไข
          </button>
        )}
        <span className="text-xs text-gray-400">
          จาก {textCount} ความเห็น{at ? ` · สรุปเมื่อ ${thaiDateTime(at)}` : ""}
        </span>
      </div>

      {groups.length === 0 ? (
        <p className="text-sm text-gray-400">ยังไม่ได้สรุป{!aiReady ? " (ยังไม่ได้ตั้งค่า AI — เพิ่มกลุ่มเองได้)" : ""}</p>
      ) : editing ? null : (
        <FeedbackSummaryList groups={groups} />
      )}

      {editing || (!aiReady && groups.length === 0) ? (
        <div className="space-y-2">
          {groups.map((g, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={g.topic}
                onChange={(e) => set(i, { topic: e.target.value })}
                className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-brand-400"
              />
              <input
                type="number"
                min={1}
                value={g.count}
                onChange={(e) => set(i, { count: Number(e.target.value) || 0 })}
                className="w-20 rounded-lg border border-gray-200 px-2 py-1.5 text-right text-sm outline-none focus:border-brand-400"
              />
              <span className="text-xs text-gray-400">คน</span>
              <button onClick={() => setGroups((x) => x.filter((_, j) => j !== i))} className="rounded p-1 text-gray-400 hover:text-red-500" title="ลบกลุ่มนี้">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setGroups((x) => [...x, { topic: "", count: 1 }])} className="inline-flex items-center gap-1 text-sm text-brand-600">
              <Plus className="h-4 w-4" /> เพิ่มกลุ่ม
            </button>
            <button
              onClick={save}
              disabled={busy !== null}
              className="ml-auto inline-flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
              {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} บันทึก
            </button>
            {editing && (
              <button
                onClick={() => {
                  setGroups(initial);
                  setEditing(false);
                }}
                className="rounded-lg px-3 py-1.5 text-sm text-gray-600 ring-1 ring-gray-200"
              >
                ยกเลิก
              </button>
            )}
          </div>
        </div>
      ) : null}
      <p className="text-[11px] text-gray-400">
        AI ได้เห็นเฉพาะข้อความ (ตัดเบอร์โทรและตัวเลขยาว ๆ ออกก่อน) ไม่เห็นชื่อหรือเลขสมาชิก · ฉบับที่บันทึกคือฉบับที่กรรมการเห็น
      </p>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
