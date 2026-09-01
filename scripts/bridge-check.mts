/**
 * ตรวจว่าตัวแกะทำเนียบของ CoopBridge อ่านคนได้ครบทุกคนจริง
 *
 * ข้อมูลที่ส่งให้ระบบอื่นถูกแกะมาจาก HTML ของหน้าเนื้อหา (src/lib/coopBridge.ts)
 * ถ้าแกะพลาด ระบบปลายทางจะได้ทะเบียนบุคลากรที่ขาดคนไปโดยไม่มีอะไรฟ้อง —
 * และคนที่หายจะไม่มีใครรู้จนกว่าจะมีคนไปนั่งนับเทียบทีละรูป
 *
 * ตัวตรวจนี้เทียบ **จำนวน `<figure>` ในเนื้อหา** กับ **จำนวนคนที่แกะได้** ทุกหน้า
 * ต้องเท่ากันเป๊ะ แล้วพิมพ์รายชื่อที่จะส่งออกไปให้อ่านด้วยตา
 *
 * ⚠️ แก้ readPeople() หรือโครง HTML ของทำเนียบเมื่อไหร่ ให้รันซ้ำทุกครั้ง
 *
 * วิธีใช้ — ดึงเนื้อหาจากฐานของเว็บจริงก่อน แล้วค่อยรัน:
 *
 *   docker compose exec -T db psql -U coopsmile coopsmile -tAc \
 *     "select json_agg(json_build_object('slug', slug, 'title', title, 'body', body)) \
 *      from \"Page\" where published = true and slug like 'about/directory%'" > dir.json
 *   npm run check:bridge -- dir.json out.txt
 *
 * ผลออกเป็นไฟล์ ไม่ใช่หน้าจอ เพราะเชลล์บนเครื่องนี้ทำภาษาไทยเพี้ยน (ดู AGENTS.md)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { readPeople } from "../src/lib/coopBridge.ts";

const pages: { slug: string; title: string; body: string }[] = JSON.parse(
  readFileSync(process.argv[2], "utf8"),
);

const lines: string[] = [];
let total = 0;
let review = 0;
let broken = 0;

for (const page of pages) {
  const { people, captionsHidden } = readPeople(page.body, "https://spsccoop.org", {});
  // นับ <figure> ในเนื้อหาดิบ — ตัวเลขนี้คือ "ความจริง" ที่ตัวแกะต้องได้เท่ากัน
  const figures = (page.body.match(/<figure/g) ?? []).length;
  const ok = figures === people.length;
  if (!ok) broken += 1;

  lines.push(
    `\n########## ${page.slug} — ${page.title}`,
    `  <figure> ในเนื้อหา ${figures} · แกะได้ ${people.length}  ${ok ? "ครบ" : "*** ไม่ครบ ***"}`,
    `  ซ่อนชื่อใต้รูปบนหน้าเว็บ: ${captionsHidden ? "ใช่" : "ไม่"}`,
  );

  total += people.length;
  for (const p of people) {
    if (p.nameSource === "alt" || p.nameSource === "none") review += 1;
    lines.push(
      `  ${String(p.order).padStart(2)} [แถว ${p.row}] ${p.name || "(ไม่มีชื่อ)"}` +
        ` | ${p.role || "-"} | ${p.nameSource} | ${p.photoPath}`,
    );
  }
}

lines.push(
  "",
  "=".repeat(60),
  `รวม ${total} คน จาก ${pages.length} หน้า`,
  `ชื่อที่ยังไม่มีใครตรวจ (เดาจากคำบรรยายรูป) ${review} คน`,
  broken === 0 ? "ทุกหน้าแกะได้ครบ" : `*** ${broken} หน้าแกะได้ไม่ครบ ***`,
);

writeFileSync(process.argv[3] ?? "bridge-check.txt", lines.join("\n"), "utf8");
console.log(`pages=${pages.length} people=${total} needsReview=${review} broken=${broken}`);
if (broken > 0) process.exit(1);
