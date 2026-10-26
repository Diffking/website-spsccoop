/**
 * คำนวณผลแบบประเมิน — ค่าเฉลี่ย · S.D. · แปลผล · การกระจายคำตอบ
 *
 * ตรรกะล้วน ไม่แตะฐาน (ตัวอ่านฐานอยู่ที่ surveyReportData.ts) ใช้ร่วมกันทั้ง Dashboard
 * รายงาน PDF ลิงก์กรรมการ และไฟล์ส่งออก — ตัวเลขทุกที่จึงมาจากสูตรชุดเดียวกัน
 *
 * ⚠️ ป้อนเฉพาะคำตอบที่ "ตรวจแล้ว" (status = verified) เท่านั้น — ตัวอ่านฐานกรองให้แล้ว
 * ⚠️ ช่อง "ไม่ประเมิน" (คอลัมน์ na เช่น "ไม่ได้ใช้บริการ (0)") **ไม่เข้าค่าเฉลี่ย/S.D.**
 *    นับแยกไว้ที่ na — ใส่ 0 เข้าไปเฉลี่ยเมื่อไหร่ คะแนนทั้งด้านต่ำเกินจริงทันที
 */

import { HAS_OPTIONS, numberOf, type SurveyItem } from "@/lib/survey";
import { OTHER, type Answers, type CheckboxAnswer, type ChoiceAnswer, type GridAnswer } from "@/lib/surveyAnswers";

export type ResponseForReport = {
  answers: Answers;
  submittedAt: Date;
  department: string | null;
  profile: Record<string, unknown>;
};

export type Stat = { n: number; mean: number | null; sd: number | null; level: string | null };

/** ค่าเฉลี่ยกับส่วนเบี่ยงเบนมาตรฐานแบบกลุ่มตัวอย่าง (หาร n−1) ตามที่รายงานวิจัยไทยใช้ */
export function stat(values: number[], min = 1, max = 5): Stat {
  const n = values.length;
  if (n === 0) return { n: 0, mean: null, sd: null, level: null };
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const sd = n > 1 ? Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 0;
  return { n, mean, sd, level: levelOf(mean, min, max) };
}

/**
 * แปลผลค่าเฉลี่ย — เกณฑ์ 5 ระดับที่หน่วยงานราชการใช้ (ช่วงละ 0.80 แบ่งจากจุดกึ่งกลาง)
 * 4.51–5.00 มากที่สุด · 3.51–4.50 มาก · 2.51–3.50 ปานกลาง · 1.51–2.50 น้อย · 1.00–1.50 น้อยที่สุด
 * ใช้ได้เฉพาะสเกล 1–5 · สเกลอื่นไม่แปลผล (ไม่มีเกณฑ์มาตรฐานให้อ้าง)
 */
export function levelOf(mean: number, min = 1, max = 5): string | null {
  if (min !== 1 || max !== 5) return null;
  const m = Math.round(mean * 100) / 100;
  if (m >= 4.51) return "มากที่สุด";
  if (m >= 3.51) return "มาก";
  if (m >= 2.51) return "ปานกลาง";
  if (m >= 1.51) return "น้อย";
  return "น้อยที่สุด";
}

export type GridRowReport = Stat & { id: string; label: string; dist: number[]; na: number };
export type ItemReport =
  | {
      kind: "grid";
      id: string;
      number: number | null;
      title: string;
      columns: { label: string; score: number }[];
      naLabel: string | null;
      rows: GridRowReport[];
      overall: Stat;
      /** คนที่ตอบข้อนี้ (ตอบอย่างน้อยหนึ่งแถว) */
      respondents: number;
      naRespondents: number;
    }
  | {
      kind: "choice";
      id: string;
      number: number | null;
      title: string;
      multi: boolean;
      respondents: number;
      options: { id: string; label: string; count: number }[];
      other: { count: number; texts: string[] } | null;
    }
  | {
      kind: "scale";
      id: string;
      number: number | null;
      title: string;
      min: number;
      max: number;
      dist: number[];
      overall: Stat;
    }
  | { kind: "text"; id: string; number: number | null; title: string; texts: string[] };

export type Report = {
  n: number;
  daily: { date: string; count: number }[];
  items: ItemReport[];
  /** ภาพรวมแต่ละด้าน (ทุกตารางให้คะแนน) — ใช้ทำกราฟเทียบด้าน */
  aspects: { id: string; title: string; overall: Stat }[];
  /** คะแนนรวมทุกด้าน */
  overall: Stat;
};

const DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" });

/** ชื่อด้านสั้น ๆ — ตัดส่วน "— กรุณาเลือก…" ท้ายคำถามทิ้ง */
export const shortTitle = (title: string) => title.split(" — ")[0].trim();

export function buildReport(items: SurveyItem[], responses: ResponseForReport[]): Report {
  const visible = items.filter((i) => i.kind !== "section" && !i.hidden && !i.noReport);
  const out: ItemReport[] = [];
  const allScores: number[] = [];

  for (const item of visible) {
    const number = numberOf(items, item.id);
    const answers = responses.map((r) => r.answers[item.id]).filter((a) => a !== undefined);

    if (item.kind === "grid") {
      const scored = item.columns.filter((c) => !c.na);
      const na = item.columns.find((c) => c.na) ?? null;
      const pooled: number[] = [];
      let naRespondents = 0;
      const rows = item.rows.map((row) => {
        const dist = scored.map(() => 0);
        let naCount = 0;
        const values: number[] = [];
        for (const a of answers as GridAnswer[]) {
          const col = item.columns.find((c) => c.id === a[row.id]);
          if (!col) continue;
          if (col.na) {
            naCount += 1;
            continue;
          }
          dist[scored.indexOf(col)] += 1;
          values.push(col.score);
        }
        pooled.push(...values);
        return { id: row.id, label: row.label, dist, na: naCount, ...stat(values, minOf(scored), maxOf(scored)) };
      });
      for (const a of answers as GridAnswer[]) {
        if (Object.values(a).every((col) => item.columns.find((c) => c.id === col)?.na)) naRespondents += 1;
      }
      const overall = stat(pooled, minOf(scored), maxOf(scored));
      allScores.push(...pooled);
      out.push({
        kind: "grid",
        id: item.id,
        number,
        title: item.title,
        columns: scored.map((c) => ({ label: c.label, score: c.score })),
        naLabel: na?.label ?? null,
        rows,
        overall,
        respondents: answers.length,
        naRespondents,
      });
    } else if (HAS_OPTIONS.includes(item.kind)) {
      const multi = item.kind === "checkbox";
      const counts = new Map(item.options.map((o) => [o.id, 0]));
      const others: string[] = [];
      for (const a of answers) {
        const picked = multi ? (a as CheckboxAnswer).v : [(a as ChoiceAnswer).v];
        for (const id of picked) if (counts.has(id)) counts.set(id, counts.get(id)! + 1);
        if (picked.includes(OTHER)) others.push((a as ChoiceAnswer | CheckboxAnswer).other ?? "");
      }
      out.push({
        kind: "choice",
        id: item.id,
        number,
        title: item.title,
        multi,
        respondents: answers.length,
        options: item.options.map((o) => ({ id: o.id, label: o.label, count: counts.get(o.id) ?? 0 })),
        other: item.allowOther ? { count: others.length, texts: others.filter(Boolean) } : null,
      });
    } else if (item.kind === "scale") {
      const dist = Array.from({ length: item.scaleMax - item.scaleMin + 1 }, () => 0);
      const values = (answers as number[]).filter((v) => typeof v === "number");
      for (const v of values) dist[v - item.scaleMin] += 1;
      out.push({
        kind: "scale",
        id: item.id,
        number,
        title: item.title,
        min: item.scaleMin,
        max: item.scaleMax,
        dist,
        overall: stat(values, item.scaleMin, item.scaleMax),
      });
    } else if (item.kind === "text" || item.kind === "paragraph") {
      out.push({
        kind: "text",
        id: item.id,
        number,
        title: item.title,
        texts: (answers as string[]).filter((t) => typeof t === "string" && t.trim()),
      });
    }
  }

  const byDay = new Map<string, number>();
  for (const r of responses) {
    const d = DAY.format(r.submittedAt);
    byDay.set(d, (byDay.get(d) ?? 0) + 1);
  }

  return {
    n: responses.length,
    daily: [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count })),
    items: out,
    aspects: out
      .filter((i): i is Extract<ItemReport, { kind: "grid" }> => i.kind === "grid")
      .map((g) => ({ id: g.id, title: shortTitle(g.title), overall: g.overall })),
    overall: stat(allScores),
  };
}

const minOf = (cols: { score: number }[]) => (cols.length ? Math.min(...cols.map((c) => c.score)) : 1);
const maxOf = (cols: { score: number }[]) => (cols.length ? Math.max(...cols.map((c) => c.score)) : 5);

/* ------------------------------------------------------------- แยกกลุ่ม */

export type Dimension = { key: string; label: string; values: { value: string; label: string }[] };

/** ค่าของคนหนึ่งในมิติหนึ่ง — department · profile.<ชื่อช่อง> · q:<รหัสข้อตัวเลือกเดียว> */
export function dimensionValue(r: ResponseForReport, key: string): string | null {
  if (key === "department") return r.department ?? null;
  if (key.startsWith("profile.")) {
    const v = r.profile[key.slice(8)];
    return v === undefined || v === null || v === "" ? null : String(v);
  }
  if (key.startsWith("q:")) {
    const a = r.answers[key.slice(2)] as ChoiceAnswer | undefined;
    return a?.v ?? null;
  }
  return null;
}

/** ช่องในข้อมูลสมาชิกที่แยกผลได้ — ชื่อช่องจริงกำหนดตอนต่อฐาน (เฟส 1) ช่องที่ไม่มีข้อมูลไม่ขึ้น */
// ป้าย "(ทะเบียน)" กำกับ — แบบประเมินอาจมีคำถามชื่อเดียวกัน (เช่น "เพศ") ตัวกรองจะขึ้นซ้ำสองช่องแล้วงง
const PROFILE_DIMS: { field: string; label: string }[] = [
  { field: "gender", label: "เพศ (ทะเบียน)" },
  { field: "ageRange", label: "ช่วงอายุ (ทะเบียน)" },
  { field: "memberType", label: "ประเภทสมาชิก (ทะเบียน)" },
];

/** มิติที่แยกผลได้จริงในชุดคำตอบนี้ — หน่วยงาน · ข้อมูลจากฐานสมาชิก · ทุกข้อตัวเลือกเดียว */
export function dimensions(items: SurveyItem[], responses: ResponseForReport[]): Dimension[] {
  const dims: Dimension[] = [];
  const distinct = (key: string) =>
    [...new Set(responses.map((r) => dimensionValue(r, key)).filter((v): v is string => !!v))].sort((a, b) =>
      a.localeCompare(b, "th"),
    );

  const deps = distinct("department");
  // dept_name จาก sync-agent คือ "กลุ่มเรียกเก็บ" ไม่ใช่ที่ทำงานจริงเสมอไป — เรียกตามจริง กรรมการจะได้ไม่อ่านผิด
  if (deps.length) dims.push({ key: "department", label: "กลุ่มเรียกเก็บ", values: deps.map((v) => ({ value: v, label: v })) });
  for (const p of PROFILE_DIMS) {
    const vals = distinct(`profile.${p.field}`);
    if (vals.length) dims.push({ key: `profile.${p.field}`, label: p.label, values: vals.map((v) => ({ value: v, label: v })) });
  }
  for (const item of items) {
    if ((item.kind !== "choice" && item.kind !== "dropdown") || item.hidden) continue;
    dims.push({
      key: `q:${item.id}`,
      label: shortTitle(item.title),
      values: item.options.map((o) => ({ value: o.id, label: o.label })),
    });
  }
  return dims;
}

/** คำตอบที่ผ่านตัวกรองทุกตัว — { มิติ: ค่า } */
export function applyFilters(responses: ResponseForReport[], filters: Record<string, string>): ResponseForReport[] {
  const entries = Object.entries(filters).filter(([, v]) => v);
  if (!entries.length) return responses;
  return responses.filter((r) => entries.every(([k, v]) => dimensionValue(r, k) === v));
}

export type Breakdown = {
  label: string;
  groups: { label: string; n: number; overall: Stat; aspects: Stat[] }[];
  aspectTitles: string[];
};

/**
 * เทียบผลตามกลุ่ม (เช่น แยกตามหน่วยงาน) — ค่าเฉลี่ยรวมและรายด้านของแต่ละกลุ่ม
 * minGroup > 0 (ลิงก์กรรมการ) = กลุ่มที่คนน้อยกว่านี้รวมเป็น "อื่น ๆ"
 * ไม่งั้นหน่วยงานที่มีผู้ตอบคนเดียว กรรมการจะรู้ทันทีว่าคนนั้นให้คะแนนเท่าไร
 */
export function breakdown(
  items: SurveyItem[],
  responses: ResponseForReport[],
  dim: Dimension,
  minGroup = 0,
): Breakdown {
  const buckets = new Map<string, ResponseForReport[]>();
  for (const r of responses) {
    const v = dimensionValue(r, dim.key) ?? "";
    if (!buckets.has(v)) buckets.set(v, []);
    buckets.get(v)!.push(r);
  }
  const labelOf = (v: string) => (v ? (dim.values.find((x) => x.value === v)?.label ?? v) : "ไม่ระบุ");
  let groups = [...buckets.entries()].map(([v, list]) => ({ label: labelOf(v), list }));
  if (minGroup > 0) {
    const small = groups.filter((g) => g.list.length < minGroup);
    groups = groups.filter((g) => g.list.length >= minGroup);
    const rest = small.flatMap((g) => g.list);
    if (rest.length) groups.push({ label: `อื่น ๆ (กลุ่มละไม่ถึง ${minGroup} คน)`, list: rest });
  }
  groups.sort((a, b) => b.list.length - a.list.length);

  const aspectTitles = buildReport(items, []).aspects.map((a) => a.title);
  return {
    label: dim.label,
    aspectTitles,
    groups: groups.map((g) => {
      const rep = buildReport(items, g.list);
      return { label: g.label, n: g.list.length, overall: rep.overall, aspects: rep.aspects.map((a) => a.overall) };
    }),
  };
}

/* ---------------------------------------------------------------- เวลาตัด */

/**
 * ผล ณ 12:00 — ระหว่างเปิดรับ Dashboard แสดงผลของคำตอบที่ส่งก่อนเที่ยงล่าสุดที่ผ่านมา
 * (เจ้าของเว็บกำหนด 22 ต.ค. 2569) · ก่อนเที่ยง = ผลเที่ยงเมื่อวาน · ปิดแล้ว = ผลสุดท้ายทั้งหมด (null)
 *
 * คิดจาก "เวลาที่ส่ง" ไม่ได้ถ่ายเก็บตอนเที่ยง — เครื่องปิดตอนเที่ยง (วันหยุด) ก็ได้ผลเที่ยงที่ถูกต้อง
 * และคำตอบที่ฝากไว้ก่อนเที่ยงแต่เพิ่งตรวจผ่านทีหลัง ก็นับเข้าผลเที่ยงนั้นตามจริง
 */
export function noonCutoff(open: boolean, now = new Date()): Date | null {
  if (!open) return null;
  const today = DAY.format(now);
  const noon = new Date(`${today}T12:00:00+07:00`);
  return noon.getTime() <= now.getTime() ? noon : new Date(noon.getTime() - 86_400_000);
}
