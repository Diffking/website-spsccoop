"use client";

import { useState } from "react";
import { AlertTriangle, BarChart3, CheckCircle2, ShieldAlert, Table2 } from "lucide-react";
import type { DayPoint, ScorePart, ScoreStatus } from "@/lib/securityReport";

/**
 * มิเตอร์และกราฟของหน้า "ความปลอดภัย" — HTML/CSS/SVG ล้วน (หลักเดียวกับ StatsCharts)
 *
 * สีสถานะ (เขียว/เหลือง/แดง) ใช้กับ "สถานะ" เท่านั้น และมีไอคอน + ข้อความกำกับเสมอ ไม่ให้สีบอกความหมายเดี่ยว ๆ
 * ตัวหนังสือใช้สีเทา ไม่ใช้สีของข้อมูล
 */

const STATUS: Record<ScoreStatus, { color: string; label: string; icon: typeof CheckCircle2 }> = {
  good: { color: "#0ca30c", label: "ดี", icon: CheckCircle2 },
  warning: { color: "#fab219", label: "ควรดูแล", icon: AlertTriangle },
  critical: { color: "#d03b3b", label: "ต้องแก้ไข", icon: ShieldAlert },
};

const partStatus = (p: ScorePart): ScoreStatus => {
  const pct = (p.got / p.max) * 100;
  return pct >= 80 ? "good" : pct >= 60 ? "warning" : "critical";
};

/* ── หน้าปัดคะแนนรวม ── */

export function ScoreGauge({ score, status, parts }: { score: number; status: ScoreStatus; parts: ScorePart[] }) {
  const s = STATUS[status];
  const Icon = s.icon;
  const lost = parts.filter((p) => p.max - p.got >= 0.5).sort((a, b) => b.max - b.got - (a.max - a.got));
  // ขีดแบ่งโซนบนขอบหน้าปัด (ครึ่งวงกลม ซ้าย = 0 ขวา = 100)
  const tick = (v: number) => {
    const a = Math.PI * (1 - v / 100);
    return { x1: 100 + 75 * Math.cos(a), y1: 100 - 75 * Math.sin(a), x2: 100 + 93 * Math.cos(a), y2: 100 - 93 * Math.sin(a) };
  };

  return (
    <div className="grid grid-cols-1 items-center gap-5 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
      <div className="mx-auto w-full max-w-60">
        <svg viewBox="0 0 200 112" className="w-full" role="img" aria-label={`คะแนนความปลอดภัย ${score} จาก 100 · ${s.label}`}>
          <path d="M 16 100 A 84 84 0 0 1 184 100" fill="none" stroke="#e5e7eb" strokeWidth="14" strokeLinecap="round" />
          <path
            d="M 16 100 A 84 84 0 0 1 184 100"
            fill="none"
            stroke={s.color}
            strokeWidth="14"
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray={`${Math.max(score, 0.5)} 100`}
          />
          {[60, 80].map((v) => (
            <line key={v} {...tick(v)} stroke="#ffffff" strokeWidth="2" />
          ))}
          <text x="100" y="88" textAnchor="middle" className="fill-gray-800" style={{ font: "700 40px system-ui" }}>
            {score}
          </text>
          <text x="100" y="106" textAnchor="middle" className="fill-gray-400" style={{ font: "500 10px system-ui" }}>
            จาก 100
          </text>
        </svg>
        <p className="mt-1 flex items-center justify-center gap-1.5 text-sm font-semibold text-gray-700">
          <Icon className="h-4 w-4" style={{ color: s.color }} /> {s.label}
        </p>
        <p className="mt-0.5 text-center text-[11px] text-gray-400">ต่ำกว่า 60 ต้องแก้ไข · 60–79 ควรดูแล · 80 ขึ้นไป ดี</p>
      </div>

      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-500">{lost.length ? "คะแนนที่หายไป" : "ได้คะแนนเต็มทุกเกณฑ์"}</p>
        <ul className="mt-1 grid grid-cols-1 divide-y divide-gray-50 text-sm">
          {lost.map((p) => (
            <li key={p.key} className="flex min-w-0 items-baseline justify-between gap-3 py-1.5">
              <span className="min-w-0 text-gray-700">
                {p.label} <span className="text-xs text-gray-400">· {p.reading}</span>
              </span>
              <span className="shrink-0 tabular-nums font-medium text-gray-700">−{Math.round(p.max - p.got)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ── มิเตอร์รายเกณฑ์ — หลอดค่าจริง + ขีดเกณฑ์ ── */

export function ScoreMeters({ parts }: { parts: ScorePart[] }) {
  return (
    <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {parts.map((p) => {
        const st = partStatus(p);
        const s = STATUS[st];
        const Icon = s.icon;
        const scale = Math.max(p.scaleMax, 1);
        const fill = Math.min(p.value / scale, 1) * 100;
        const mark = Math.min(p.target / scale, 1) * 100;
        return (
          <li key={p.key} className="min-w-0">
            <div className="flex min-w-0 items-baseline justify-between gap-3">
              <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-gray-800">
                <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: s.color }} aria-label={s.label} />
                <span className="truncate">{p.label}</span>
              </span>
              <span className="shrink-0 text-xs tabular-nums text-gray-500">
                {Math.round(p.got)}/{p.max} คะแนน
              </span>
            </div>
            <div className="relative mt-1.5 h-2.5 rounded-full bg-gray-100" title={`${p.reading} · ${p.note}`}>
              <div
                className="h-full rounded-full transition-[width] duration-700"
                style={{ width: `${Math.max(fill, p.value > 0 ? 2 : 0)}%`, backgroundColor: s.color }}
              />
              {/* ขีดเกณฑ์ — เส้นเทาเข้มคร่อมหลอด */}
              <span
                className="absolute -top-1 h-4.5 w-0.5 -translate-x-1/2 rounded-full bg-gray-500"
                style={{ left: `${mark}%` }}
                aria-hidden
              />
            </div>
            <div className="mt-1 flex min-w-0 justify-between gap-3 text-[11px]">
              <span className="font-medium tabular-nums text-gray-700">{p.reading}</span>
              <span className="truncate text-gray-400">{p.note}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* ── การเข้าสู่ระบบรายวัน — แท่งซ้อน 3 ชุด ── */

const SERIES = [
  { key: "ok", label: "เข้าสำเร็จ", color: "#1c7fca" },
  { key: "fail", label: "รหัส/LINE ผิด", color: "#fab219" },
  { key: "locked", label: "ถูกล็อก", color: "#d03b3b" },
] as const;

const dayFmt = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", timeZone: "UTC" });
const dayLabel = (d: string) => dayFmt.format(new Date(`${d}T00:00:00Z`));

export function DailyLoginChart({ data, since }: { data: DayPoint[]; since: string | null }) {
  const [hover, setHover] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);
  const total = (d: DayPoint) => d.ok + d.fail + d.locked;
  const peak = Math.max(...data.map(total), 0);
  const top = peak <= 4 ? 4 : Math.ceil(peak / 4) * 4;
  const ticks = [top, top / 2, 0];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
          {SERIES.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.color }} /> {s.label}
            </span>
          ))}
        </div>
        <button
          onClick={() => setAsTable((v) => !v)}
          title={asTable ? "ดูเป็นกราฟ" : "ดูเป็นตาราง"}
          aria-label={asTable ? "ดูเป็นกราฟ" : "ดูเป็นตาราง"}
          className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
        >
          {asTable ? <BarChart3 className="h-4 w-4" /> : <Table2 className="h-4 w-4" />}
        </button>
      </div>

      {peak === 0 ? (
        <p className="mt-3 grid place-items-center rounded-xl bg-gray-50 py-10 text-center text-sm text-gray-400">
          ยังไม่มีการเข้าสู่ระบบใน 30 วันนี้{since ? ` · เริ่มเก็บเมื่อ ${since}` : " · เริ่มเก็บตั้งแต่ 28 ต.ค. 2569"}
        </p>
      ) : asTable ? (
        <div className="mt-3 max-h-72 overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                <th className="pb-2 font-medium">วัน</th>
                {SERIES.map((s) => (
                  <th key={s.key} className="pb-2 text-right font-medium">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {[...data].reverse().filter((d) => total(d) > 0).map((d) => (
                <tr key={d.day}>
                  <td className="py-1.5 text-gray-700">{dayLabel(d.day)}</td>
                  {SERIES.map((s) => (
                    <td key={s.key} className="py-1.5 text-right tabular-nums text-gray-700">
                      {d[s.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          <div className="flex h-40 w-6 shrink-0 flex-col justify-between text-right text-[11px] tabular-nums text-gray-400">
            {ticks.map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
          <div className="relative min-w-0 flex-1">
            <div className="absolute inset-x-0 top-0 h-40">
              {ticks.map((t, i) => (
                <div key={t} className="absolute inset-x-0 border-t border-gray-100" style={{ top: `${(i / (ticks.length - 1)) * 100}%` }} />
              ))}
            </div>
            <div className="relative flex h-40 items-end gap-0.5">
              {data.map((d, i) => {
                const sum = total(d);
                const on = hover === i;
                return (
                  <div
                    key={d.day}
                    className="relative flex h-full min-w-0 flex-1 items-end justify-center"
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(null)}
                  >
                    {on && <div className="absolute inset-0 rounded bg-gray-100/70" />}
                    {sum > 0 && (
                      <div
                        className="relative flex w-full max-w-3 flex-col-reverse gap-0.5 overflow-hidden rounded-t"
                        style={{ height: `${(sum / top) * 100}%` }}
                      >
                        {SERIES.map((s) =>
                          d[s.key] > 0 ? (
                            <div key={s.key} style={{ flexGrow: d[s.key], flexBasis: 0, minHeight: 2, backgroundColor: s.color }} />
                          ) : null,
                        )}
                      </div>
                    )}
                    {on && (
                      <div
                        className={`pointer-events-none absolute bottom-full z-20 mb-1 whitespace-nowrap rounded-lg bg-gray-900 px-2.5 py-1.5 text-[11px] text-white shadow-lg ${
                          i > data.length / 2 ? "right-0" : "left-0"
                        }`}
                      >
                        <p className="font-semibold">{dayLabel(d.day)}</p>
                        {SERIES.map((s) => (
                          <p key={s.key} className="flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: s.color }} />
                            {s.label} <span className="ml-auto pl-3 tabular-nums font-semibold">{d[s.key]}</span>
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-1.5 flex justify-between border-t border-gray-200 pt-1.5 text-[11px] text-gray-400">
              <span>{dayLabel(data[0].day)}</span>
              <span>{dayLabel(data[Math.floor(data.length / 2)].day)}</span>
              <span>วันนี้</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
