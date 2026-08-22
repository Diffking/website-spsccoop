import { TONES, type Tone } from "@/lib/rateGroups";

/**
 * อ่าน "สวัสดิการสมาชิก" จากตารางในเนื้อหาหน้า แล้วจัดเป็นกลุ่มให้คอมโพเนนต์ไปวาดเป็นการ์ด
 *
 * ⚠️ **ทำไมต้องอ่านจาก HTML ไม่เก็บเป็นข้อมูลในโค้ด**
 * เพราะสวัสดิการเป็นเรื่องที่เจ้าหน้าที่ต้องแก้เองได้ (เปลี่ยนตามประกาศทุกปี)
 * ถ้าย้ายไปไว้ในโค้ดหรือใน Setting ที่ยังไม่มีหน้าจอให้แก้ ทุกครั้งที่ปรับตัวเลข
 * จะต้องรอคนเขียนโค้ด — ผิดหลักของเว็บนี้ที่ให้เจ้าหน้าที่ดูแลเนื้อหาเองได้
 *
 * วิธีทำ: เนื้อหาหน้าเก็บเป็น "แท็บ + ตาราง" ตามปกติ (ทั้งสองอย่างเป็นก้อนที่ EditUI
 * รู้จักและแก้ได้อยู่แล้ว) แค่ใส่คลาส `welfare-view` เพิ่มที่กล่องแท็บ
 * ฝั่งเซิร์ฟเวอร์เห็นคลาสนี้แล้วอ่านตารางไปวาดเป็นการ์ดแทน
 *
 * อ่านไม่ออกเมื่อไหร่ก็คืน null แล้วหน้าเว็บจะแสดงเป็นแท็บ+ตารางตามเดิม
 * — เนื้อหาไม่มีทางหายไปเพราะตัวอ่านพัง
 */

export type WelfareItem = {
  /** ชื่อสวัสดิการ */
  name: string;
  /** การจ่ายสวัสดิการ — อาจมีหลายบรรทัด */
  pay: string[];
  /** การยื่นเอกสาร */
  doc: string[];
};

export type WelfareGroup = {
  key: string;
  label: string;
  tone: Tone;
  items: WelfareItem[];
};

/** สีตามความเร่งด่วน — ยิ่งต้องรีบยื่นยิ่งร้อน */
const TONE_BY_ORDER = [TONES.rose, TONES.orange, TONES.sky, TONES.emerald, TONES.violet, TONES.gray];

const stripTags = (html: string) =>
  html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .trim();

const lines = (html: string) =>
  stripTags(html)
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

/**
 * หากล่องแท็บที่มีคลาส `welfare-view` แล้วแปลงเป็นกลุ่ม
 * คืน null ถ้าไม่เจอหรืออ่านไม่ออก — ฝั่งเรียกจะได้รู้ว่าให้แสดงแบบเดิม
 */
/**
 * หาตำแหน่ง `</div>` ที่ปิดตรงกับ `<div>` ที่เปิดไว้ โดยนับชั้นจริง
 *
 * ⚠️ ห้ามใช้ regex หา `</div>` ตัวแรก — กล่องแท็บมี `<div>` ซ้อนข้างในหลายชั้น
 * เคยเขียนแบบนั้นแล้วมันไปจับ `</div>` ผิดตัว กลืนตารางระเบียบกับเอกสารที่อยู่
 * ถัดจากนั้นเข้ามาเป็นสวัสดิการด้วย จาก 7 รายการกลายเป็น 31 (22 ส.ค. 2026)
 *
 * คืน -1 ถ้าหาตัวปิดไม่เจอ (HTML ไม่สมบูรณ์)
 */
function closingDiv(html: string, openEnd: number): number {
  const tag = /<div\b|<\/div>/g;
  tag.lastIndex = openEnd;
  let depth = 1;
  let m: RegExpExecArray | null;
  while ((m = tag.exec(html)) !== null) {
    depth += m[0] === "</div>" ? -1 : 1;
    if (depth === 0) return m.index;
  }
  return -1;
}

export function readWelfare(
  html: string,
): { before: string; groups: WelfareGroup[]; after: string } | null {
  const open = html.match(/<div[^>]*class="[^"]*welfare-view[^"]*"[^>]*>/);
  if (!open || open.index === undefined) return null;

  const innerFrom = open.index + open[0].length;
  const closeAt = closingDiv(html, innerFrom);
  if (closeAt === -1) return null;

  const inner = html.slice(innerFrom, closeAt);

  /*
    แยกเป็นกลุ่มด้วย `data-title` โดยไม่สนใจว่าแอตทริบิวต์เรียงยังไง —
    ตัวจัดรูปแบบ HTML ตอนบันทึกอาจสลับลำดับ `class` กับ `data-title` ได้
  */
  const marks = [...inner.matchAll(/data-title="([^"]+)"/g)];
  if (marks.length === 0) return null;

  const groups: WelfareGroup[] = [];
  marks.forEach((mark, i) => {
    const from = (mark.index ?? 0) + mark[0].length;
    const to = i + 1 < marks.length ? marks[i + 1].index : inner.length;
    const chunk = inner.slice(from, to);

    const items: WelfareItem[] = [];
    for (const row of chunk.matchAll(
      /<tr>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<\/tr>/g,
    )) {
      const name = stripTags(row[1]);
      if (!name) continue;
      items.push({ name, pay: lines(row[2]), doc: lines(row[3]) });
    }

    if (items.length > 0) {
      groups.push({
        key: `g${groups.length}`,
        label: mark[1].trim(),
        tone: TONE_BY_ORDER[groups.length % TONE_BY_ORDER.length],
        items,
      });
    }
  });

  if (groups.length === 0) return null;

  return {
    before: html.slice(0, open.index),
    groups,
    after: html.slice(closeAt + "</div>".length),
  };
}
