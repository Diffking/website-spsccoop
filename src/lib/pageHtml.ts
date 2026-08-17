/**
 * กรอง HTML ของหน้าเนื้อหาให้เหลือเฉพาะแท็กที่ปลอดภัย
 *
 * เนื้อหาถูกเอาไปวางบนหน้าเว็บด้วย dangerouslySetInnerHTML ถ้ามี <script>
 * หรือ onclick ปนมา คนที่เปิดหน้านั้นจะโดนรันโค้ดทันที — ตัวกรองนี้จึงเป็นด่านบังคับ
 * ใช้กับผลลัพธ์จาก AI เป็นหลัก (เชื่อไม่ได้ 100%) และใช้ซ้ำได้ถ้าวันหนึ่งจะกรองของที่พิมพ์เองด้วย
 *
 * เขียนเป็น regex ล้วน ไม่พึ่งไลบรารีนอก เพราะรันฝั่งเซิร์ฟเวอร์ที่ไม่มี DOM
 * และรายการแท็กที่ใช้จริงในหน้าเนื้อหาสหกรณ์มีไม่กี่ตัว
 */

const ALLOWED = new Set([
  "p", "h2", "h3", "h4", "ul", "ol", "li", "strong", "em", "b", "i", "u",
  "a", "br", "hr", "blockquote",
  "table", "thead", "tbody", "tr", "th", "td",
  "img", "figure", "figcaption", "div", "span",
]);

/**
 * class ที่ยอมให้ติดมาได้ — ใช้คุมการวางรูปเท่านั้น (ดู .prose-page ใน globals.css)
 * นอกรายการนี้ตัดทิ้งหมด กัน class แปลกปลอมมาทับสไตล์ของเว็บ
 */
const ALLOWED_CLASSES = new Set([
  "left", "right", "small", "wide", "image-row",
  // แท็บเมนูและการ์ดเอกสาร PDF — PageContent เอาไปทำเป็นแท็บกดได้จริงตอนแสดงผล
  "tabs", "tab", "ebook",
  // การ์ดลิงก์แบบตาราง (ดู .cards ใน globals.css)
  "cards", "card", "card-badge", "card-text", "card-title", "card-sub",
  // สีของการ์ด
  "blue", "green", "amber", "pink", "purple", "teal",
]);

/** แอตทริบิวต์ที่ยอมให้ติดมากับแต่ละแท็ก — นอกจากนี้ตัดทิ้งหมด รวมถึง style และ on* ทุกตัว */
const ALLOWED_ATTRS: Record<string, string[]> = {
  a: ["href", "target", "rel", "class"],
  span: ["class"],
  img: ["src", "alt", "width", "height"],
  th: ["colspan", "rowspan"],
  td: ["colspan", "rowspan"],
  figure: ["class"],
  // data-title = ชื่อบนปุ่มแท็บ / ชื่อเอกสาร
  div: ["class", "data-title"],
};

/** ค่า href/src ที่ยอมรับ — กัน javascript: และ data: ที่ใช้ยิงสคริปต์ได้ */
const safeUrl = (value: string) =>
  /^(https?:\/\/|\/|#|mailto:|tel:)/i.test(value.trim()) ? value.trim() : "";

function cleanAttrs(tag: string, raw: string): string {
  const allowed = ALLOWED_ATTRS[tag];
  if (!allowed) return "";

  const out: string[] = [];
  const pattern = /([a-zA-Z-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(raw)) !== null) {
    const name = match[1].toLowerCase();
    if (!allowed.includes(name)) continue;

    let value = match[3] ?? match[4] ?? "";
    if (name === "href" || name === "src") {
      value = safeUrl(value);
      if (!value) continue;
    }
    if (name === "class") {
      value = value.split(/\s+/).filter((c) => ALLOWED_CLASSES.has(c)).join(" ");
      if (!value) continue;
    }
    out.push(`${name}="${value.replace(/"/g, "&quot;")}"`);
  }

  // ลิงก์ที่เปิดแท็บใหม่ต้องมี rel กันหน้าปลายทางเข้าถึง window.opener ของเรา
  if (tag === "a" && out.some((a) => a.startsWith('target="_blank"'))) {
    if (!out.some((a) => a.startsWith("rel="))) out.push('rel="noopener noreferrer"');
  }
  return out.length > 0 ? ` ${out.join(" ")}` : "";
}

export function cleanPageHtml(html: string): string {
  return (
    html
      // เอาก้อนที่รันโค้ดได้ออกทั้งก้อนก่อน (เนื้อในไม่ใช่ข้อความที่ต้องเก็บ)
      .replace(/<(script|style|iframe|object|embed)[\s\S]*?<\/\1>/gi, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      // แล้วค่อยไล่ทีละแท็ก — ที่ไม่อยู่ในรายการให้ตัดเฉพาะตัวแท็ก ข้อความข้างในยังอยู่
      .replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)((?:\s[^>]*)?)\/?>/g, (whole, name: string, attrs: string) => {
        const tag = name.toLowerCase();
        if (!ALLOWED.has(tag)) return "";
        if (whole.startsWith("</")) return `</${tag}>`;
        const selfClosing = tag === "br" || tag === "hr" || tag === "img";
        return `<${tag}${cleanAttrs(tag, attrs)}${selfClosing ? "" : ""}>`;
      })
      .trim()
  );
}

/**
 * โครงสร้างที่ห้ามหายหลัง AI จัดรูปแบบ — รูป แท็บเมนู การ์ดไฟล์
 *
 * AI ตอบไม่เหมือนเดิมทุกครั้ง วันดีคืนดีมันยุบ <div class="tabs"> ทิ้งแล้วแท็บหายทั้งหน้า
 * (เกิดขึ้นมาแล้วกับหน้าแผนงาน) สั่งในคำสั่งอย่างเดียวไม่พอ ต้องนับของก่อน-หลังเทียบกัน
 */
const KEEP_PATTERNS: { name: string; pattern: RegExp }[] = [
  { name: "รูปภาพ", pattern: /<img\b/gi },
  { name: "แท็ปเมนู", pattern: /class="[^"]*\btabs\b/gi },
  { name: "หัวข้อแท็บ", pattern: /class="[^"]*\btab\b/gi },
  { name: "แถวรูป", pattern: /class="[^"]*\bimage-row\b/gi },
  { name: "การ์ดไฟล์ PDF", pattern: /class="[^"]*\bebook\b/gi },
];

const count = (html: string, pattern: RegExp) => html.match(pattern)?.length ?? 0;

/** ชื่อโครงที่หายไป — ว่าง = ครบดี เอาผลจาก AI ไปใช้ได้ */
export function missingStructures(before: string, after: string): string[] {
  return KEEP_PATTERNS.filter((k) => count(after, k.pattern) < count(before, k.pattern)).map(
    (k) => k.name,
  );
}
