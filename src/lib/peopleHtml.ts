/**
 * จัดชื่อ ตำแหน่ง และลำดับ ของทำเนียบบุคลากรที่อยู่ในเนื้อหาแล้ว
 *
 * ตอนแทรกรูป ระบบเอา "ชื่อไฟล์" ไปใส่ช่องชื่อทั้งดุ้น (01-ประธานกรรมการ-นายจำลอง-แก้วพิทยานนท์)
 * และเรียงตามลำดับที่เลือกไฟล์ ไม่ใช่ตามเลขหน้าชื่อไฟล์ — 15 คนก็ต้องแก้มือ 15 ครั้ง
 *
 * ตัวนี้อ่านเลข/ตำแหน่ง/ชื่อ จาก alt ของรูป (ซึ่งเก็บชื่อไฟล์เดิมไว้) แล้วเขียนกลับให้เป็นระเบียบ
 * ทำงานกับข้อความล้วน ไม่ใช้ DOM — เรียกได้ทั้งฝั่ง client และ server
 */

import { findBlocks } from "@/lib/htmlBlocks";
import { parsePersonFile, type ParsedPerson } from "@/lib/personName";

const FIGURE = /<figure\b[^>]*\bclass="[^"]*\bperson\b[^"]*"[^>]*>[\s\S]*?<\/figure>/gi;
const ALT = /<img\b[^>]*\balt="([^"]*)"/i;
const NAME_SPAN = /(<span\b[^>]*\bclass="[^"]*\bperson-name\b[^"]*"[^>]*>)([\s\S]*?)(<\/span>)/i;
const ROLE_SPAN = /(<span\b[^>]*\bclass="[^"]*\bperson-role\b[^"]*"[^>]*>)([\s\S]*?)(<\/span>)/i;

/** ข้อความที่ถือว่า "ยังไม่ได้กรอก" — ทับได้เลยไม่ต้องกลัวลบของจริง */
const PLACEHOLDERS = ["ตำแหน่ง", "ชื่อ-นามสกุล", ""];

const textOf = (html: string) => html.replace(/<[^>]*>/g, "").trim();

/** อ่านข้อมูลคนหนึ่งใบจาก <figure> — เอา alt ก่อน เพราะ alt เก็บชื่อไฟล์เดิมไว้เสมอ */
function readFigure(figure: string): ParsedPerson {
  const alt = ALT.exec(figure)?.[1] ?? "";
  const shown = textOf(NAME_SPAN.exec(figure)?.[2] ?? "");
  // alt ที่เป็นชื่อไฟล์จะมีเลขนำหน้าหรือขีดคั่น ถ้า alt ว่าง/ถูกแก้ไปแล้วก็ใช้ชื่อที่แสดงอยู่แทน
  const source = /[-_]/.test(alt) || /^\d/.test(alt) ? alt : shown || alt;
  return parsePersonFile(source);
}

/** เขียนชื่อกับตำแหน่งกลับเข้า <figure> — ของที่กรอกมือไว้แล้วไม่ทับ */
function writeFigure(figure: string, person: ParsedPerson): string {
  let out = figure;

  const currentName = textOf(NAME_SPAN.exec(figure)?.[2] ?? "");
  // ทับได้เฉพาะตอนที่ในช่องยังเป็นชื่อไฟล์ดิบหรือคำตัวอย่าง — ที่เจ้าหน้าที่พิมพ์เองห้ามแตะ
  const flat = (s: string) => s.replace(/[-_\s]/g, "");
  const stillRaw = flat(currentName) === flat(person.raw);
  if (person.name && (PLACEHOLDERS.includes(currentName) || stillRaw)) {
    out = out.replace(NAME_SPAN, (_m, open: string, _t: string, close: string) =>
      `${open}${person.name}${close}`,
    );
  }

  const currentRole = textOf(ROLE_SPAN.exec(out)?.[2] ?? "");
  if (person.role && PLACEHOLDERS.includes(currentRole)) {
    out = out.replace(ROLE_SPAN, (_m, open: string, _t: string, close: string) =>
      `${open}${person.role}${close}`,
    );
  }

  return out;
}

export type TidyResult = { html: string; fixed: number; unknownRole: number };

/** จัดทำเนียบหนึ่งก้อน — คืนเนื้อในก้อนที่เรียงและเติมข้อมูลแล้ว */
function tidyInner(inner: string): { inner: string; fixed: number; unknownRole: number } {
  const figures = inner.match(FIGURE) ?? [];
  if (figures.length === 0) return { inner, fixed: 0, unknownRole: 0 };

  // ของอื่นที่ปนอยู่ในก้อน (คอมเมนต์ไกด์ ฯลฯ) เก็บไว้ข้างบนตามเดิม
  const rest = inner.replace(FIGURE, "").trim();

  const people = figures.map((figure) => ({ figure, person: readFigure(figure) }));
  people.sort((a, b) => a.person.order - b.person.order);

  let fixed = 0;
  let unknownRole = 0;
  const rebuilt = people.map(({ figure, person }) => {
    const next = writeFigure(figure, person);
    if (next !== figure) fixed += 1;
    if (!person.role) unknownRole += 1;
    return next.replace(/^\s*/, "  ");
  });

  return {
    inner: `\n${rest ? `${rest}\n` : ""}${rebuilt.join("\n")}\n`,
    fixed,
    unknownRole,
  };
}

/** จัดทำเนียบทุกก้อนในเนื้อหา — ก้อนที่ไม่มีคนก็ปล่อยไว้เฉย ๆ */
export function tidyPeopleHtml(html: string): TidyResult {
  const blocks = findBlocks(html, "people");
  let out = html;
  let fixed = 0;
  let unknownRole = 0;

  // ไล่จากก้อนท้ายมาก้อนหน้า ตำแหน่ง start/end ของก้อนที่ยังไม่ถึงจะได้ไม่เลื่อน
  for (const block of [...blocks].reverse()) {
    const result = tidyInner(block.inner);
    fixed += result.fixed;
    unknownRole += result.unknownRole;

    const openEnd = out.indexOf(">", block.start) + 1;
    const closeStart = block.end - "</div>".length;
    out = out.slice(0, openEnd) + result.inner + out.slice(closeStart);
  }

  return { html: out, fixed, unknownRole };
}
