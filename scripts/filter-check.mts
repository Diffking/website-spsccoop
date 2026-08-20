/**
 * ลองเอาตัวกรอง HTML เต็ม (cleanPageHtml) ไปใช้กับเนื้อหาจริงทุกหน้า แล้วดูว่าอะไรหายบ้าง
 *
 * ตัวกรองนี้ตอนนี้ทำงานเฉพาะกับผลจาก AI · ถ้าจะเอามาใช้ตอนบันทึกด้วย (เพื่อกัน
 * เจ้าหน้าที่ที่บัญชีหลุดฝัง <script> ลงหน้าเว็บ) ต้องรู้ก่อนว่าของที่เขียนไว้แล้ว
 * จะไม่โดนตัดทิ้ง — สคริปต์นี้ตอบคำถามนั้น
 *
 *   npm run check:filter -- pages.json out.txt
 */
import { readFileSync, writeFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const { cleanPageHtml } = await import("../src/lib/pageHtml.ts");

const pages: { slug: string; body: string }[] = JSON.parse(readFileSync(process.argv[2], "utf8"));

const textOf = (html: string) => {
  const d = new JSDOM(`<body>${html}</body>`);
  return (d.window.document.body.textContent ?? "").replace(/\s+/g, "");
};

const CHECKS: [string, RegExp][] = [
  ["img", /<img\b/gi],
  ["a", /<a\b/gi],
  ["pdf-icon", /class="[^"]*\bpdf-icon\b/gi],
  ["--pdf-size", /--pdf-size/gi],
  ["table", /<table\b/gi],
  ["tr", /<tr\b/gi],
  ["li", /<li\b/gi],
  ["tabs", /class="[^"]*\btabs\b/gi],
  ["ebook", /class="[^"]*\bebook\b/gi],
  ["ebook-name", /class="[^"]*\bebook-name\b/gi],
  ["cards", /class="[^"]*\bcards\b/gi],
  ["people", /class="[^"]*\bpeople\b/gi],
  ["person-name", /class="[^"]*\bperson-name\b/gi],
  ["figure", /<figure\b/gi],
  ["h2", /<h2\b/gi],
];

const strip = (html: string) => html.replace(/<!--[\s\S]*?-->/g, "");
const count = (html: string, re: RegExp) => (strip(html).match(re) ?? []).length;

let bad = 0;
const report: string[] = [];

for (const page of pages) {
  const after = cleanPageHtml(page.body);
  const problems: string[] = [];

  const t1 = textOf(page.body);
  const t2 = textOf(after);
  if (t1 !== t2) {
    problems.push(`ตัวอักษรต่างกัน (${t1.length} -> ${t2.length})`);
    let i = 0;
    while (i < t1.length && i < t2.length && t1[i] === t2[i]) i++;
    problems.push(`  ก่อน: …${t1.slice(Math.max(0, i - 30), i + 60)}`);
    problems.push(`  หลัง: …${t2.slice(Math.max(0, i - 30), i + 60)}`);
  }

  for (const [name, re] of CHECKS) {
    const a = count(page.body, re);
    const b = count(after, re);
    if (a !== b) problems.push(`${name}: ${a} -> ${b}`);
  }

  if (problems.length > 0) {
    bad++;
    report.push(`\nX ${page.slug}`);
    for (const p of problems) report.push(`   ${p}`);
  } else {
    report.push(`OK ${page.slug}`);
  }
}

report.push(`\nสรุป: ผ่าน ${pages.length - bad}/${pages.length} หน้า`);
writeFileSync(process.argv[3], report.join("\n"), "utf8");
