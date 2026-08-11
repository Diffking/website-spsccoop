"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Table2, BarChart3 } from "lucide-react";

/**
 * กราฟหน้าภาพรวม — วาดด้วย HTML/CSS ล้วน ไม่ต้องลง chart library
 *
 * กติกาที่ยึด: ซีรีส์เดียว = สีเดียว (ไม่ต้องมีคำอธิบายสี) · แท่งหนาไม่เกิน 24px
 * ปลายแท่งมนด้านที่โต ตัดตรงด้านฐาน · เส้นกริดบางจางอยู่หลังข้อมูล
 * ตัวหนังสือไม่ใช้สีของข้อมูล · มีปุ่มสลับดูเป็นตารางสำหรับคนที่อ่านกราฟไม่ได้
 */

const SERIES = "#1c7fca"; // brand-500 — ผ่านเกณฑ์ contrast บนพื้นขาว

const fmt = (n: number) => n.toLocaleString("th-TH");

function CardShell({
  title,
  subtitle,
  children,
  table,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  table: React.ReactNode;
}) {
  const [asTable, setAsTable] = useState(false);
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-semibold text-gray-800">{title}</h2>
          <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700 ring-1 ring-amber-200">
            ข้อมูลตัวอย่าง
          </span>
          <button
            onClick={() => setAsTable((v) => !v)}
            title={asTable ? "ดูเป็นกราฟ" : "ดูเป็นตาราง"}
            aria-label={asTable ? "ดูเป็นกราฟ" : "ดูเป็นตาราง"}
            className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
          >
            {asTable ? <BarChart3 className="h-4 w-4" /> : <Table2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="mt-5">{asTable ? table : children}</div>
    </section>
  );
}

/* ── ผู้เข้าชมรายปี — แท่งตั้ง ── */

export type YearPoint = { year: number; visitors: number };

export function VisitorsChart({ data }: { data: YearPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);

  const peak = Math.max(...data.map((d) => d.visitors));
  // ปัดเพดานขึ้นเป็นเลขกลมๆ เพื่อให้เส้นกริดอ่านง่าย
  const step = 10 ** Math.floor(Math.log10(peak)) / 2;
  const top = Math.ceil(peak / step) * step;
  const ticks = [top, top * 0.75, top * 0.5, top * 0.25, 0];
  const last = data.length - 1;

  return (
    <CardShell
      title="ผู้เข้าชมเว็บไซต์"
      subtitle="จำนวนผู้เข้าชมรายปี (ปีบัญชี พ.ศ.)"
      table={
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
              <th className="pb-2 font-medium">ปี</th>
              <th className="pb-2 text-right font-medium">ผู้เข้าชม (คน)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {data.map((d) => (
              <tr key={d.year}>
                <td className="py-2 text-gray-700">{d.year}</td>
                <td className="py-2 text-right tabular-nums text-gray-700">{fmt(d.visitors)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <div className="flex gap-3">
        {/* แกนตั้ง */}
        <div className="flex h-56 w-12 shrink-0 flex-col justify-between py-0 text-right text-[11px] tabular-nums text-gray-400">
          {ticks.map((t) => (
            <span key={t}>{fmt(t)}</span>
          ))}
        </div>

        <div className="relative min-w-0 flex-1">
          {/* เส้นกริด — อยู่หลังข้อมูล เส้นบาง 1px ไม่ประ */}
          <div className="absolute inset-x-0 top-0 h-56">
            {ticks.map((t, i) => (
              <div
                key={t}
                className="absolute inset-x-0 border-t border-gray-100"
                style={{ top: `${(i / (ticks.length - 1)) * 100}%` }}
              />
            ))}
          </div>

          <div className="relative flex h-56 items-end gap-2">
            {data.map((d, i) => {
              const pct = (d.visitors / top) * 100;
              const on = hover === i;
              return (
                <div
                  key={d.year}
                  className="group relative flex h-full flex-1 items-end justify-center"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                >
                  {/* ป้ายค่าเฉพาะแท่งล่าสุด — ไม่ติดทุกแท่งให้รก */}
                  {i === last && (
                    <span
                      className="pointer-events-none absolute z-10 text-xs font-semibold tabular-nums text-gray-700"
                      style={{ bottom: `calc(${pct}% + 8px)` }}
                    >
                      {fmt(d.visitors)}
                    </span>
                  )}

                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${pct}%` }}
                    transition={{ duration: 0.7, delay: i * 0.08, ease: "easeOut" }}
                    className="w-full max-w-6 rounded-t"
                    style={{ backgroundColor: SERIES, opacity: on ? 1 : 0.88 }}
                  />

                  {on && (
                    <div className="pointer-events-none absolute bottom-full z-20 mb-1 whitespace-nowrap rounded-lg bg-gray-900 px-2.5 py-1.5 text-[11px] text-white shadow-lg">
                      <span className="font-semibold tabular-nums">{fmt(d.visitors)}</span> คน · ปี{" "}
                      {d.year}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* แกนนอน */}
          <div className="mt-2 flex gap-2 border-t border-gray-200 pt-2">
            {data.map((d, i) => (
              <span
                key={d.year}
                className={`flex-1 text-center text-[11px] tabular-nums transition ${
                  hover === i ? "font-semibold text-gray-700" : "text-gray-400"
                }`}
              >
                {d.year}
              </span>
            ))}
          </div>
        </div>
      </div>
    </CardShell>
  );
}

/* ── หน้ายอดนิยม — แท่งนอน เรียงมากไปน้อย ── */

export type PagePoint = { page: string; views: number };

export function PopularPagesChart({ data }: { data: PagePoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const rows = [...data].sort((a, b) => b.views - a.views);
  const peak = rows[0]?.views ?? 1;

  return (
    <CardShell
      title="หน้าที่มีผู้เข้าชมมากที่สุด"
      subtitle="จำนวนครั้งที่เปิดดู ย้อนหลัง 12 เดือน"
      table={
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
              <th className="pb-2 font-medium">หน้า</th>
              <th className="pb-2 text-right font-medium">เปิดดู (ครั้ง)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.map((r) => (
              <tr key={r.page}>
                <td className="py-2 text-gray-700">{r.page}</td>
                <td className="py-2 text-right tabular-nums text-gray-700">{fmt(r.views)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <ul className="space-y-3">
        {rows.map((r, i) => (
          <li
            key={r.page}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            className="grid grid-cols-[9rem_1fr_auto] items-center gap-3"
          >
            <span
              className={`truncate text-xs transition ${
                hover === i ? "text-gray-800" : "text-gray-500"
              }`}
              title={r.page}
            >
              {r.page}
            </span>
            <span className="h-4 rounded-sm bg-gray-50">
              <motion.span
                initial={{ width: 0 }}
                animate={{ width: `${(r.views / peak) * 100}%` }}
                transition={{ duration: 0.7, delay: i * 0.07, ease: "easeOut" }}
                className="block h-4 rounded-r"
                style={{ backgroundColor: SERIES, opacity: hover === i ? 1 : 0.88 }}
              />
            </span>
            <span className="w-14 text-right text-xs font-medium tabular-nums text-gray-700">
              {fmt(r.views)}
            </span>
          </li>
        ))}
      </ul>
    </CardShell>
  );
}
