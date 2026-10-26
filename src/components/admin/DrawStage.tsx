"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Fingerprint, Gift, Loader2, RefreshCw, Sparkles, Trophy, Users } from "lucide-react";

type Prize = { id: string; name: string; mode: string; quantity: number; remaining: number };
type Winner = { id: string; membNo: string; name: string; phone: string | null; department: string | null };

/**
 * จอจับรางวัลสำหรับขึ้นโปรเจกเตอร์ในงาน — เต็มจอทับเมนูหลังบ้าน
 *
 * ⚠️ ผลถูกตัดสินที่เซิร์ฟเวอร์ทันทีที่กด (POST /draw) ชื่อที่วิ่งเป็นแค่การแสดงผล
 * — ชื่อวิ่งสุ่มด้วย Math.random() ได้ เพราะไม่เกี่ยวกับผลเลย · รีเฟรชหน้าก็ไม่ได้สุ่มใหม่
 *
 * กรรมการตัวจริงเป็นคนกด (เจ้าของเว็บเลือก 26 ต.ค. 2569) — ปุ่มใหญ่ · กด Space/Enter ได้
 * · พิมพ์ชื่อผู้กดไว้ด้านบน ระบบบันทึกคู่กับผลทุกครั้ง
 */
export default function DrawStage({
  surveyId,
  title,
  coopName,
  round,
  prizes,
  poolHash,
  fingerprint,
  poolSize,
  names,
  blockers,
}: {
  surveyId: string;
  title: string;
  coopName: string;
  round: number;
  prizes: Prize[];
  poolHash: string;
  fingerprint: string;
  poolSize: number;
  /** ชื่อผู้มีสิทธิ์ไว้ทำชื่อวิ่ง — ไม่มีผลกับการสุ่ม */
  names: string[];
  blockers: string[];
}) {
  /*
   * ค่าที่เปลี่ยนหลังจับแต่ละครั้ง (คงเหลือ · ลายนิ้วมือ · ผู้มีสิทธิ์) — ขอใหม่ผ่าน GET /draw
   * ไม่โหลดหน้าใหม่ เพราะหน้าตรวจซ้ำกับทะเบียนทั้งชุดตอนเปิด ทำทุกครั้งที่กดจับไม่ไหว
   */
  const [live, setLive] = useState({ prizes, poolHash, fingerprint, poolSize, blockers });
  const firstOpen = prizes.find((p) => p.remaining > 0)?.id ?? prizes[0]?.id ?? "";
  const [prizeId, setPrizeId] = useState(firstOpen);
  const [pressedBy, setPressedBy] = useState("");
  const [phase, setPhase] = useState<"idle" | "rolling" | "result">("idle");
  const [reel, setReel] = useState<string[]>([]);
  const [winners, setWinners] = useState<Winner[]>([]);
  const [revealed, setRevealed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const timers = useRef<number[]>([]);

  const prize = live.prizes.find((p) => p.id === prizeId) ?? live.prizes[0];
  const batch = prize?.mode === "batch";
  const canDraw =
    live.blockers.length === 0 && !!prize && prize.remaining > 0 && live.poolSize > 0 && phase !== "rolling" && !stale;

  const randomName = () => names[Math.floor(Math.random() * names.length)] ?? "…";
  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  async function draw() {
    if (!canDraw || !prize) return;
    setError(null);
    setWinners([]);
    setRevealed(0);
    setPhase("rolling");
    const slots = batch ? Math.min(prize.remaining, live.poolSize) : 1;

    // ชื่อวิ่งเร็ว ๆ ระหว่างรอผล — ไม่มีความหมายกับผล
    const spin = window.setInterval(() => setReel(Array.from({ length: slots }, randomName)), 70);
    const started = Date.now();

    const r = await fetch(`/api/admin/surveys/${surveyId}/draw/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prizeId: prize.id, poolHash: live.poolHash, pressedBy }),
    }).catch(() => null);
    const data = r ? await r.json().catch(() => ({})) : { error: "เชื่อมต่อไม่ได้" };

    if (!r || !r.ok) {
      window.clearInterval(spin);
      setPhase("idle");
      setError(data.error ?? "จับไม่สำเร็จ");
      if (data.stale) setStale(true);
      return;
    }

    const got: Winner[] = data.winners;
    // ลุ้นอย่างน้อย ~2.8 วิ แล้วค่อย ๆ ช้าลงจนหยุดที่ผู้โชคดี
    const wait = Math.max(0, 2800 - (Date.now() - started));
    timers.current.push(
      window.setTimeout(() => {
        window.clearInterval(spin);
        const steps = [90, 120, 160, 210, 270, 340, 420];
        let t = 0;
        steps.forEach((ms) => {
          t += ms;
          timers.current.push(window.setTimeout(() => setReel(Array.from({ length: got.length }, randomName)), t));
        });
        timers.current.push(
          window.setTimeout(() => {
            setWinners(got);
            setPhase("result");
            // ทั้งชุด: เปิดทีละใบ ไล่จากซ้ายไปขวา
            got.forEach((_, i) => timers.current.push(window.setTimeout(() => setRevealed(i + 1), i * 160)));
            // ลายนิ้วมือ/จำนวนคงเหลือชุดใหม่ (ผู้โชคดีออกจากกองแล้ว)
            fetch(`/api/admin/surveys/${surveyId}/draw/`)
              .then((res) => (res.ok ? res.json() : null))
              .then((next) => next && setLive(next))
              .catch(() => setStale(true));
          }, t + 450),
        );
      }, wait),
    );
  }

  // Space / Enter = กดจับ (ยกเว้นตอนพิมพ์ชื่อผู้กดอยู่)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        document.getElementById("draw-button")?.click();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="fixed inset-0 z-60 overflow-y-auto bg-linear-to-br from-brand-900 via-brand-800 to-indigo-900 text-white">
      <div className="mx-auto flex min-h-full max-w-6xl flex-col px-6 py-6">
        {/* ---------- หัว ---------- */}
        <header className="flex flex-wrap items-start gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm text-white/70">{coopName}</p>
            <h1 className="text-2xl font-bold sm:text-3xl">จับรางวัล · {title}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/80">
              <span className="inline-flex items-center gap-1"><Users className="h-4 w-4" /> ผู้มีสิทธิ์ {live.poolSize.toLocaleString("th-TH")} คน</span>
              <span className="inline-flex items-center gap-1" title="เปลี่ยนเมื่อรายชื่อเปลี่ยนแม้แต่คนเดียว">
                <Fingerprint className="h-4 w-4" /> ลายนิ้วมือรายชื่อ <b className="font-mono tracking-wider">{live.fingerprint}</b>
              </span>
              {round > 1 && <span>รอบที่ {round}</span>}
            </p>
          </div>
          <label className="w-full max-w-xs text-sm">
            <span className="text-white/70">ผู้กดจับ (กรรมการ)</span>
            <input
              value={pressedBy}
              onChange={(e) => setPressedBy(e.target.value)}
              placeholder="พิมพ์ชื่อ-ตำแหน่ง ระบบบันทึกไว้คู่ผล"
              className="mt-1 w-full rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-white placeholder:text-white/40 outline-none focus:border-white/60"
            />
          </label>
        </header>

        {/* ---------- เลือกรางวัล ---------- */}
        <nav className="mt-5 flex flex-wrap gap-2">
          {live.prizes.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                if (phase === "rolling") return;
                setPrizeId(p.id);
                setPhase("idle");
                setWinners([]);
              }}
              className={`rounded-full px-4 py-2 text-sm ring-1 transition ${
                p.id === prize?.id ? "bg-white text-brand-900 ring-white" : "bg-white/5 text-white/80 ring-white/20 hover:bg-white/15"
              } ${p.remaining === 0 ? "opacity-50" : ""}`}
            >
              {p.name} <span className="ml-1 text-xs opacity-70">เหลือ {p.remaining}/{p.quantity}</span>
            </button>
          ))}
        </nav>

        {/* ---------- เวที ---------- */}
        <main className="flex flex-1 flex-col items-center justify-center py-8 text-center">
          {prize && (
            <p className="flex items-center gap-2 text-2xl font-semibold text-amber-300 sm:text-3xl">
              <Gift className="h-8 w-8" /> {prize.name}
              {batch && <span className="text-base text-white/70">(จับทั้งชุด {Math.min(prize.remaining, live.poolSize)} รางวัล)</span>}
            </p>
          )}

          {phase === "idle" && (
            <p className="mt-6 text-lg text-white/60">{prize?.remaining ? "พร้อมจับ — กดปุ่มด้านล่าง หรือกด Space" : "รางวัลนี้จับครบแล้ว เลือกรางวัลอื่นด้านบน"}</p>
          )}

          {phase === "rolling" && (
            <div className={`mt-8 grid w-full gap-3 ${batch ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" : "grid-cols-1"}`}>
              {reel.map((n, i) => (
                <div key={i} className={`rounded-2xl bg-white/10 px-4 ring-1 ring-white/20 ${batch ? "py-4 text-lg" : "py-10 text-5xl font-bold sm:text-6xl"}`}>
                  <span className="block truncate opacity-90">{n}</span>
                </div>
              ))}
            </div>
          )}

          {phase === "result" && (
            <div className={`mt-8 grid w-full gap-4 ${winners.length > 1 ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"}`}>
              {winners.map((w, i) => (
                <div
                  key={w.id}
                  className={`rounded-3xl bg-white text-gray-900 shadow-2xl transition duration-500 ${i < revealed ? "scale-100 opacity-100" : "scale-90 opacity-0"} ${
                    winners.length > 1 ? "p-4 text-left" : "mx-auto w-full max-w-3xl p-8"
                  }`}
                >
                  {winners.length === 1 && (
                    <p className="flex items-center justify-center gap-2 text-lg font-semibold text-amber-600">
                      <Sparkles className="h-5 w-5" /> ยินดีด้วย <Sparkles className="h-5 w-5" />
                    </p>
                  )}
                  <p className={`font-bold text-brand-900 ${winners.length > 1 ? "text-lg" : "mt-2 text-4xl sm:text-5xl"}`}>{w.name}</p>
                  <p className={`mt-2 text-gray-600 ${winners.length > 1 ? "text-sm" : "text-xl"}`}>
                    เลขที่สมาชิก <b className="text-gray-900">{w.membNo}</b> · โทร <b className="text-gray-900">{w.phone ?? "–"}</b>
                  </p>
                  <p className={`text-gray-600 ${winners.length > 1 ? "text-sm" : "text-xl"}`}>{w.department ?? ""}</p>
                </div>
              ))}
            </div>
          )}

          {error && (
            <p className="mt-6 flex items-center gap-2 rounded-xl bg-red-500/20 px-4 py-2 text-red-100 ring-1 ring-red-300/40">
              <AlertTriangle className="h-5 w-5" /> {error}
              {stale && (
                <button onClick={() => window.location.reload()} className="ml-2 inline-flex items-center gap-1 rounded-lg bg-white/20 px-2 py-1 text-sm">
                  <RefreshCw className="h-4 w-4" /> โหลดใหม่
                </button>
              )}
            </p>
          )}
          {live.blockers.length > 0 && (
            <p className="mt-6 rounded-xl bg-amber-500/20 px-4 py-2 text-amber-100 ring-1 ring-amber-300/40">ยังจับไม่ได้ — {live.blockers[0]}</p>
          )}
        </main>

        <footer className="flex flex-col items-center gap-2 pb-4">
          <button
            id="draw-button"
            onClick={draw}
            disabled={!canDraw}
            className="grid h-40 w-40 place-items-center rounded-full bg-amber-400 text-2xl font-extrabold text-brand-900 shadow-[0_0_60px_rgba(251,191,36,0.55)] ring-8 ring-amber-200/40 transition hover:scale-105 active:scale-95 disabled:scale-100 disabled:bg-white/20 disabled:text-white/50 disabled:shadow-none sm:h-48 sm:w-48"
          >
            {phase === "rolling" ? <Loader2 className="h-12 w-12 animate-spin" /> : <span className="flex flex-col items-center gap-1"><Trophy className="h-10 w-10" /> กดจับรางวัล</span>}
          </button>
          <p className="mt-4 text-xs text-white/50">ผลสุ่มตัดสินที่เซิร์ฟเวอร์ทันทีที่กด · ทุกคนโอกาสเท่ากัน · ชื่อที่วิ่งเป็นการแสดงผลเท่านั้น</p>
        </footer>
      </div>
    </div>
  );
}
