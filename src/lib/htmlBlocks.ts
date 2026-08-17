/**
 * หา "ก้อน div" ในเนื้อหา HTML ของหน้าเนื้อหา
 *
 * ใช้ทั้งตอนหาแท็บและตอนหาบล็อกทำเนียบบุคลากร — ต้องนับ <div> ซ้อนเองทีละตัว
 * เพราะข้างในมี <figure>, <div class="image-row"> ซ้อนได้ ถ้าจับ </div> ตัวแรกที่เจอ
 * จะตัดกลางก้อนแล้วโครงพังทั้งหน้า
 *
 * ไฟล์นี้ไม่แตะฐานข้อมูลและไม่ใช้ DOM ใช้ได้ทั้งฝั่ง client และ server
 */

export type HtmlBlock = {
  /** ตำแหน่งเริ่มของ <div ...> */
  start: number;
  /** ตำแหน่งหลัง </div> ที่ปิดก้อนนี้ */
  end: number;
  /** ค่า class ทั้งหมดของ div ตัวนอกสุด */
  className: string;
  /** เนื้อในระหว่างแท็กเปิดกับแท็กปิด */
  inner: string;
};

/** หาก้อนแรกที่ class มีคำที่ระบุ — ไม่เจอคืน null */
export function findBlock(html: string, name: string): HtmlBlock | null {
  const opening = new RegExp(`<div\\b[^>]*\\bclass="([^"]*\\b${name}\\b[^"]*)"[^>]*>`, "i");
  const found = opening.exec(html);
  if (!found) return null;

  const bodyStart = found.index + found[0].length;
  const anyDiv = /<div\b[^>]*>|<\/div>/gi;
  anyDiv.lastIndex = bodyStart;

  let depth = 1;
  let match: RegExpExecArray | null;
  while ((match = anyDiv.exec(html)) !== null) {
    depth += match[0] === "</div>" ? -1 : 1;
    if (depth === 0) {
      return {
        start: found.index,
        end: match.index + match[0].length,
        className: found[1],
        inner: html.slice(bodyStart, match.index),
      };
    }
  }
  return null;
}

/** แทนก้อนเดิมด้วยก้อนใหม่ — ไม่มีก้อนเดิมก็ต่อท้ายเนื้อหา */
export function replaceBlock(html: string, name: string, block: string): string {
  const found = findBlock(html, name);
  if (!found) return html.trim() ? `${html.replace(/\s+$/, "")}\n${block}\n` : `${block}\n`;
  return html.slice(0, found.start) + block + html.slice(found.end);
}
