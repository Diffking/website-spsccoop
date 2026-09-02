/**
 * ลองให้ AI อ่านโปสเตอร์จริง ด้วย prompt/schema ชุดเดียวกับที่หลังบ้านใช้จริง
 *
 * แก้คำสั่งใน `readSlideFromImage()` เมื่อไหร่ให้รันตัวนี้กับโปสเตอร์จริงก่อนเสมอ —
 * prompt ที่อ่านดูดีบนจอมักได้ผลไม่ตรงที่คิดกับของจริง (เคยได้คำอธิบายยาว 380 ตัวอักษร
 * ทั้งที่สั่งไม่เกิน 200 จนล้นกรอบสไลด์) และ **ห้ามเดาว่าได้ผลแล้วโดยไม่ได้ยิงดู**
 *
 *   npm run try:slide -- out.txt <ชื่อไฟล์ใน uploads/> [ไฟล์ที่สอง...]
 *
 * ผลออกเป็นไฟล์ ไม่ใช่หน้าจอ เพราะเชลล์บนเครื่องนี้ทำภาษาไทยเพี้ยน (ดู AGENTS.md)
 * · อ่านหนึ่งใบ ≈ 2,000 token ≈ 0.006 ดอลลาร์
 */
import { readFileSync, writeFileSync } from "node:fs";

// ai.ts อ่านคีย์ตอน import ต้องยัด env ให้ก่อน
for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z_]+)=(.*)$/.exec(line.trim());
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const { readSlideFromImage } = await import("../src/lib/ai.ts");

const files = process.argv.slice(3);
const out: string[] = [];

for (const file of files) {
  const b64 = readFileSync(`uploads/${file}`).toString("base64");
  try {
    const d = await readSlideFromImage(b64, "image/webp");
    out.push(
      `\n########## ${file}`,
      `  เรื่องอะไร : ${d.title}`,
      `  เงื่อนไข   : ${d.caption}`,
      `  วันจัดงาน  : ${d.eventDate || "(ไม่ได้ระบุ)"}  [${d.eventType || "ไม่ใช่กิจกรรม"}]`,
      `  เผยแพร่    : ${d.startsAt || "-"} ถึง ${d.endsAt || "-"}`,
    );
  } catch (error) {
    out.push(`\n########## ${file}`, `  พัง: ${error instanceof Error ? error.message : error}`);
  }
}

writeFileSync(process.argv[2], out.join("\n"), "utf8");
console.log("done", files.length);
