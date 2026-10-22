/**
 * กราฟผลแบบประเมิน — HTML/CSS ล้วน ไม่มี chart library (หลักเดียวกับ StatsCharts)
 * ไม่มี "use client" — วาดฝั่งเซิร์ฟเวอร์ได้ ใช้ร่วมทั้ง Dashboard ลิงก์กรรมการ และรายงาน PDF
 *
 * สี:
 *   ซีรีส์เดียว (จำนวนคน · ค่าเฉลี่ย) = สีเดียว #1c7fca แบบหน้าสถิติเดิม
 *   ระดับความพึงพอใจ 5 ระดับ = สองขั้ว แดง (น้อย) · เทา (ปานกลาง) · น้ำเงิน (มาก)
 *   ช่อง "ไม่ประเมิน" = ลายเส้นเทา ให้เห็นว่าไม่ใช่ระดับคะแนน
 *   สีอ่อนบางสีคอนทราสต์กับพื้นต่ำ — ชดเชยด้วยตัวเลข % กำกับในแท่ง + ตารางในรายงาน
 * ตัวหนังสือใช้สีเทาเข้มเสมอ ไม่ใช้สีของแท่ง · ชี้เมาส์ที่แท่งเห็นตัวเลขเต็ม (title)
 */

import type { ItemReport, Report, Stat } from "@/lib/surveyReport";

const BRAND = "#1c7fca";
/** สีระดับ เรียงจากคะแนนสูงไปต่ำ (5 → 1) */
const LEVEL = ["#256abf", "#86b6ef", "#cfcdc8", "#f19a98", "#d63c3b"];
const NA_FILL =
  "repeating-linear-gradient(45deg, #e7e5e0 0 4px, #f6f5f2 4px 8px)";

const fmt = (v: number | null, d = 2) => (v === null ? "–" : v.toFixed(d));
const pct = (part: number, whole: number) => (whole ? (part / whole) * 100 : 0);
const pctText = (part: number, whole: number) => `${pct(part, whole).toFixed(1)}%`;

/** สีของคอลัมน์ตามลำดับ — คอลัมน์แรก = คะแนนสูงสุด (เรียงแบบฟอร์มราชการ 5 → 1) */
function levelColor(index: number, count: number): string {
  if (count === 5) return LEVEL[index];
  // สเกลอื่น: เกลี่ยตำแหน่งลงบน 5 สี
  return LEVEL[Math.round((index / Math.max(1, count - 1)) * 4)];
}

export function LevelBadge({ s }: { s: Stat }) {
  if (!s.level) return null;
  return <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700">{s.level}</span>;
}

/* --------------------------------------------------------------- ตัวเลข */

export function KpiTiles({ report }: { report: Report }) {
  const ranked = report.aspects.filter((a) => a.overall.mean !== null).sort((a, b) => b.overall.mean! - a.overall.mean!);
  const best = ranked[0];
  const worst = ranked[ranked.length - 1];
  const tile = "rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5";
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className={tile}>
        <p className="text-xs text-gray-500">ผู้ตอบ (ตรวจแล้ว)</p>
        <p className="mt-1 text-3xl font-bold text-gray-900">{report.n.toLocaleString("th-TH")}</p>
        <p className="text-xs text-gray-400">คน</p>
      </div>
      <div className={tile}>
        <p className="text-xs text-gray-500">ความพึงพอใจเฉลี่ยรวม</p>
        <p className="mt-1 text-3xl font-bold text-gray-900">
          {fmt(report.overall.mean)} <span className="text-base font-normal text-gray-400">/ 5</span>
        </p>
        <p className="text-xs text-gray-500">
          S.D. {fmt(report.overall.sd)} · <LevelBadge s={report.overall} />
        </p>
      </div>
      <div className={tile}>
        <p className="text-xs text-gray-500">ด้านที่คะแนนสูงสุด</p>
        <p className="mt-1 line-clamp-2 text-sm font-semibold text-gray-900">{best?.title ?? "–"}</p>
        <p className="text-xs text-gray-500">{best ? `${fmt(best.overall.mean)} · ${best.overall.level ?? ""}` : ""}</p>
      </div>
      <div className={tile}>
        <p className="text-xs text-gray-500">ด้านที่ควรพัฒนา (คะแนนต่ำสุด)</p>
        <p className="mt-1 line-clamp-2 text-sm font-semibold text-gray-900">{worst && worst !== best ? worst.title : "–"}</p>
        <p className="text-xs text-gray-500">
          {worst && worst !== best ? `${fmt(worst.overall.mean)} · ${worst.overall.level ?? ""}` : ""}
        </p>
      </div>
    </div>
  );
}

/* ---------------------------------------------------- ค่าเฉลี่ย (แท่งนอน) */

/** แท่งค่าเฉลี่ยบนสเกล 1–5 — ใช้เทียบด้าน และเทียบหัวข้อย่อยในด้านเดียวกัน */
export function MeanBars({
  rows,
  sortLowFirst = false,
}: {
  rows: { label: string; s: Stat; note?: string }[];
  sortLowFirst?: boolean;
}) {
  const list = sortLowFirst
    ? [...rows].sort((a, b) => (a.s.mean ?? 99) - (b.s.mean ?? 99))
    : rows;
  return (
    <ul className="space-y-2">
      {list.map((r) => (
        <li key={r.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 sm:grid-cols-[minmax(0,16rem)_minmax(0,1fr)_7.5rem]">
          <span className="min-w-0 text-sm text-gray-700 sm:truncate" title={r.label}>
            {r.label}
          </span>
          <span
            className="relative order-last col-span-2 h-3 rounded-full bg-gray-100 sm:order-none sm:col-span-1"
            title={`${r.label}: ค่าเฉลี่ย ${fmt(r.s.mean)} · S.D. ${fmt(r.s.sd)} · ${r.s.n} คำตอบ`}
          >
            {r.s.mean !== null && (
              <span
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ width: `${((r.s.mean - 1) / 4) * 100}%`, background: BRAND, minWidth: 4 }}
              />
            )}
          </span>
          <span className="text-right text-sm tabular-nums text-gray-900">
            <b>{fmt(r.s.mean)}</b>
            <span className="ml-1 text-[11px] text-gray-500">{r.s.level ?? ""}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/* -------------------------------------------------- รายวัน (แท่งตั้ง) */

export function DailyBars({ daily }: { daily: { date: string; count: number }[] }) {
  if (daily.length === 0) return <p className="text-sm text-gray-400">ยังไม่มีผู้ตอบ</p>;
  const max = Math.max(...daily.map((d) => d.count));
  const label = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return `${d}/${m}/${String(y + 543).slice(2)}`;
  };
  return (
    <div>
      <div className="flex h-36 items-end gap-[2px]">
        {daily.map((d) => (
          <div key={d.date} className="group relative flex h-full min-w-0 flex-1 items-end" title={`${label(d.date)}: ${d.count} คน`}>
            <div className="w-full rounded-t" style={{ height: `${(d.count / max) * 100}%`, background: BRAND, minHeight: 4 }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-gray-500">
        <span>{label(daily[0].date)}</span>
        <span>สูงสุด {max} คน/วัน</span>
        <span>{label(daily[daily.length - 1].date)}</span>
      </div>
    </div>
  );
}

/* --------------------------------------------- การกระจาย 5 ระดับ (แท่งซ้อน) */

function LikertBar({ dist, na, columns, naLabel }: { dist: number[]; na: number; columns: { label: string }[]; naLabel: string | null }) {
  const total = dist.reduce((a, b) => a + b, 0) + na;
  if (!total) return <div className="h-5 rounded bg-gray-100" />;
  return (
    <div className="flex h-5 gap-[2px] overflow-hidden rounded">
      {dist.map((c, i) =>
        c ? (
          <div
            key={i}
            className="grid min-w-0 place-items-center text-[10px] font-medium"
            style={{ width: `${pct(c, total)}%`, background: levelColor(i, dist.length), color: i === 0 || i === dist.length - 1 ? "#fff" : "#1f2937" }}
            title={`${columns[i].label}: ${c} คน (${pctText(c, total)})`}
          >
            {pct(c, total) >= 9 ? pctText(c, total).replace(".0", "") : ""}
          </div>
        ) : null,
      )}
      {na > 0 && (
        <div
          className="grid min-w-0 place-items-center text-[10px] text-gray-600"
          style={{ width: `${pct(na, total)}%`, background: NA_FILL }}
          title={`${naLabel ?? "ไม่ประเมิน"}: ${na} คน (${pctText(na, total)}) — ไม่นำไปคิดค่าเฉลี่ย`}
        >
          {pct(na, total) >= 12 ? pctText(na, total).replace(".0", "") : ""}
        </div>
      )}
    </div>
  );
}

function LikertLegend({ columns, naLabel }: { columns: { label: string; score: number }[]; naLabel: string | null }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-600">
      {columns.map((c, i) => (
        <span key={c.label} className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: levelColor(i, columns.length) }} />
          {c.score} {c.label}
        </span>
      ))}
      {naLabel && (
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: NA_FILL }} /> {naLabel} (ไม่นับค่าเฉลี่ย)
        </span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ รายข้อ */

export function ItemCard({ item, hideTexts = false }: { item: ItemReport; hideTexts?: boolean }) {
  const head = (
    <h3 className="text-[15px] font-semibold text-gray-800">
      {item.number !== null && <span className="mr-1 text-brand-600">{item.number}.</span>}
      {item.title}
    </h3>
  );

  if (item.kind === "grid") {
    // หัวข้อย่อยเรียงจากคะแนนต่ำไปสูง — ข้อที่ต้องแก้อยู่บนสุด (ตกลงกับเจ้าของเว็บไว้ในแผนเฟส 5)
    const rows = [...item.rows].sort((a, b) => (a.mean ?? 99) - (b.mean ?? 99));
    return (
      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        {head}
        <p className="mt-1 text-xs text-gray-500">
          ภาพรวม <b className="text-gray-800">{fmt(item.overall.mean)}</b> (S.D. {fmt(item.overall.sd)}) <LevelBadge s={item.overall} /> ·
          ผู้ตอบ {item.respondents} คน
          {item.naLabel && item.naRespondents > 0 && (
            <> · <b className="text-gray-700">{pctText(item.naRespondents, item.respondents)}</b> เลือก &quot;{item.naLabel}&quot; ทุกหัวข้อ</>
          )}
        </p>
        <div className="mt-3">
          <LikertLegend columns={item.columns} naLabel={item.naLabel} />
        </div>
        <ul className="mt-3 space-y-2.5">
          {rows.map((r) => (
            <li key={r.id}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 text-gray-700">{r.label}</span>
                <span className="shrink-0 tabular-nums text-gray-900">
                  <b>{fmt(r.mean)}</b> <span className="text-[11px] text-gray-500">{r.level ?? ""}</span>
                </span>
              </div>
              <div className="mt-1">
                <LikertBar dist={r.dist} na={r.na} columns={item.columns} naLabel={item.naLabel} />
              </div>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  if (item.kind === "choice") {
    const max = Math.max(1, ...item.options.map((o) => o.count), item.other?.count ?? 0);
    const rows = [...item.options.map((o) => ({ label: o.label, count: o.count })), ...(item.other ? [{ label: "อื่น ๆ", count: item.other.count }] : [])];
    return (
      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        {head}
        <p className="mt-1 text-xs text-gray-500">
          ผู้ตอบ {item.respondents} คน{item.multi ? " · เลือกได้หลายข้อ (รวมเกิน 100% ได้)" : ""}
        </p>
        <ul className="mt-3 space-y-1.5">
          {rows.map((o) => (
            <li key={o.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_6.5rem]">
              <span className="min-w-0 text-sm text-gray-700">{o.label}</span>
              <span className="order-last col-span-2 h-2.5 rounded-full bg-gray-100 sm:order-none sm:col-span-1" title={`${o.label}: ${o.count} คน (${pctText(o.count, item.respondents)})`}>
                <span className="block h-full rounded-full" style={{ width: `${(o.count / max) * 100}%`, background: BRAND, minWidth: o.count ? 4 : 0 }} />
              </span>
              <span className="text-right text-sm tabular-nums text-gray-900">
                {o.count} <span className="text-[11px] text-gray-500">({pctText(o.count, item.respondents)})</span>
              </span>
            </li>
          ))}
        </ul>
        {!hideTexts && item.other && item.other.texts.length > 0 && (
          <details className="mt-2 text-xs text-gray-600">
            <summary className="cursor-pointer text-brand-700">ดูที่ระบุใน &quot;อื่น ๆ&quot; ({item.other.texts.length})</summary>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {item.other.texts.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </details>
        )}
      </section>
    );
  }

  if (item.kind === "scale") {
    const total = item.dist.reduce((a, b) => a + b, 0);
    return (
      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        {head}
        <p className="mt-1 text-xs text-gray-500">
          ค่าเฉลี่ย <b className="text-gray-800">{fmt(item.overall.mean)}</b> (S.D. {fmt(item.overall.sd)}) <LevelBadge s={item.overall} /> · ผู้ตอบ {total} คน
        </p>
        <div className="mt-3 flex h-24 items-end gap-[2px]">
          {item.dist.map((c, i) => (
            <div key={i} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end" title={`${item.min + i}: ${c} คน (${pctText(c, total)})`}>
              <span className="text-[10px] text-gray-600">{c}</span>
              <div className="w-full rounded-t" style={{ height: `${pct(c, Math.max(1, ...item.dist))}%`, background: BRAND, minHeight: c ? 4 : 0 }} />
              <span className="mt-1 text-[11px] text-gray-500">{item.min + i}</span>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (hideTexts) return null;
  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      {head}
      <p className="mt-1 text-xs text-gray-500">{item.texts.length} คำตอบ</p>
      {item.texts.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-sm text-brand-700">ดูคำตอบทั้งหมด</summary>
          <ul className="mt-2 max-h-80 space-y-1.5 overflow-y-auto pr-1">
            {item.texts.map((t, i) => (
              <li key={i} className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">
                {t}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

/* --------------------------------------------------------- เทียบกลุ่ม */

export function BreakdownTable({
  data,
}: {
  data: { label: string; aspectTitles: string[]; groups: { label: string; n: number; overall: Stat; aspects: Stat[] }[] };
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
            <th className="py-2 pr-3 font-medium">{data.label}</th>
            <th className="px-2 py-2 text-right font-medium">คน</th>
            <th className="px-2 py-2 text-right font-medium">รวม</th>
            {data.aspectTitles.map((t) => (
              <th key={t} className="px-2 py-2 text-right font-medium" title={t}>
                <span className="line-clamp-2 max-w-[7rem] text-right">{t.replace(/^ด้าน/, "")}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.groups.map((g) => (
            <tr key={g.label} className="border-b border-gray-100">
              <td className="py-2 pr-3 text-gray-800">{g.label}</td>
              <td className="px-2 py-2 text-right tabular-nums text-gray-600">{g.n}</td>
              <td className="px-2 py-2 text-right font-semibold tabular-nums text-gray-900" title={g.overall.level ?? ""}>
                {fmt(g.overall.mean)}
              </td>
              {g.aspects.map((a, i) => (
                <td key={i} className="px-2 py-2 text-right tabular-nums text-gray-700" title={`${data.aspectTitles[i]}: ${a.level ?? ""} · ${a.n} คำตอบ`}>
                  {fmt(a.mean)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* --------------------------------------------------- AI สรุปข้อเสนอแนะ */

export type FeedbackGroup = { topic: string; count: number };

export function FeedbackSummaryList({ groups }: { groups: FeedbackGroup[] }) {
  const max = Math.max(1, ...groups.map((g) => g.count));
  return (
    <ul className="space-y-1.5">
      {groups.map((g, i) => (
        <li key={i} className="grid grid-cols-[minmax(0,1fr)_3.5rem] items-center gap-3">
          <span className="min-w-0">
            <span className="block text-sm text-gray-800">{g.topic}</span>
            <span className="mt-0.5 block h-1.5 rounded-full bg-gray-100" title={`${g.count} คน`}>
              <span className="block h-full rounded-full" style={{ width: `${(g.count / max) * 100}%`, background: BRAND }} />
            </span>
          </span>
          <span className="text-right text-sm font-semibold tabular-nums text-gray-900">{g.count} คน</span>
        </li>
      ))}
    </ul>
  );
}
