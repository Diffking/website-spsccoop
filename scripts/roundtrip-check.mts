/**
 * ตรวจว่า EditUI แปลงเนื้อหาไปกลับแล้วของไม่หาย
 *
 * หน้าจอ EditUI อ่าน HTML ของหน้าเนื้อหาเป็น "ก้อน" แล้วเขียนกลับเป็น HTML
 * (src/lib/pageBlocks.ts) ถ้าอ่านผิดหรือเขียนกลับไม่ครบ = เนื้อหาบนเว็บจริงหาย
 * โดยไม่มีใครรู้จนกว่าจะมีคนเปิดหน้านั้น สคริปต์นี้จึงเอาเนื้อหา **ของจริงทุกหน้า**
 * มาแปลงไปกลับ แล้วเทียบว่าตัวอักษรครบเท่าเดิมและจำนวนโครงเท่าเดิม
 *
 * จำลอง "คนเข้าไปแก้ทุกช่อง" ด้วยการเรียก cleanInline กับทุกข้อความก่อนเขียนกลับ —
 * เพราะช่องพิมพ์เรียกตัวนี้ทุกครั้งที่คลิกออกจากช่อง ต่อให้ไม่ได้พิมพ์อะไรเลยก็ตาม
 *
 * วิธีใช้ — ดึงเนื้อหาจากฐานของเว็บจริงก่อน แล้วค่อยรัน:
 *
 *   docker compose exec -T db psql -U coopsmile coopsmile -tAc \
 *     "select json_agg(json_build_object('slug', slug, 'body', body)) from \"Page\"" > pages.json
 *   npm run check:blocks -- pages.json out.txt
 *
 * ผลออกเป็นไฟล์ ไม่ใช่หน้าจอ เพราะเชลล์บนเครื่องนี้ทำภาษาไทยเพี้ยน (ดู AGENTS.md)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const dom = new JSDOM("");
(globalThis as unknown as { DOMParser: unknown }).DOMParser = dom.window.DOMParser;

// import หลังจากตั้ง DOMParser แล้วเท่านั้น — pageBlocks อ่านตัวนี้ตอนทำงาน
const { htmlToBlocks, blocksToHtml, cleanInline } = await import("../src/lib/pageBlocks.ts");
type Block = Awaited<ReturnType<typeof htmlToBlocks>>[number];

const pages: { slug: string; body: string }[] = JSON.parse(readFileSync(process.argv[2], "utf8"));

/** ตัวอักษรทั้งหมดในหน้า ไม่นับช่องว่าง — ช่องว่างเปลี่ยนได้ตามการจัดย่อหน้า ตัวอักษรห้ามเปลี่ยน */
const textOf = (html: string) => {
  const d = new JSDOM(`<body>${html}</body>`);
  return (d.window.document.body.textContent ?? "").replace(/\s+/g, "");
};

/*
 * นับของในเนื้อหาโดยไม่นับที่อยู่ในหมายเหตุ <!-- ... --> — หมายเหตุที่แถบเครื่องมือ
 * ใส่ไว้มีตัวอย่างแท็กปนอยู่ ("ก๊อป <a> ทั้งก้อนมาต่อ") ถ้านับด้วยจะเห็นเป็นลิงก์หาย
 */
const stripComments = (html: string) => html.replace(/<!--[\s\S]*?-->/g, "");
const count = (html: string, re: RegExp) => (stripComments(html).match(re) ?? []).length;

const CHECKS: [string, RegExp][] = [
  ["img", /<img\b/gi],
  ["a", /<a\b/gi],
  ["pdf-icon", /class="[^"]*\bpdf-icon\b/gi],
  ["--pdf-size", /--pdf-size/gi],
  ["table", /<table\b/gi],
  ["tr", /<tr\b/gi],
  ["li", /<li\b/gi],
  ["tabs", /class="[^"]*\btabs\b/gi],
  ["tab", /class="[^"]*\btab\b/gi],
  ["ebook", /class="[^"]*\bebook\b/gi],
  ["cards", /class="[^"]*\bcards\b/gi],
  ["people", /class="[^"]*\bpeople\b/gi],
  ["person", /class="[^"]*\bperson\b/gi],
  ["figure", /<figure\b/gi],
  ["h2", /<h2\b/gi],
  ["h3", /<h3\b/gi],
];

/** ล้างทุกข้อความในก้อน เหมือนคนคลิกเข้าไปทุกช่องแล้วคลิกออก */
function touchEveryField(block: Block): Block {
  switch (block.kind) {
    case "heading":
    case "paragraph":
    case "quote":
      return { ...block, html: cleanInline(block.html) };
    case "list":
      return { ...block, items: block.items.map(cleanInline) };
    case "image":
      return { ...block, caption: cleanInline(block.caption) };
    case "table":
      return {
        ...block,
        head: block.head.map(cleanInline),
        rows: block.rows.map((r) => r.map(cleanInline)),
      };
    case "tabs":
      return { ...block, tabs: block.tabs.map((t) => ({ ...t, blocks: t.blocks.map(touchEveryField) })) };
    default:
      return block;
  }
}

let bad = 0;
const report: string[] = [];

for (const page of pages) {
  const before = page.body;
  const blocks = htmlToBlocks(before).map(touchEveryField);
  const after = blocksToHtml(blocks);
  const problems: string[] = [];

  const t1 = textOf(before);
  const t2 = textOf(after);
  if (t1 !== t2) {
    problems.push(`ตัวอักษรต่างกัน (${t1.length} -> ${t2.length})`);
    let i = 0;
    while (i < t1.length && i < t2.length && t1[i] === t2[i]) i++;
    problems.push(`  ก่อน: …${t1.slice(Math.max(0, i - 40), i + 60)}`);
    problems.push(`  หลัง: …${t2.slice(Math.max(0, i - 40), i + 60)}`);
  }

  for (const [name, re] of CHECKS) {
    const a = count(before, re);
    const b = count(after, re);
    if (a !== b) problems.push(`${name}: ${a} -> ${b}`);
  }

  const htmlBlocks = blocks.filter((b) => b.kind === "html").length;
  const tail = htmlBlocks ? ` (ก้อนที่อ่านไม่ออก ${htmlBlocks})` : "";

  if (problems.length > 0) {
    bad++;
    report.push(`\nX ${page.slug}${tail}`);
    for (const p of problems) report.push(`   ${p}`);
  } else {
    report.push(`OK ${page.slug} — ${blocks.length} ก้อน${tail}`);
  }
}

report.push(`\nสรุป: ผ่าน ${pages.length - bad}/${pages.length} หน้า`);
writeFileSync(process.argv[3], report.join("\n"), "utf8");
