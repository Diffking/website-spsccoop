/**
 * คำตอบของแบบประเมิน — รูปร่าง และตัวตรวจที่ใช้ทั้งหน้าจอสมาชิกกับ API
 *
 * หน้าจอตรวจเพื่อบอกสมาชิกว่าลืมตอบข้อไหน · API ตรวจซ้ำอีกรอบเพราะคำขอปลอมได้
 * ใช้ฟังก์ชันเดียวกัน สองฝั่งจึงตัดสินตรงกันเสมอ
 *
 * รูปร่างที่เก็บใน SurveyResponse.answers = { รหัสข้อ: ค่า }
 *   text · paragraph · date   → "ข้อความ"
 *   choice · dropdown         → { v: "รหัสตัวเลือก" | "other", other?: "ที่พิมพ์เอง" }
 *   checkbox                  → { v: ["รหัส", ...], other?: "ที่พิมพ์เอง" }  ("other" อยู่ใน v ได้)
 *   scale                     → ตัวเลข
 *   grid                      → { รหัสแถว: "รหัสคอลัมน์" }
 */

import type { SurveyItem } from "@/lib/survey";

export const OTHER = "other";

export type ChoiceAnswer = { v: string; other?: string };
export type CheckboxAnswer = { v: string[]; other?: string };
export type GridAnswer = Record<string, string>;
export type Answer = string | number | ChoiceAnswer | CheckboxAnswer | GridAnswer;
export type Answers = Record<string, Answer>;

const LIMIT = { text: 500, paragraph: 4000, other: 300 };

/** ข้อที่สมาชิกเห็นและต้องตอบได้ — หัวตอนกับข้อที่ซ่อนไม่นับ */
export const answerable = (item: SurveyItem) => item.kind !== "section" && !item.hidden;

const clip = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/**
 * ล้างคำตอบหนึ่งข้อ — คืน undefined = ไม่ได้ตอบ (หรือตอบมาผิดรูป ถือว่าไม่ได้ตอบ)
 * ของที่ไม่อยู่ในตัวเลือกจริงถูกทิ้ง จะได้ไม่มีรหัสแปลกปลอมไปปนในผลสรุป
 */
export function cleanAnswer(item: SurveyItem, raw: unknown): Answer | undefined {
  switch (item.kind) {
    case "text":
    case "paragraph": {
      const v = clip(raw, item.kind === "text" ? LIMIT.text : LIMIT.paragraph);
      return v || undefined;
    }
    case "date": {
      const v = clip(raw, 10);
      return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined;
    }
    case "choice":
    case "dropdown": {
      const o = (raw ?? {}) as Record<string, unknown>;
      const v = typeof o.v === "string" ? o.v : "";
      if (v === OTHER && item.allowOther) {
        const other = clip(o.other, LIMIT.other);
        return other ? { v: OTHER, other } : undefined;
      }
      return item.options.some((opt) => opt.id === v) ? { v } : undefined;
    }
    case "checkbox": {
      const o = (raw ?? {}) as Record<string, unknown>;
      const list = Array.isArray(o.v) ? o.v.filter((x): x is string => typeof x === "string") : [];
      const picked = item.options.filter((opt) => list.includes(opt.id)).map((opt) => opt.id);
      const other = item.allowOther && list.includes(OTHER) ? clip(o.other, LIMIT.other) : "";
      if (other) picked.push(OTHER);
      if (picked.length === 0) return undefined;
      return other ? { v: picked, other } : { v: picked };
    }
    case "scale": {
      const n = Number(raw);
      return Number.isInteger(n) && n >= item.scaleMin && n <= item.scaleMax ? n : undefined;
    }
    case "grid": {
      const o = (raw ?? {}) as Record<string, unknown>;
      const out: GridAnswer = {};
      for (const row of item.rows) {
        const col = o[row.id];
        if (typeof col === "string" && item.columns.some((c) => c.id === col)) out[row.id] = col;
      }
      return Object.keys(out).length ? out : undefined;
    }
    default:
      return undefined;
  }
}

/** ตอบครบไหม — ตารางที่บังคับตอบต้องครบทุกแถว */
export function isComplete(item: SurveyItem, answer: Answer | undefined): boolean {
  if (answer === undefined) return false;
  if (item.kind === "grid") {
    const grid = answer as GridAnswer;
    return item.rows.every((r) => grid[r.id]);
  }
  return true;
}

/**
 * ล้างคำตอบทั้งชุด + หาข้อบังคับที่ยังไม่ได้ตอบ
 * คืน missing เป็นรหัสข้อ — หน้าจอเอาไปไฮไลต์ · API เห็นว่าไม่ว่างก็ปฏิเสธ
 */
export function checkAnswers(
  items: SurveyItem[],
  raw: unknown,
): { answers: Answers; missing: string[] } {
  const input = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const answers: Answers = {};
  const missing: string[] = [];

  for (const item of items) {
    if (!answerable(item)) continue;
    const answer = cleanAnswer(item, input[item.id]);
    if (answer !== undefined) answers[item.id] = answer;
    if (item.required && !isComplete(item, answer)) missing.push(item.id);
  }
  return { answers, missing };
}
