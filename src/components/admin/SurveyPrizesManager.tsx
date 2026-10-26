"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Ban,
  Check,
  Download,
  Gift,
  Loader2,
  Plus,
  Printer,
  Save,
  Trophy,
  Trash2,
} from "lucide-react";
import { thaiDateTime } from "@/lib/surveyTime";

export type PrizeRow = { id: string | null; name: string; quantity: number; mode: "one" | "batch"; drawn: number };
export type DrawRow = {
  id: string;
  prizeName: string;
  round: number;
  membNo: string;
  name: string;
  phone: string | null;
  department: string | null;
  drawnAt: string;
  pressedBy: string | null;
  voided: boolean;
  voidReason: string | null;
};

const input = "rounded-lg border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-brand-400";

export default function SurveyPrizesManager({
  surveyId,
  prizes: initial,
  draws,
  blockers,
  poolSize,
  excluded,
  fingerprint,
  round,
}: {
  surveyId: string;
  prizes: PrizeRow[];
  draws: DrawRow[];
  blockers: string[];
  poolSize: number;
  excluded: { staff: number; won: number };
  fingerprint: string;
  round: number;
}) {
  const router = useRouter();
  const [prizes, setPrizes] = useState<PrizeRow[]>(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const dirty = JSON.stringify(prizes) !== JSON.stringify(initial);

  const set = (i: number, patch: Partial<PrizeRow>) => setPrizes((p) => p.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const move = (i: number, by: number) =>
    setPrizes((p) => {
      const j = i + by;
      if (j < 0 || j >= p.length) return p;
      const n = [...p];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });

  async function save() {
    setBusy("save");
    setError(null);
    const r = await fetch(`/api/admin/surveys/${surveyId}/prizes/`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prizes }),
    });
    const data = await r.json().catch(() => ({}));
    setBusy(null);
    if (!r.ok) return setError(data.error ?? "บันทึกไม่สำเร็จ");
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
    router.refresh();
  }

  async function voidDraw(d: DrawRow) {
    const reason = window.prompt(`${d.name} — เหตุผลที่สละสิทธิ์ (เช่น สละสิทธิ์ · ติดต่อไม่ได้)\n\nแถวนี้จะถูกขีดฆ่า ไม่ถูกลบ แล้วจับแทนได้หนึ่งที่`);
    if (!reason?.trim()) return;
    setBusy(d.id);
    const r = await fetch(`/api/admin/surveys/${surveyId}/draw/${d.id}/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    const data = await r.json().catch(() => ({}));
    setBusy(null);
    if (!r.ok) return setError(data.error ?? "ทำรายการไม่สำเร็จ");
    router.refresh();
  }

  const totalLeft = initial.reduce((n, p) => n + Math.max(0, p.quantity - p.drawn), 0);
  const ready = blockers.length === 0 && poolSize > 0 && totalLeft > 0 && !dirty;

  return (
    <div className="space-y-4">
      {/* ---------- ผู้มีสิทธิ์ ---------- */}
      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <h2 className="flex items-center gap-2 font-semibold text-gray-800">
          <Trophy className="h-5 w-5 text-amber-500" /> ผู้มีสิทธิ์ลุ้นรางวัล {round > 1 && <span className="text-sm font-normal text-gray-500">· รอบที่ {round}</span>}
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-emerald-50 p-3 ring-1 ring-emerald-200">
            <p className="text-xs text-emerald-800">มีสิทธิ์ลุ้นตอนนี้</p>
            <p className="text-2xl font-bold text-emerald-900">{poolSize.toLocaleString("th-TH")} คน</p>
          </div>
          <div className="rounded-xl bg-gray-50 p-3 ring-1 ring-gray-200">
            <p className="text-xs text-gray-600">ไม่นับ (เจ้าหน้าที่)</p>
            <p className="text-2xl font-bold text-gray-800">{excluded.staff}</p>
          </div>
          <div className="rounded-xl bg-gray-50 p-3 ring-1 ring-gray-200">
            <p className="text-xs text-gray-600">ได้รางวัลไปแล้ว / สละสิทธิ์</p>
            <p className="text-2xl font-bold text-gray-800">{excluded.won}</p>
          </div>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          ลายนิ้วมือรายชื่อ <b className="font-mono text-gray-800">{fingerprint}</b> · เปลี่ยนเมื่อรายชื่อเปลี่ยนแม้แต่คนเดียว
          (จดหรือถ่ายรูปไว้ก่อนจับได้)
        </p>
        {blockers.length > 0 && (
          <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-amber-200">
            <p className="flex items-center gap-1.5 font-semibold">
              <AlertTriangle className="h-4 w-4" /> ยังจับรางวัลไม่ได้
            </p>
            <ul className="mt-1 list-disc pl-6 text-xs">
              {blockers.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
            <Link href={`/admin/surveys/${surveyId}/responses/`} className="mt-1 inline-block text-xs text-brand-700 underline">
              ไปหน้าผู้ตอบ
            </Link>
          </div>
        )}
      </section>

      {/* ---------- ของรางวัล ---------- */}
      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <h2 className="flex items-center gap-2 font-semibold text-gray-800">
          <Gift className="h-5 w-5 text-brand-600" /> ของรางวัล
        </h2>
        <p className="mt-0.5 text-xs text-gray-500">เรียงตามลำดับที่จะจับ — รางวัลเล็กก่อน รางวัลใหญ่ไว้ท้ายสุด · หนึ่งคนได้รางวัลเดียว</p>

        <div className="mt-3 space-y-2">
          {prizes.map((p, i) => (
            <div key={p.id ?? `new-${i}`} className="flex flex-wrap items-center gap-2 rounded-xl bg-gray-50 p-2 ring-1 ring-gray-100">
              <span className="w-6 text-center text-xs text-gray-400">{i + 1}</span>
              <input value={p.name} onChange={(e) => set(i, { name: e.target.value })} placeholder="ชื่อรางวัล เช่น รางวัลที่ 1 ทองคำ 1 สลึง" className={`${input} min-w-0 flex-1`} />
              <label className="flex items-center gap-1 text-xs text-gray-500">
                จำนวน
                <input type="number" min={Math.max(1, p.drawn)} value={p.quantity} onChange={(e) => set(i, { quantity: Number(e.target.value) || 0 })} className={`${input} w-20 text-right`} />
              </label>
              <select value={p.mode} onChange={(e) => set(i, { mode: e.target.value as "one" | "batch" })} className={`${input} bg-white`}>
                <option value="one">จับทีละคน (ลุ้น)</option>
                <option value="batch">จับทั้งชุดในครั้งเดียว</option>
              </select>
              {p.drawn > 0 && <span className="text-xs text-emerald-700">จับแล้ว {p.drawn}</span>}
              <span className="flex">
                <button onClick={() => move(i, -1)} className="rounded p-1 text-gray-400 hover:text-brand-600" title="เลื่อนขึ้น"><ArrowUp className="h-4 w-4" /></button>
                <button onClick={() => move(i, 1)} className="rounded p-1 text-gray-400 hover:text-brand-600" title="เลื่อนลง"><ArrowDown className="h-4 w-4" /></button>
                <button
                  onClick={() => setPrizes((x) => x.filter((_, j) => j !== i))}
                  disabled={p.drawn > 0}
                  className="rounded p-1 text-gray-400 hover:text-red-500 disabled:opacity-30"
                  title={p.drawn > 0 ? "จับไปแล้ว ลบไม่ได้" : "ลบ"}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button onClick={() => setPrizes((x) => [...x, { id: null, name: "", quantity: 1, mode: "one", drawn: 0 }])} className="inline-flex items-center gap-1 text-sm text-brand-600">
            <Plus className="h-4 w-4" /> เพิ่มรางวัล
          </button>
          <button onClick={save} disabled={busy !== null || !dirty} className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
            {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />} บันทึกรางวัล
          </button>
        </div>

        <div className="mt-4 border-t border-gray-100 pt-4">
          <Link
            href={`/admin/surveys/${surveyId}/draw/`}
            target="_blank"
            aria-disabled={!ready}
            className={`inline-flex items-center gap-2 rounded-full px-6 py-3 text-base font-bold shadow transition ${
              ready ? "bg-amber-500 text-white hover:bg-amber-600" : "pointer-events-none bg-gray-200 text-gray-400"
            }`}
          >
            <Trophy className="h-5 w-5" /> เปิดจอจับรางวัล
          </Link>
          <p className="mt-1 text-xs text-gray-500">
            เปิดเป็นแท็บใหม่ ขึ้นโปรเจกเตอร์ได้ · ให้กรรมการเป็นคนกดปุ่ม (หรือกด Space)
            {dirty && " · บันทึกรางวัลก่อน"}
          </p>
        </div>
      </section>

      {/* ---------- ผลจับ ---------- */}
      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-semibold text-gray-800">ผลจับรางวัล</h2>
          {draws.length > 0 && (
            <span className="ml-auto flex flex-wrap gap-2">
              <a href={`/api/admin/surveys/${surveyId}/winners/`} className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50">
                <Download className="h-4 w-4" /> CSV (ข้อมูลเต็ม)
              </a>
              <Link href={`/admin/surveys/${surveyId}/winners/`} target="_blank" className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50">
                <Printer className="h-4 w-4" /> ใบประกาศผล (ปิดบังชื่อ)
              </Link>
            </span>
          )}
        </div>
        {draws.length === 0 ? (
          <p className="mt-3 text-sm text-gray-400">ยังไม่ได้จับ</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[44rem] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-gray-500">
                  <th className="py-2 pr-2 font-medium">รางวัล</th>
                  <th className="px-2 font-medium">ผู้โชคดี</th>
                  <th className="px-2 font-medium">ติดต่อ</th>
                  <th className="px-2 font-medium">จับเมื่อ / ผู้กด</th>
                  <th className="px-2" />
                </tr>
              </thead>
              <tbody>
                {draws.map((d) => (
                  <tr key={d.id} className={`border-b border-gray-100 ${d.voided ? "text-gray-400" : "text-gray-800"}`}>
                    <td className="py-2 pr-2">
                      {d.prizeName}
                      {d.round > 1 && <span className="ml-1 text-xs text-gray-400">(รอบ {d.round})</span>}
                    </td>
                    <td className={`px-2 ${d.voided ? "line-through" : "font-medium"}`}>
                      {d.name} <span className="text-xs text-gray-500">· {d.membNo}</span>
                      {d.voided && <span className="block text-xs text-red-500 no-underline">สละสิทธิ์: {d.voidReason}</span>}
                    </td>
                    <td className="px-2 text-xs">
                      {d.phone ?? "–"}
                      <span className="block text-gray-500">{d.department ?? ""}</span>
                    </td>
                    <td className="px-2 text-xs text-gray-500">
                      {thaiDateTime(d.drawnAt)}
                      {d.pressedBy && <span className="block">กดโดย {d.pressedBy}</span>}
                    </td>
                    <td className="px-2 text-right">
                      {!d.voided && (
                        <button onClick={() => voidDraw(d)} disabled={busy !== null} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-red-600 ring-1 ring-red-200 hover:bg-red-50 disabled:opacity-50">
                          {busy === d.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />} สละสิทธิ์
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{error}</p>}
    </div>
  );
}
