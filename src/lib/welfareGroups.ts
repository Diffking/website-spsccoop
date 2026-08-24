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

/** ระเบียบหรือแบบฟอร์มหนึ่งฉบับ — อ่านมาจากตารางท้ายหน้า */
export type WelfareDoc = {
  /** `reg` = ระเบียบสหกรณ์ · `form` = แบบฟอร์มที่ต้องกรอกยื่น */
  kind: "reg" | "form";
  /** ชื่อเต็มตามที่เจ้าหน้าที่พิมพ์ไว้ในตาราง */
  name: string;
  /** ชื่อที่ตัดคำนำหน้าซ้ำ ๆ ออกแล้ว ("ระเบียบสหกรณ์ ว่าด้วย ", "แบบฟอร์ม - ") */
  short: string;
  href: string;
  /** ตารางแบบฟอร์มใส่ `download` ไว้ = กดแล้วโหลดลงเครื่องเลย ไม่เปิดอ่านในเบราว์เซอร์ */
  download: boolean;
};

export type WelfareItem = {
  /** ชื่อสวัสดิการ */
  name: string;
  /** การจ่ายสวัสดิการ — อาจมีหลายบรรทัด */
  pay: string[];
  /** การยื่นเอกสาร */
  doc: string[];
  /** ระเบียบ/แบบฟอร์มของสวัสดิการรายการนี้ (เรียงระเบียบก่อน แล้วค่อยแบบฟอร์ม) */
  files: WelfareDoc[];
};

export type WelfareGroup = {
  key: string;
  label: string;
  tone: Tone;
  items: WelfareItem[];
};

/** ตารางเอกสารท้ายหน้าหนึ่งตาราง — เก็บไว้ให้ดูรายการเต็มได้ที่เดิม */
export type WelfareDocTable = {
  /** หัวข้อเดิมของตาราง เช่น "ระเบียบสวัสดิการ" */
  title: string;
  kind: "reg" | "form";
  docs: WelfareDoc[];
};

/** สีตามความเร่งด่วน — ยิ่งต้องรีบยื่นยิ่งร้อน */
const TONE_BY_ORDER = [TONES.rose, TONES.orange, TONES.sky, TONES.emerald, TONES.violet, TONES.gray];

/**
 * จับคู่ "สวัสดิการ" กับ "ระเบียบ/แบบฟอร์ม" ด้วยคำที่ปรากฏในชื่อของทั้งสองฝั่ง
 *
 * เจ้าของเว็บขอไว้ 24 ส.ค. 2026 ว่าให้เอกสารไปอยู่กับสวัสดิการที่มันใช้ — เปิดแท็บ
 * "เกณฑ์กำหนดภายใน 90 วัน" แล้วต้องเห็นระเบียบกับแบบฟอร์มของ 3 เรื่องนั้นเลย
 * ไม่ต้องเลื่อนลงไปหาเองในตารางรวม 12 บรรทัดว่าอันไหนของเรื่องไหน
 *
 * ⚠️ **จับจากคำ ไม่ได้ผูกด้วยรหัส** เพราะเจ้าหน้าที่แก้ตารางเองได้ทั้งสองฝั่ง
 * ถ้าไปผูกด้วยเลขลำดับหรือ data-* เจ้าหน้าที่จะทำหลุดโดยไม่รู้ตัว (EditUI ไม่มีที่ให้ตั้ง)
 *
 * ⚠️ **จับไม่ได้ = ไม่หาย** เอกสารที่ไม่ตรงกับสวัสดิการรายการไหนเลย (เช่น ระเบียบเงินกู้
 * ฉุกเฉิน · ใบเรียกร้องค่าสินไหมของบริษัทประกัน) ยังอยู่ครบในรายการเต็มท้ายหน้า
 * เพิ่มสวัสดิการใหม่แล้วอยากให้เอกสารไปเกาะการ์ด ต้องมาเพิ่มหัวข้อในตารางนี้
 *
 * ⚠️ **ห้ามใช้ตัวเลขลอย ๆ เป็นคำจับ** — "65" ไปตรงกับ "พ.ศ. 2565" ของระเบียบเงินกู้ฉุกเฉิน
 * ต้องเขียนเป็น `65\s*ปี` เสมอ (เจอตอนทดสอบครั้งแรก เอกสารไปเกาะผิดเรื่อง)
 */
const TOPICS: { key: string; item: RegExp; doc: RegExp }[] = [
  { key: "medical", item: /รักษาพยาบาล|เคมีบำบัด|คีโม/, doc: /รักษาพยาบาล/ },
  { key: "funeralLoan", item: /เงินยืม|ยืมเงิน/, doc: /เงินยืม|ยืมเงิน|ทดรองจ่าย|ทดลองจ่าย/ },
  { key: "familyDeath", item: /(ครอบครัว|บิดา|มารดา|คู่สมรส).*เสียชีวิต/, doc: /เกี่ยวกับศพ|บำเพ็ญกุศล/ },
  { key: "memberDeath", item: /สมาชิก(ผู้)?เสียชีวิต/, doc: /สมาชิก(ผู้)?เสียชีวิต|เกี่ยวกับศพ/ },
  { key: "retire", item: /เกษียณ|อายุ\s*60\s*ปี/, doc: /เกษียณ/ },
  { key: "age65", item: /65\s*ปี/, doc: /65\s*ปี/ },
  { key: "age55", item: /55\s*ปี/, doc: /55\s*ปี/ },
  { key: "newborn", item: /แรกเกิด|รับขวัญ/, doc: /แรกเกิด|รับขวัญ/ },
  { key: "education", item: /การศึกษา/, doc: /การศึกษา/ },
  { key: "bedridden", item: /ติดเตียง/, doc: /ติดเตียง/ },
  { key: "disaster", item: /ภัยพิบัติ/, doc: /ภัยพิบัติ/ },
  { key: "disability", item: /สติปัญญา|บกพร่อง/, doc: /สติปัญญา|บกพร่อง/ },
];

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

/** ตัดคำนำหน้าที่ซ้ำกันทุกบรรทัดออก — บนการ์ดมีที่จำกัด ชื่อยาวเท่ากันหมดอ่านไม่ทัน */
const shortName = (name: string) =>
  name
    .replace(/^ระเบียบ\S*\s+ว่าด้วย\s*/, "")
    .replace(/^แบบฟอร์ม\s*[-–—]\s*/, "")
    .trim() || name;

/** อ่านแถวในตารางเอกสาร — แถวที่ไม่มีลิงก์หรือไม่มีชื่อ ถือว่าไม่ใช่เอกสาร ข้ามไป */
function readDocRows(block: string, kind: "reg" | "form"): WelfareDoc[] {
  const out: WelfareDoc[] = [];
  for (const row of block.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const href = row[1].match(/href="([^"]+)"/)?.[1];
    if (!href) continue;

    /*
      ชื่อเอกสารคือช่องที่ยาวที่สุดที่ไม่ใช่เลขลำดับ — ไม่ยึดว่าต้องเป็นช่องที่เท่าไหร่
      เผื่อวันหลังเจ้าหน้าที่เพิ่ม/สลับคอลัมน์ในตาราง (ทำได้เองใน EditUI)
    */
    const name = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)]
      .map((cell) => stripTags(cell[1]))
      .filter((text) => text && !/^\d+\s*[.)]?$/.test(text))
      .sort((a, b) => b.length - a.length)[0];
    if (!name) continue;

    out.push({ kind, name, short: shortName(name), href, download: /\sdownload[\s>]/.test(row[1]) });
  }
  return out;
}

/**
 * ดึงตาราง "ระเบียบ" กับ "เอกสารดาวน์โหลด" ท้ายหน้าออกมา แล้วคืนเนื้อหาที่เหลือ
 *
 * ที่ต้องดึงออกเพราะเอาไปแสดงใหม่แล้ว (บนการ์ด + รายการเต็มแบบพับเก็บ)
 * ถ้าปล่อยไว้จะเห็นของเดียวกันสองรอบ · ตารางอื่นที่ไม่ใช่สองอย่างนี้ไม่แตะ
 */
function readDocTables(html: string): { tables: WelfareDocTable[]; rest: string } {
  const tables: WelfareDocTable[] = [];
  let rest = "";
  let last = 0;

  for (const block of html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>\s*<table[\s\S]*?<\/table>/g)) {
    const title = stripTags(block[1]);
    const kind = /ระเบียบ/.test(title)
      ? "reg"
      : /ดาวน์โหลด|แบบฟอร์ม/.test(title)
        ? "form"
        : null;
    if (!kind) continue;

    const docs = readDocRows(block[0], kind);
    if (docs.length === 0) continue;

    tables.push({ title, kind, docs });
    rest += html.slice(last, block.index);
    last = block.index + block[0].length;
  }

  return { tables, rest: rest + html.slice(last) };
}

export function readWelfare(html: string): {
  before: string;
  groups: WelfareGroup[];
  tables: WelfareDocTable[];
  after: string;
} | null {
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

  const { tables, rest } = readDocTables(html.slice(closeAt + "</div>".length));
  const allDocs = tables.flatMap((t) => t.docs);

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

      // หัวข้อที่ชื่อสวัสดิการนี้เข้าข่าย — เอกสารที่เข้าข่ายหัวข้อเดียวกันคือของรายการนี้
      const topics = TOPICS.filter((t) => t.item.test(name));
      items.push({
        name,
        pay: lines(row[2]),
        doc: lines(row[3]),
        files: topics.length === 0 ? [] : allDocs.filter((d) => topics.some((t) => t.doc.test(d.name))),
      });
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

  return { before: html.slice(0, open.index), groups, tables, after: rest.trim() };
}
