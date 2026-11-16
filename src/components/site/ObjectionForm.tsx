"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Send } from "lucide-react";
import { challengeOf, proofTime, solvePow } from "@/lib/botGuard";
import { DETAIL_MAX, agendaLabel, thaiDateTime, type Agenda } from "@/lib/objection";

const inputCls =
  "mt-1 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

/**
 * ฟอร์มคำทักท้วง — เลขที่สมาชิก · ชื่อ-นามสกุล · ระเบียบวาระที่ · รายละเอียดที่ต้องการแก้ไข
 * ติ๊กวาระไหน ช่องรายละเอียดของวาระนั้นถึงโผล่ · ส่งแล้วแก้เองไม่ได้ (ติดต่อสหกรณ์)
 */
export default function ObjectionForm({ roundId, agendas }: { roundId: string; agendas: Agenda[] }) {
  const [membNo, setMembNo] = useState("");
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<Record<number, string>>({});
  const [trap, setTrap] = useState("");
  const [startedAt] = useState(proofTime);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneAt, setDoneAt] = useState<string | null>(null);

  const chosen = Object.keys(picked).map(Number).sort((a, b) => a - b);
  const ready =
    /^\d{1,8}$/.test(membNo.replace(/\D/g, "")) &&
    name.replace(/\s+/g, " ").trim().length >= 3 &&
    chosen.length > 0 &&
    chosen.every((no) => picked[no].trim().length >= 3);

  function toggle(no: number) {
    setPicked((p) => {
      const next = { ...p };
      if (no in next) delete next[no];
      else next[no] = "";
      return next;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    const digits = membNo.replace(/\D/g, "");
    const ts = proofTime();
    let nonce: number;
    try {
      nonce = await solvePow(challengeOf(roundId, digits, ts));
    } catch {
      setBusy(false);
      setError("เบราว์เซอร์นี้ส่งไม่ได้ กรุณาลองเปิดด้วย Chrome หรือ Safari รุ่นใหม่");
      return;
    }
    let data: Record<string, unknown> | null = null;
    let ok = false;
    try {
      const res = await fetch("/api/objection/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roundId,
          membNo: digits,
          name,
          items: chosen.map((no) => ({ no, detail: picked[no] })),
          bot: { ts, nonce, startedAt, hp: trap },
        }),
      });
      ok = res.ok;
      data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    } catch {
      setBusy(false);
      setError("เชื่อมต่อไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่ · ข้อมูลที่กรอกยังอยู่");
      return;
    }
    setBusy(false);
    if (!data) {
      // ตัวมิเรอร์ .com ตอบเปล่า = เครื่องสำนักงานปิดอยู่ ยังไม่ได้บันทึก
      setError("ขณะนี้ระบบรับคำทักท้วงไม่ได้ชั่วคราว กรุณาส่งใหม่ในวันและเวลาทำการ · ข้อมูลที่กรอกยังอยู่");
      return;
    }
    if (ok) {
      setDoneAt(String(data.at ?? new Date().toISOString()));
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setError(String(data.error ?? "ส่งไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"));
  }

  if (doneAt) {
    return (
      <div className="rounded-2xl bg-white px-6 py-10 text-center shadow-sm ring-1 ring-black/5">
        <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" aria-hidden="true" />
        <h2 className="mt-3 text-xl font-bold text-gray-800">สหกรณ์ได้รับคำทักท้วงของท่านแล้ว</h2>
        <p className="mt-2 text-sm text-gray-600">
          เลขที่สมาชิก {membNo.replace(/\D/g, "")} · {name.replace(/\s+/g, " ").trim()}
        </p>
        <p className="mt-1 text-sm text-gray-600">
          ระเบียบวาระที่ {chosen.join(", ")} · ส่งเมื่อ {thaiDateTime(doneAt)}
        </p>
        <p className="mt-4 text-xs text-gray-500">หากต้องการแก้ไขคำทักท้วง กรุณาติดต่อสหกรณ์</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="relative space-y-5 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5 md:p-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-semibold text-gray-700">เลขที่สมาชิก</span>
          <input
            value={membNo}
            onChange={(e) => setMembNo(e.target.value)}
            inputMode="numeric"
            autoComplete="off"
            maxLength={10}
            placeholder="เช่น 07337"
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-gray-700">ชื่อ-นามสกุล</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            maxLength={120}
            placeholder="เช่น นายสมชาย ใจดี"
            className={inputCls}
          />
        </label>
      </div>

      {/* ช่องดักบอท — ซ่อนจากคนและโปรแกรมอ่านหน้าจอ บอทที่กรอกทุกช่องจะติดตรงนี้ */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          เว็บไซต์
          <input tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} />
        </label>
      </div>

      <fieldset>
        <legend className="text-sm font-semibold text-gray-700">ระเบียบวาระที่ต้องการทักท้วง</legend>
        <p className="mt-0.5 text-xs text-gray-500">เลือกได้มากกว่าหนึ่งวาระ · ใส่รายละเอียดที่ต้องการแก้ไขของแต่ละวาระ</p>
        <div className="mt-3 grid grid-cols-1 gap-2">
          {agendas.map((a) => {
            const on = a.no in picked;
            return (
              <div
                key={a.no}
                className={`min-w-0 rounded-xl ring-1 transition ${on ? "bg-brand-50/60 ring-brand-300" : "ring-gray-200"}`}
              >
                <label className="flex min-h-12 cursor-pointer items-center gap-3 px-4 py-3">
                  <input type="checkbox" checked={on} onChange={() => toggle(a.no)} className="h-5 w-5 shrink-0" />
                  <span className="min-w-0 text-sm font-medium text-gray-800">{agendaLabel(a)}</span>
                </label>
                {on && (
                  <label className="block px-4 pb-4">
                    <span className="text-xs text-gray-600">รายละเอียดที่ต้องการแก้ไข</span>
                    <textarea
                      value={picked[a.no]}
                      onChange={(e) => setPicked((p) => ({ ...p, [a.no]: e.target.value }))}
                      rows={4}
                      maxLength={DETAIL_MAX}
                      className={`${inputCls} resize-y`}
                    />
                  </label>
                )}
              </div>
            );
          })}
        </div>
      </fieldset>

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </p>
      )}

      <button
        type="submit"
        disabled={!ready || busy}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 font-semibold text-white shadow transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
        {busy ? "กำลังตรวจสอบความปลอดภัยและส่ง…" : "ส่งคำทักท้วง"}
      </button>
      <p className="text-center text-xs text-gray-500">ส่งได้เลขที่สมาชิกละ 1 ครั้ง · สหกรณ์ใช้ข้อมูลนี้เพื่อพิจารณาคำทักท้วงเท่านั้น</p>
    </form>
  );
}
