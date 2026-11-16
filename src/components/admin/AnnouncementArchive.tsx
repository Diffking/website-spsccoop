"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, ExternalLink, RotateCcw, Trash2 } from "lucide-react";

export type ArchivedRow = { id: string; number: string; title: string; archiveYear: number };

const input =
  "min-h-10 w-24 rounded-lg border border-gray-300 bg-white px-2 text-center text-sm outline-none focus:border-brand-500";

/**
 * คลังประกาศตามปีบัญชี — จัดเก็บทั้งช่วงเลขที่ในคลิกเดียว · ย้ายกลับทีละฉบับ
 * ของในคลังไม่ขึ้นหน้าแรก/หน้ารวม ไปอยู่ที่ /news/archive/<ปี>/
 */
export default function AnnouncementArchive({ rows }: { rows: ArchivedRow[] }) {
  const router = useRouter();
  const thisYear = new Date().getFullYear() + 543;
  const [year, setYear] = useState(String(thisYear - 1));
  const [from, setFrom] = useState("1");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  async function post(body: unknown) {
    setBusy(true);
    setStatus(null);
    const res = await fetch("/api/admin/announcements/archive/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    const data = (await res?.json().catch(() => ({}))) as { error?: string; count?: number };
    setBusy(false);
    if (!res?.ok) {
      setStatus({ kind: "error", text: data?.error ?? "ทำไม่สำเร็จ" });
      return false;
    }
    router.refresh();
    return data;
  }

  async function archive() {
    if (!window.confirm(`จัดเก็บประกาศเลขที่ ${from}/${year} ถึง ${to}/${year} เข้า "ประกาศปีบัญชี ${year}"?\nประกาศเหล่านี้จะไม่ขึ้นหน้าแรกอีก`)) return;
    const r = await post({ action: "archive", year: Number(year), from: Number(from), to: Number(to) });
    if (r) setStatus({ kind: "ok", text: `จัดเก็บแล้ว ${r.count ?? 0} ฉบับ` });
  }

  async function removeYear(y: number, count: number) {
    const typed = window.prompt(
      `ลบประกาศปีบัญชี ${y} ทั้งหมด ${count} ฉบับ ทิ้งถาวร?
หน้า "ประกาศปีบัญชี ${y}" จะหายไปด้วย

พิมพ์ ${y} เพื่อยืนยัน`,
    );
    if (typed?.trim() !== String(y)) return;
    const r = await post({ action: "deleteYear", year: y });
    if (r) setStatus({ kind: "ok", text: `ลบประกาศปีบัญชี ${y} แล้ว ${r.count ?? 0} ฉบับ` });
  }

  async function removeOne(row: ArchivedRow) {
    if (!window.confirm(`ลบประกาศ ${row.number} ทิ้งถาวร?
${row.title}`)) return;
    const r = await post({ action: "delete", id: row.id });
    if (r) setStatus({ kind: "ok", text: `ลบประกาศ ${row.number} แล้ว` });
  }

  const years = [...new Set(rows.map((r) => r.archiveYear))].sort((a, b) => b - a);

  return (
    <section className="mt-8 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
      <h2 className="flex items-center gap-2 font-bold text-gray-800">
        <Archive className="h-5 w-5 text-brand-600" /> คลังประกาศตามปีบัญชี
      </h2>
      <p className="mt-1 text-sm text-gray-500">
        ประกาศที่จัดเก็บแล้วไม่ขึ้นหน้าแรก ย้ายไปอยู่หน้า “ประกาศปีบัญชี …” แยกต่างหาก · ไม่ลบไฟล์ ลิงก์เดิมยังเปิดได้
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-2 rounded-xl bg-gray-50 p-3 text-sm text-gray-700">
        <span className="self-center">จัดเก็บประกาศเลขที่</span>
        <input value={from} onChange={(e) => setFrom(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className={input} aria-label="ตั้งแต่เลขที่" />
        <span className="self-center">ถึง</span>
        <input value={to} onChange={(e) => setTo(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className={input} aria-label="ถึงเลขที่" placeholder="เช่น 30" />
        <span className="self-center">/</span>
        <input value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" className={input} aria-label="ปี" />
        <span className="self-center">เข้าประกาศปีบัญชี {year || "…"}</span>
        <button
          type="button"
          onClick={() => void archive()}
          disabled={busy || !from || !to || year.length !== 4}
          className="ml-auto inline-flex min-h-10 items-center gap-1.5 rounded-full bg-brand-600 px-4 font-semibold text-white hover:bg-brand-700 disabled:bg-gray-300"
        >
          <Archive className="h-4 w-4" /> จัดเก็บ
        </button>
      </div>
      {status && <p className={`mt-2 text-sm ${status.kind === "ok" ? "text-emerald-700" : "text-red-600"}`}>{status.text}</p>}

      {years.map((y) => (
        <div key={y} className="mt-5">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-gray-700">
            ประกาศปีบัญชี {y} <span className="font-normal text-gray-400">{rows.filter((r) => r.archiveYear === y).length} ฉบับ</span>
            <a href={`/news/archive/${y}/`} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1 text-xs font-normal text-brand-700 hover:underline">
              ดูหน้าเว็บ <ExternalLink className="h-3 w-3" />
            </a>
            <button
              type="button"
              disabled={busy}
              onClick={() => void removeYear(y, rows.filter((r) => r.archiveYear === y).length)}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-red-600 ring-1 ring-red-200 hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 className="h-3 w-3" /> ลบทั้งปีบัญชี {y}
            </button>
          </h3>
          <ul className="grid grid-cols-1 divide-y divide-gray-100 rounded-xl ring-1 ring-gray-100">
            {rows
              .filter((r) => r.archiveYear === y)
              .map((r) => (
                <li key={r.id} className="flex min-w-0 items-center gap-2 px-3 py-2">
                  <span className="w-16 shrink-0 text-xs text-gray-500">{r.number}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-gray-700">{r.title}</span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void post({ action: "restore", id: r.id })}
                    title="ย้ายกลับไปเป็นประกาศปัจจุบัน (ขึ้นหน้าแรก)"
                    className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50"
                  >
                    <RotateCcw className="h-3 w-3" /> ย้ายกลับ
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void removeOne(r)}
                    aria-label={`ลบประกาศ ${r.number}`}
                    title="ลบทิ้งถาวร"
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-red-500 hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
