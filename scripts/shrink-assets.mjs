/**
 * ย่อรูปที่ถูก import เข้า bundle ให้เป็น WebP — รันมือเมื่อเพิ่มรูปใหม่เข้า src/data/asset
 *
 *   node scripts/shrink-assets.mjs
 *
 * ทำไมต้องมี: รูปใน `src/data/asset/**` ถูก import ตรงเข้าโค้ด ไม่ได้ผ่านหลังบ้าน
 * จึง **ไม่ถูกย่ออัตโนมัติเหมือนรูปที่อัปในหลังบ้าน** (ดู src/lib/image.ts)
 * 22 ส.ค. 2026 เจอว่ากองนี้รวมกัน 16.8 MB — officer.png ใบเดียว 3 MB
 * ซึ่งเป็นตัวถ่วงคะแนนมือถือหลักของหน้าแรก หนักกว่า JavaScript ทั้งหน้าถึง 3 เท่า
 *
 * ทำไมไม่เปิด image optimization ของ Next แทน: มันสร้าง URL แบบ
 * `/_next/image?url=…&w=640` หลายขนาดใน `srcset` แต่ `warm.php` บนโฮสต์อ่านแค่ `src`
 * ขนาดที่ไม่ได้อุ่นไว้จะแตกตอนปิดเครื่องเสาร์อาทิตย์ · แก้ warm.php ต้องอัป FTP
 * ซึ่งต้องขออนุญาตเจ้าของเว็บทุกครั้ง — ย่อไฟล์ต้นทางจึงคุ้มกว่าและไม่มีของแถม
 *
 * ⚠️ สคริปต์นี้ **ลบไฟล์ต้นฉบับทิ้ง** หลังแปลงเสร็จ (ย้อนกลับได้จาก git เท่านั้น)
 * และต้องไล่แก้ `import` ในโค้ดจาก .png เป็น .webp เองด้วย
 */
import sharp from "sharp";
import { readdir, stat, unlink } from "node:fs/promises";
import path from "node:path";

/** ความกว้างสูงสุดของแต่ละกอง — รูปกรรมการโชว์ในกรอบเล็ก ไม่ต้องใหญ่เท่าภาพอาคาร */
const TARGETS = [
  { dir: "src/data/asset", max: 1280 },
  { dir: "src/data/asset/committee_15_images", max: 700 },
  // สไลด์แบนเนอร์ที่ติดมากับโค้ด (ใช้ตอนยังไม่มีสไลด์ในฐาน) — โชว์ในกรอบ 16:10
  { dir: "src/data/asset/slider-img", max: 1100 },
];

let before = 0;
let after = 0;
let count = 0;

for (const target of TARGETS) {
  for (const name of await readdir(target.dir)) {
    if (!/\.(png|jpe?g)$/i.test(name)) continue;

    const src = path.join(target.dir, name);
    const out = src.replace(/\.(png|jpe?g)$/i, ".webp");
    const sizeBefore = (await stat(src)).size;
    const meta = await sharp(src).metadata();

    await sharp(src)
      // withoutEnlargement = รูปที่เล็กอยู่แล้วไม่ต้องขยาย จะได้ไม่เบลอ
      .resize({ width: Math.min(meta.width ?? target.max, target.max), withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(out);

    const sizeAfter = (await stat(out)).size;
    before += sizeBefore;
    after += sizeAfter;
    count++;
    console.log(
      `${String(Math.round(sizeBefore / 1024)).padStart(6)}KB -> ` +
        `${String(Math.round(sizeAfter / 1024)).padStart(5)}KB  ${name}`,
    );
    await unlink(src);
  }
}

console.log(
  `\nรวม ${count} ไฟล์: ${(before / 1048576).toFixed(1)} MB -> ${(after / 1048576).toFixed(2)} MB`,
);
