/**
 * ล้าง SVG ให้ปลอดภัยก่อนเก็บและก่อนฝังลงหน้าเว็บ
 *
 * SVG ไม่ใช่ "รูป" เฉย ๆ — มันคือเอกสารที่ใส่ <script>, onclick, หรือลิงก์ไปโหลดของ
 * จากเว็บอื่นได้ พอเอามาฝังตรง ๆ ใน HTML (ซึ่งเป็นสิ่งที่โลโก้ต้องทำ ถึงจะคมทุกความละเอียด
 * และเปลี่ยนสีตามธีมได้) โค้ดในไฟล์จะรันในหน้าเว็บเราทันที
 *
 * ตัวนี้จึงตัดทุกอย่างที่รันโค้ดได้ทิ้งก่อน แล้วค่อยเก็บ/แสดง
 * ล้างสองรอบ: ตอนอัปโหลด (ไฟล์ในเครื่องสะอาดตั้งแต่ต้น) และตอนจะฝังลงหน้า (กันไฟล์เก่า)
 *
 * ไม่ใช้ DOM ไม่แตะฐานข้อมูล ใช้ได้ทั้งฝั่ง client และ server
 */

/** แท็กที่รันโค้ดหรือดึงของจากข้างนอกได้ — ตัดทั้งก้อนพร้อมเนื้อใน */
const DANGEROUS_TAGS = [
  "script",
  "foreignObject",
  "iframe",
  "object",
  "embed",
  "audio",
  "video",
  "animate",
  "animateTransform",
  "set",
  "handler",
];

/** โปรโตคอลที่ยอมให้ใช้ใน href/xlink:href — data: กับ javascript: ตัดทิ้ง */
const SAFE_HREF = /^(#|\/(?!\/)|https?:\/\/)/i;

/**
 * ล้าง SVG — ไม่ใช่ SVG หรือเสียหายจนใช้ไม่ได้คืน null
 *
 * ที่ตัดออก: <script> และแท็กที่รันเองได้ · แอตทริบิวต์ on* ทุกตัว ·
 * href/xlink:href ที่เป็น javascript: หรือ data: · <style> ที่มี @import ·
 * คอมเมนต์ XML และ <!DOCTYPE> (ตัวพา XXE)
 */
export function sanitizeSvg(source: string): string | null {
  if (!source.includes("<svg")) return null;

  let svg = source;

  // ตัดหัวเอกสารและคอมเมนต์ — โปรแกรมวาดรูปชอบยัด metadata มาเป็นกิโล
  svg = svg.replace(/<\?xml[\s\S]*?\?>/gi, "");
  svg = svg.replace(/<!DOCTYPE[\s\S]*?>/gi, "");
  svg = svg.replace(/<!--[\s\S]*?-->/g, "");

  for (const tag of DANGEROUS_TAGS) {
    svg = svg.replace(new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}\\s*>`, "gi"), "");
    // แท็กเดี่ยวที่ปิดในตัว เช่น <animate .../>
    svg = svg.replace(new RegExp(`<${tag}\\b[^>]*\\/?>`, "gi"), "");
  }

  // แอตทริบิวต์ที่เป็นตัวจัดการเหตุการณ์ — ครอบทั้งแบบมีเครื่องหมายคำพูดและไม่มี
  svg = svg.replace(/\son[a-z-]+\s*=\s*"[^"]*"/gi, "");
  svg = svg.replace(/\son[a-z-]+\s*=\s*'[^']*'/gi, "");
  svg = svg.replace(/\son[a-z-]+\s*=\s*[^\s>]+/gi, "");

  // ลิงก์ที่ไม่ใช่ที่อยู่ธรรมดา (javascript:, data:) ตัดทั้งแอตทริบิวต์
  svg = svg.replace(/\s(?:xlink:)?href\s*=\s*"([^"]*)"/gi, (match, value: string) =>
    SAFE_HREF.test(value.trim()) ? match : "",
  );
  svg = svg.replace(/\s(?:xlink:)?href\s*=\s*'([^']*)'/gi, (match, value: string) =>
    SAFE_HREF.test(value.trim()) ? match : "",
  );

  // @import ใน <style> ดึง CSS จากเว็บอื่นเข้ามาได้
  svg = svg.replace(/@import[^;]*;/gi, "");

  const start = svg.search(/<svg\b/i);
  const end = svg.toLowerCase().lastIndexOf("</svg>");
  if (start < 0 || end < 0) return null;

  return svg.slice(start, end + "</svg>".length).trim();
}

/**
 * ใส่ class กับ role ให้ <svg> ตัวนอกสุด เพื่อคุมขนาดจากหน้าเว็บ
 *
 * ไฟล์โลโก้มักฝัง width/height ตายตัวมา ต้องถอดทิ้งก่อน ไม่งั้นสั่งขนาดด้วย CSS ไม่ขึ้น
 * (viewBox ต้องเก็บไว้ เพราะเป็นตัวบอกสัดส่วน ถอดแล้วภาพจะแบน)
 */
export function svgWithClass(svg: string, className: string, title: string): string {
  return svg.replace(/<svg\b([^>]*)>/i, (_match, attrs: string) => {
    const kept = attrs
      .replace(/\s(width|height)\s*=\s*"[^"]*"/gi, "")
      .replace(/\s(width|height)\s*=\s*'[^']*'/gi, "")
      .replace(/\sclass\s*=\s*"[^"]*"/gi, "")
      .trim();
    return `<svg ${kept} class="${className}" role="img" aria-label="${title.replace(/"/g, "&quot;")}">`;
  });
}
