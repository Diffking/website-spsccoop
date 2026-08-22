/**
 * แปลงรูปเก่าใน uploads/ ให้เป็น WebP แล้วสร้าง SQL สำหรับแก้ที่อยู่ในฐาน — รันครั้งเดียว
 *
 *   node scripts/uploads-to-webp.mjs           # ดูว่าจะเปลี่ยนอะไรบ้าง (ไม่แตะไฟล์)
 *   node scripts/uploads-to-webp.mjs --write   # แปลงจริง + เขียนไฟล์ SQL ออกมา
 *
 * ที่มา: 22 ส.ค. 2026 วัดหน้าแรกแล้วพบว่ารูปรวมกัน 5.3 MB ซึ่งหนักกว่า JavaScript
 * ทั้งหน้าถึงสามเท่า และเป็นตัวถ่วงคะแนนมือถือหลัก · รูปพวกนี้ถูกย่อเหลือ 600px แล้ว
 * แต่ยังเก็บเป็น PNG ซึ่งไม่เหมาะกับภาพถ่าย ใบละ 300-700 KB
 *
 * ตั้งแต่นี้ไปรูปที่อัปใหม่ถูกเก็บเป็น WebP อยู่แล้ว (ดู src/lib/image.ts)
 * สคริปต์นี้มีไว้ตามเก็บของเก่าที่อัปไว้ก่อนหน้านั้น
 *
 * ⚠️ ไม่แตะ SVG (เป็นเวกเตอร์ เล็กอยู่แล้ว) · ไม่แตะ GIF (ภาพเคลื่อนไหวจะเสีย)
 * ⚠️ ไม่แตะ PDF
 * ⚠️ ไฟล์ต้นฉบับถูกลบหลังแปลง — ย้อนกลับได้จากไฟล์สำรองรายวันใน backups/ เท่านั้น
 */
import sharp from "sharp";
import { readdir, stat, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";

const WRITE = process.argv.includes("--write");
const DIR = "uploads";
const SQL_OUT = "uploads-webp.sql";

/** ตารางกับคอลัมน์ที่เก็บที่อยู่ไฟล์ไว้ — ตกหล่นสักที่รูปจะหายจากหน้าเว็บทันที */
/* ⚠️ ชื่อคอลัมน์ต้องมีเครื่องหมายคำพูดด้วย — Postgres แปลงชื่อที่ไม่ได้ครอบไว้เป็นตัวเล็กหมด
   `imageUrl` จะกลายเป็น `imageurl` แล้วฟ้องว่าไม่มีคอลัมน์นี้ (พลาดมาแล้ว 22 ส.ค. 2026) */
const COLUMNS = [
  ['"Slide"', '"imageUrl"'],
  ['"HomeItem"', '"imageUrl"'],
  ['"Announcement"', '"fileUrl"'],
  ['"Page"', '"body"'],
  ['"Media"', '"url"'],
];

const pairs = [];
let before = 0;
let after = 0;

for (const name of await readdir(DIR)) {
  if (!/\.(png|jpe?g)$/i.test(name)) continue;

  const src = path.join(DIR, name);
  const out = name.replace(/\.(png|jpe?g)$/i, ".webp");
  const sizeBefore = (await stat(src)).size;

  if (!WRITE) {
    console.log(`${String(Math.round(sizeBefore / 1024)).padStart(6)}KB  ${name}`);
    before += sizeBefore;
    pairs.push([name, out]);
    continue;
  }

  // ย่อมาแล้วตั้งแต่ตอนอัป ตรงนี้แค่เปลี่ยนรูปแบบไฟล์ ไม่ต้อง resize ซ้ำให้ภาพเสีย
  const data = await sharp(await readFile(src)).webp({ quality: 82 }).toBuffer();
  await writeFile(path.join(DIR, out), data);
  await unlink(src);

  before += sizeBefore;
  after += data.length;
  pairs.push([name, out]);
  console.log(
    `${String(Math.round(sizeBefore / 1024)).padStart(6)}KB -> ` +
      `${String(Math.round(data.length / 1024)).padStart(5)}KB  ${name}`,
  );
}

if (WRITE) {
  const lines = ["BEGIN;"];
  for (const [table, column] of COLUMNS) {
    for (const [from, to] of pairs) {
      lines.push(
        `UPDATE ${table} SET ${column} = replace(${column}, '/uploads/${from}', '/uploads/${to}') ` +
          `WHERE ${column} LIKE '%/uploads/${from}%';`,
      );
    }
  }
  // ชนิดไฟล์ในตารางสื่อต้องตรงกับของจริง ไม่งั้นตัวอ่านไฟล์ฝั่ง AI จะปฏิเสธ
  lines.push(`UPDATE "Media" SET "mimeType" = 'image/webp' WHERE url LIKE '%.webp';`);
  lines.push("COMMIT;");
  await writeFile(SQL_OUT, lines.join("\n") + "\n", "utf8");
  console.log(
    `\nแปลง ${pairs.length} ไฟล์: ${(before / 1048576).toFixed(1)} MB -> ${(after / 1048576).toFixed(2)} MB`,
  );
  console.log(`เขียน SQL ไว้ที่ ${SQL_OUT} — เอาไปรันกับฐานต่อ`);
} else {
  console.log(`\nพบ ${pairs.length} ไฟล์ รวม ${(before / 1048576).toFixed(1)} MB (ยังไม่ได้แตะอะไร)`);
  console.log("รันซ้ำด้วย --write เพื่อแปลงจริง");
}
