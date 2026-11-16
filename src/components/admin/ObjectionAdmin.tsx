"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Download, ExternalLink, Plus, Printer, Save, Trash2 } from "lucide-react";
import ThaiDatePicker from "@/components/admin/ThaiDatePicker";
import {
  STATUS_LABEL,
  agendaLabel,
  dateValue,
  thaiDate,
  thaiDateTime,
  type Agenda,
  type ObjectionItem,
  type RoundStatus,
} from "@/lib/objection";

const input =
  "min-h-11 w-full rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

const STATUS_STYLE: Record<RoundStatus, string> = {
  draft: "bg-gray-100 text-gray-600",
  scheduled: "bg-amber-50 text-amber-700",
  open: "bg-emerald-50 text-emerald-700",
  closed: "bg-gray-100 text-gray-600",
};

export type RoundRow = {
  id: string;
  year: number;
  title: string;
  opensAt: string;
  closesAt: string;
  status: RoundStatus;
  count: number;
};

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).catch(() => null);
  const data = (await res?.json().catch(() => ({}))) as Record<string, unknown> | undefined;
  return { ok: Boolean(res?.ok), data: data ?? {} };
}

/** หน้ารวมรอบทุกปี + เพิ่มรอบใหม่ (เจ้าหน้าที่กำหนดวันเริ่ม/วันปิดรับเอง) */
export function ObjectionRounds({ rounds }: { rounds: RoundRow[] }) {
  const router = useRouter();
  const thisYear = new Date().getFullYear() + 543;
  const [year, setYear] = useState(String(thisYear));
  const [opens, setOpens] = useState("");
  const [closes, setCloses] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function create() {
    setBusy(true);
    setError("");
    const r = await send("/api/admin/objections/", "POST", { year: Number(year), opensAt: opens, closesAt: closes });
    setBusy(false);
    if (!r.ok) return setError(String(r.data.error ?? "เพิ่มไม่สำเร็จ"));
    router.push(`/admin/objections/${r.data.id}/`);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
        <h2 className="mb-3 font-bold text-gray-800">เพิ่มรอบรับคำทักท้วง</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <label className="block text-sm font-semibold text-gray-700">
            ปี พ.ศ. ของการประชุมใหญ่
            <input value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" className={`${input} mt-1.5`} />
          </label>
          <div>
            <span className="mb-1.5 block text-sm font-semibold text-gray-700">วันเริ่มรับ</span>
            <ThaiDatePicker value={opens} onChange={setOpens} />
          </div>
          <div>
            <span className="mb-1.5 block text-sm font-semibold text-gray-700">วันปิดรับ</span>
            <ThaiDatePicker value={closes} onChange={setCloses} />
          </div>
        </div>
        <p className="mt-2 text-xs text-gray-500">เปิดรับตั้งแต่ 00:00 น. ของวันเริ่ม ถึง 23:59 น. ของวันปิด (เวลาไทย) · แก้ได้ภายหลัง</p>
        <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
          {error && <span className="text-sm text-red-600">{error}</span>}
          <button
            type="button"
            onClick={() => void create()}
            disabled={busy || year.length !== 4 || !opens || !closes}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-brand-600 px-5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:bg-gray-300"
          >
            <Plus className="h-4 w-4" /> เพิ่มรอบ
          </button>
        </div>
      </section>

      {rounds.length === 0 ? (
        <p className="rounded-2xl bg-white px-5 py-10 text-center text-sm text-gray-500 ring-1 ring-black/5">
          ยังไม่มีรอบรับคำทักท้วง — เพิ่มรอบแรกจากฟอร์มด้านบน
        </p>
      ) : (
        <ul className="grid grid-cols-1 divide-y divide-gray-100 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
          {rounds.map((r) => (
            <li key={r.id} className="min-w-0">
              <Link href={`/admin/objections/${r.id}/`} className="flex min-w-0 items-center gap-3 px-4 py-3 hover:bg-gray-50">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-gray-800">{r.title}</p>
                  <p className="truncate text-xs text-gray-500">
                    {thaiDate(r.opensAt)} – {thaiDate(r.closesAt)} · {r.count} รายการ
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[r.status]}`}>
                  {STATUS_LABEL[r.status]}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export type ObjectionRow = { id: string; membNo: string; name: string; items: ObjectionItem[]; createdAt: string };

/** หน้ารอบเดียว — ตั้งค่า (หัวเรื่อง · วันรับ · ชื่อวาระ) + รายการคำทักท้วง + ออกรายงาน */
export function ObjectionRoundEditor({
  round,
  rows,
}: {
  round: { id: string; year: number; title: string; opensAt: string; closesAt: string; agendas: Agenda[]; published: boolean; status: RoundStatus };
  rows: ObjectionRow[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState(round.title);
  const [opens, setOpens] = useState(dateValue(round.opensAt));
  const [closes, setCloses] = useState(dateValue(round.closesAt));
  const [agendas, setAgendas] = useState(round.agendas);
  const [published, setPublished] = useState(round.published);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [filter, setFilter] = useState<number | null>(null);

  async function save() {
    setBusy(true);
    setStatus(null);
    const r = await send(`/api/admin/objections/${round.id}/`, "PATCH", { title, opensAt: opens, closesAt: closes, agendas, published });
    setBusy(false);
    setStatus(r.ok ? { kind: "ok", text: "บันทึกแล้ว — หน้าเว็บเปลี่ยนตามทันที" } : { kind: "error", text: String(r.data.error ?? "บันทึกไม่สำเร็จ") });
    if (r.ok) router.refresh();
  }

  async function remove(row: ObjectionRow) {
    if (!window.confirm(`ลบคำทักท้วงของ ${row.name} (เลขที่ ${row.membNo})?\nเจ้าของเลขนี้จะส่งใหม่ได้หลังลบ`)) return;
    const r = await send(`/api/admin/objections/${round.id}/items/${row.id}/`, "DELETE");
    if (!r.ok) setStatus({ kind: "error", text: "ลบไม่สำเร็จ" });
    router.refresh();
  }

  async function removeRound() {
    if (!window.confirm(`ลบรอบ "${round.title}"?`)) return;
    const r = await send(`/api/admin/objections/${round.id}/`, "DELETE");
    if (!r.ok) return setStatus({ kind: "error", text: String(r.data.error ?? "ลบไม่สำเร็จ") });
    router.push("/admin/objections/");
  }

  const perAgenda = agendas.map((a) => ({ a, n: rows.filter((r) => r.items.some((i) => i.no === a.no)).length }));
  const shown = filter ? rows.filter((r) => r.items.some((i) => i.no === filter)) : rows;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h2 className="font-bold text-gray-800">ตั้งค่ารอบ</h2>
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[round.status]}`}>{STATUS_LABEL[round.status]}</span>
          <a href="/point-order/" target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1 text-xs text-brand-700 hover:underline">
            ดูหน้าเว็บ <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <div className="space-y-4">
          <label className="block text-sm font-semibold text-gray-700">
            หัวเรื่อง
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={`${input} mt-1.5`} />
          </label>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <span className="mb-1.5 block text-sm font-semibold text-gray-700">วันเริ่มรับ (00:00 น.)</span>
              <ThaiDatePicker value={opens} onChange={setOpens} />
            </div>
            <div>
              <span className="mb-1.5 block text-sm font-semibold text-gray-700">วันปิดรับ (23:59 น.)</span>
              <ThaiDatePicker value={closes} onChange={setCloses} />
            </div>
          </div>
          <fieldset>
            <legend className="text-sm font-semibold text-gray-700">ชื่อระเบียบวาระ</legend>
            <p className="text-xs text-gray-500">เว้นว่าง = สมาชิกเห็นแค่ “ระเบียบวาระที่ N”</p>
            <div className="mt-2 grid grid-cols-1 gap-2">
              {agendas.map((a, i) => (
                <label key={a.no} className="flex min-w-0 items-center gap-2">
                  <span className="w-32 shrink-0 text-sm text-gray-600">ระเบียบวาระที่ {a.no}</span>
                  <input
                    value={a.title}
                    onChange={(e) => setAgendas((list) => list.map((x, k) => (k === i ? { ...x, title: e.target.value } : x)))}
                    placeholder="เช่น เรื่องที่ประธานแจ้งให้ที่ประชุมทราบ"
                    className={input}
                  />
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-gray-100 pt-4">
            <label className="mr-auto inline-flex min-h-11 items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} className="h-5 w-5" />
              เผยแพร่บนหน้าเว็บ
            </label>
            {status && <span className={`text-sm ${status.kind === "ok" ? "text-emerald-700" : "text-red-600"}`}>{status.text}</span>}
            <button
              type="button"
              onClick={() => void save()}
              disabled={busy || !opens || !closes || !title.trim()}
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-brand-600 px-5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:bg-gray-300"
            >
              <Save className="h-4 w-4" /> บันทึก
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="font-bold text-gray-800">คำทักท้วง {rows.length} รายการ</h2>
          <div className="ml-auto flex flex-wrap gap-2">
            <a
              href={`/admin/objections/${round.id}/report/`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50"
            >
              <Printer className="h-4 w-4" /> พิมพ์รายงาน / PDF
            </a>
            <a
              href={`/api/admin/objections/${round.id}/export/`}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50"
            >
              <Download className="h-4 w-4" /> ดาวน์โหลด Excel (CSV)
            </a>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setFilter(null)}
            className={`min-h-9 rounded-full px-3 text-xs font-medium ring-1 ${filter === null ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-gray-600 ring-gray-200"}`}
          >
            ทั้งหมด ({rows.length})
          </button>
          {perAgenda.map(({ a, n }) => (
            <button
              key={a.no}
              type="button"
              onClick={() => setFilter(a.no)}
              className={`min-h-9 rounded-full px-3 text-xs font-medium ring-1 ${filter === a.no ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-gray-600 ring-gray-200"}`}
            >
              วาระที่ {a.no} ({n})
            </button>
          ))}
        </div>

        {shown.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">ยังไม่มีคำทักท้วง</p>
        ) : (
          <ul className="grid grid-cols-1 divide-y divide-gray-100">
            {shown.map((r) => (
              <li key={r.id} className="min-w-0 py-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-800">
                      {r.name} <span className="font-normal text-gray-500">· เลขที่สมาชิก {r.membNo}</span>
                    </p>
                    <p className="text-xs text-gray-400">ส่งเมื่อ {thaiDateTime(r.createdAt)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void remove(r)}
                    aria-label="ลบคำทักท้วงนี้"
                    title="ลบคำทักท้วงนี้"
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-red-500 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <ul className="mt-2 space-y-2">
                  {r.items
                    .filter((i) => filter === null || i.no === filter)
                    .map((i) => (
                      <li key={i.no} className="rounded-xl bg-gray-50 px-3 py-2">
                        <p className="text-xs font-semibold text-brand-700">
                          {agendaLabel(agendas.find((a) => a.no === i.no) ?? { no: i.no, title: "" })}
                        </p>
                        <p className="mt-0.5 whitespace-pre-line break-words text-sm text-gray-700">{i.detail}</p>
                      </li>
                    ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>

      {rows.length === 0 && (
        <button type="button" onClick={() => void removeRound()} className="text-sm text-red-600 hover:underline">
          ลบรอบนี้
        </button>
      )}
    </div>
  );
}
