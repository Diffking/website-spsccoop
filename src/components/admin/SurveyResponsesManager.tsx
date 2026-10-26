"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Ban,
  Clock,
  Inbox,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  UserCheck,
  X,
} from "lucide-react";
import { thaiDateTime } from "@/lib/surveyTime";

type Status = "verified" | "pending" | "review" | "rejected";

export type ResponseRow = {
  id: string;
  membNo: string | null;
  name: string | null;
  phone: string | null;
  department: string | null;
  submittedAt: string;
  source: string;
  claimedMembNo: string | null;
  /** เบอร์ที่สมาชิกกรอก แบบปิดบัง (081-xxx-5678) — เบอร์เต็มไม่เก็บ */
  claimedPhone: string | null;
  /** รูปแบบเดิมก่อนรับทะเบียนจาก sync-agent */
  claimedName: string | null;
  status: string;
  statusNote: string | null;
  checkedAt: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
};

const TABS: { key: Status | "all"; label: string; tone: string; icon: typeof Inbox }[] = [
  { key: "review", label: "ให้เจ้าหน้าที่ดู", tone: "text-amber-700 bg-amber-50 ring-amber-200", icon: AlertTriangle },
  { key: "pending", label: "รอตรวจ", tone: "text-sky-700 bg-sky-50 ring-sky-200", icon: Clock },
  { key: "verified", label: "ตรวจแล้ว", tone: "text-emerald-700 bg-emerald-50 ring-emerald-200", icon: BadgeCheck },
  { key: "rejected", label: "ไม่ผ่าน", tone: "text-gray-600 bg-gray-100 ring-gray-200", icon: Ban },
  { key: "all", label: "ทั้งหมด", tone: "text-gray-700 bg-white ring-gray-200", icon: Inbox },
];
const TONE = Object.fromEntries(TABS.map((t) => [t.key, t])) as Record<string, (typeof TABS)[number]>;

/** แก้ให้ตรงกับระบบ — ค้นเลขที่สมาชิก เห็นข้อมูลจากฐานก่อน แล้วค่อยกดยืนยัน (ไม่ให้พิมพ์ชื่อเอง) */
function AssignBox({
  surveyId,
  row,
  onDone,
  onCancel,
}: {
  surveyId: string;
  row: ResponseRow;
  onDone: () => void;
  onCancel: () => void;
}) {
  // เดาเลขจากหมายเหตุของระบบ ("เบอร์นี้เป็นของสมาชิกเลขที่ 07337") ให้กดค้นได้เลย
  const hinted = /เลขที่ (\d+)/.exec(row.statusNote ?? "")?.[1] ?? "";
  const [q, setQ] = useState(hinted);
  const [found, setFound] = useState<{ membNo: string; name: string; phone: string | null; department: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search() {
    setBusy(true);
    setError(null);
    setFound(null);
    const r = await fetch("/api/admin/members/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q }),
    });
    const data = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setError(data.error ?? "ค้นไม่สำเร็จ");
    setFound(data.member);
  }

  async function confirm() {
    if (!found) return;
    setBusy(true);
    setError(null);
    const r = await fetch(`/api/admin/surveys/${surveyId}/responses/${row.id}/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "assign", membNo: found.membNo }),
    });
    const data = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setError(data.error ?? "บันทึกไม่สำเร็จ");
    onDone();
  }

  return (
    <div className="mt-2 rounded-xl bg-white p-3 ring-1 ring-brand-200">
      <p className="text-xs text-gray-500">ค้นสมาชิกที่ถูกต้องจากทะเบียน — ชื่อ เบอร์ หน่วยงาน จะใช้ตามฐานสมาชิก</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim() && !busy) search();
        }}
        className="mt-2 flex gap-2"
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          inputMode="numeric"
          placeholder="เลขที่สมาชิก หรือเบอร์มือถือ"
          className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-brand-400"
        />
        <button
          type="submit"
          disabled={busy || !q.trim()}
          className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {busy && !found ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} ค้น
        </button>
        <button type="button" onClick={onCancel} title="ยกเลิก" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
          <X className="h-4 w-4" />
        </button>
      </form>
      {found && (
        <div className="mt-2 flex flex-wrap items-center gap-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm ring-1 ring-emerald-200">
          <span className="min-w-0 flex-1">
            <b>{found.name}</b> · เลขที่ {found.membNo}
            <span className="block text-xs text-gray-600">
              {found.phone ?? "ไม่มีเบอร์"} · {found.department ?? "ไม่ระบุหน่วยงาน"}
            </span>
          </span>
          <button
            type="button"
            onClick={confirm}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />} ยืนยันเป็นคนนี้
          </button>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export default function SurveyResponsesManager({
  surveyId,
  title,
  sourceReady,
  counts,
  rows,
}: {
  surveyId: string;
  title: string;
  sourceReady: boolean;
  counts: Record<Status, number>;
  rows: ResponseRow[];
}) {
  const router = useRouter();
  const firstTab: Status | "all" = counts.review ? "review" : counts.pending ? "pending" : "all";
  const [tab, setTab] = useState<Status | "all">(firstTab);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const shown = tab === "all" ? rows : rows.filter((r) => r.status === tab);
  const total = rows.length;

  async function act(rid: string, body: Record<string, unknown>) {
    setBusy(rid);
    setMessage(null);
    const r = await fetch(`/api/admin/surveys/${surveyId}/responses/${rid}/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await r.json().catch(() => ({}));
    setBusy(null);
    if (!r.ok) return setMessage(data.error ?? "ทำรายการไม่สำเร็จ");
    router.refresh();
  }

  function reject(row: ResponseRow) {
    const reason = window.prompt("เหตุผลที่ตัดทิ้ง (เช่น ไม่ใช่สมาชิก · ข้อมูลไม่ครบ · ตอบซ้ำ)");
    if (reason?.trim()) act(row.id, { action: "reject", reason });
  }

  async function verify(recheck: boolean) {
    if (recheck && !window.confirm("ตรวจกับฐานสมาชิกซ้ำทั้งชุด รวมคนที่ผ่านแล้วด้วย?")) return;
    setBusy(recheck ? "recheck" : "verify");
    setMessage(null);
    const r = await fetch(`/api/admin/surveys/${surveyId}/verify/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recheck }),
    });
    const data = await r.json().catch(() => ({}));
    setBusy(null);
    if (!r.ok) return setMessage(data.error ?? "ตรวจไม่สำเร็จ");
    const rep = data.report;
    setMessage(
      `ตรวจ ${rep.checked} รายการ · ผ่าน ${rep.verified} · ให้เจ้าหน้าที่ดู ${rep.review} · ไม่ผ่าน ${rep.rejected}` +
        (rep.stopped ? " · ฐานสมาชิกขัดข้องกลางทาง ที่เหลือรอรอบหน้า" : ""),
    );
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Link href={`/admin/surveys/${surveyId}/`} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-700">
        <ArrowLeft className="h-4 w-4" /> กลับไปหน้าแบบประเมิน
      </Link>

      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <h1 className="text-lg font-bold text-gray-800">ผู้ตอบแบบประเมิน</h1>
        <p className="text-sm text-gray-500">{title}</p>
        <p className="mt-2 text-xs leading-relaxed text-gray-500">
          นำไปใช้ต่อ (สรุปผล · ส่งออก · จับรางวัล) <b>เฉพาะ &quot;ตรวจแล้ว&quot;</b> — ตรงกับทะเบียนสมาชิกทุกรายการ
        </p>

        {!sourceReady && (
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            ยังไม่มีทะเบียนสมาชิกจาก sync-agent — คำตอบทุกรายการค้างที่ &quot;รอตรวจ&quot; จนกว่าจะได้รับ แล้วระบบจะตรวจให้เอง
          </p>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          {TABS.map((t) => {
            const n = t.key === "all" ? total : counts[t.key];
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm ring-1 transition ${t.tone} ${
                  tab === t.key ? "font-semibold ring-2" : "opacity-80 hover:opacity-100"
                }`}
              >
                <t.icon className="h-4 w-4" /> {t.label}
                <span className="rounded-full bg-white/70 px-1.5 text-xs">{n.toLocaleString("th-TH")}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap gap-2 border-t border-gray-100 pt-3">
          <button
            onClick={() => verify(false)}
            disabled={busy !== null || !sourceReady}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-gray-700 ring-1 ring-gray-200 transition hover:bg-gray-50 disabled:opacity-50"
          >
            {busy === "verify" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            ตรวจรายการที่รอตรวจ
          </button>
          <button
            onClick={() => verify(true)}
            disabled={busy !== null || !sourceReady}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-gray-700 ring-1 ring-gray-200 transition hover:bg-gray-50 disabled:opacity-50"
          >
            {busy === "recheck" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            ตรวจกับฐานสมาชิกอีกครั้ง (ทั้งชุด)
          </button>
        </div>
        {message && <p className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">{message}</p>}
      </section>

      <section className="rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
        {shown.length === 0 ? (
          <p className="grid place-items-center gap-2 py-12 text-center text-sm text-gray-400">
            <Inbox className="h-6 w-6 text-gray-300" /> ไม่มีรายการในกลุ่มนี้
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {shown.map((r) => {
              const tone = TONE[r.status] ?? TONE.all;
              // ผูกกับสมาชิกอยู่ (รวมคนที่ตรวจซ้ำแล้วตกกลับมาเป็น review) — โชว์ข้อมูลจากฐานก่อนเสมอ
              const known = Boolean(r.membNo && r.name);
              return (
                <li key={r.id} className="p-4">
                  <div className="flex flex-wrap items-start gap-3">
                    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs ring-1 ${tone.tone}`}>
                      <tone.icon className="h-3.5 w-3.5" /> {tone.label}
                    </span>
                    <div className="min-w-0 flex-1 text-sm">
                      {known ? (
                        <p className="font-medium text-gray-800">
                          {r.name} <span className="font-normal text-gray-500">· เลขที่ {r.membNo}</span>
                        </p>
                      ) : (
                        <p className="font-medium text-gray-800">
                          {r.claimedMembNo ? `เลขที่ ${r.claimedMembNo}` : (r.claimedName ?? r.name ?? "—")}{" "}
                          <span className="font-normal text-gray-500">(กรอกเอง)</span>
                        </p>
                      )}
                      <p className="text-xs text-gray-500">
                        {known ? `กลุ่มเรียกเก็บ ${r.department ?? "—"}` : `เบอร์ที่กรอก: ${r.claimedPhone ?? "—"}`}
                      </p>
                      {known && r.claimedMembNo && (
                        <p className="text-xs text-gray-400">
                          สมาชิกกรอกเอง: เลขที่ {r.claimedMembNo} · {r.claimedPhone}
                        </p>
                      )}
                      <p className="mt-0.5 text-xs text-gray-400">
                        ส่งเมื่อ {thaiDateTime(r.submittedAt)} · {r.source === "queued" ? "ฝากไว้ตอนระบบไม่พร้อม" : "ยืนยันตัวตนสด"}
                      </p>
                      {r.statusNote && <p className="mt-1 text-xs text-amber-700">{r.statusNote}</p>}
                      {r.reviewedByName && (
                        <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] text-brand-700">
                          <ShieldCheck className="h-3 w-3" /> ตรวจสอบโดย {r.reviewedByName} · {thaiDateTime(r.reviewedAt)}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-1.5">
                      {r.status !== "rejected" && (
                        <button
                          onClick={() => setOpen(open === r.id ? null : r.id)}
                          disabled={!sourceReady}
                          title={sourceReady ? undefined : "ยังไม่มีทะเบียนสมาชิก"}
                          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs text-brand-700 ring-1 ring-brand-200 transition hover:bg-brand-50 disabled:opacity-50"
                        >
                          <UserCheck className="h-3.5 w-3.5" /> แก้ให้ตรงกับระบบ
                        </button>
                      )}
                      {r.status !== "rejected" ? (
                        <button
                          onClick={() => reject(r)}
                          disabled={busy !== null}
                          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs text-red-600 ring-1 ring-red-200 transition hover:bg-red-50 disabled:opacity-50"
                        >
                          {busy === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />} ตัดทิ้ง
                        </button>
                      ) : (
                        <button
                          onClick={() => act(r.id, { action: "reopen" })}
                          disabled={busy !== null}
                          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs text-gray-600 ring-1 ring-gray-200 transition hover:bg-gray-50 disabled:opacity-50"
                        >
                          <RotateCcw className="h-3.5 w-3.5" /> ดึงกลับมาตรวจใหม่
                        </button>
                      )}
                    </div>
                  </div>
                  {open === r.id && (
                    <AssignBox
                      surveyId={surveyId}
                      row={r}
                      onCancel={() => setOpen(null)}
                      onDone={() => {
                        setOpen(null);
                        router.refresh();
                      }}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
