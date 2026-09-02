/**
 * ให้ AI อ่านรูปสไลด์ที่มีอยู่ทุกใบใหม่ แล้วเขียนออกมาเป็น SQL ให้ตรวจก่อนใช้
 *
 * มีปุ่มกดทีละใบในหลังบ้านอยู่แล้ว (หน้าสไลด์ → ไอคอนรูปประกาย) ตัวนี้มีไว้สำหรับ
 * ตอนที่แก้คำสั่ง AI แล้วอยากไล่อ่านใหม่ทั้งชุดในรอบเดียว โดยไม่ต้องนั่งกดทีละใบ
 *
 * ⚠️ **ไม่เขียนฐานเอง** — ออกมาเป็นไฟล์ .sql กับรายงานเทียบก่อน/หลัง ให้อ่านก่อน
 * แล้วค่อยป้อนเข้า psql เอง (หลักเดียวกับที่ AI ไม่เคยบันทึกเองในหลังบ้าน)
 *
 * ⚠️ **วันที่ที่ AI อ่านไม่เจอ จะไม่ถูกเขียนทับ** ไม่งั้นวันที่ที่เจ้าหน้าที่ตั้งเองจะหาย
 *
 *   docker compose exec -T db psql -U coopsmile coopsmile -tAc \
 *     "select json_agg(json_build_object('id',id,'imageUrl',\"imageUrl\",'title',title, \
 *      'caption',caption)) from \"Slide\" where published" > slides.json
 *   npm run reread:slides -- slides.json out.txt out.sql
 */
import { readFileSync, writeFileSync } from "node:fs";

for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z_]+)=(.*)$/.exec(line.trim());
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const { readSlideFromImage } = await import("../src/lib/ai.ts");

type Slide = { id: string; imageUrl: string; title: string; caption: string | null };
const slides: Slide[] = JSON.parse(readFileSync(process.argv[2], "utf8"));

const report: string[] = [];
const sql: string[] = [];
const q = (s: string) => `'${s.replace(/'/g, "''")}'`;

for (const slide of slides) {
  const file = slide.imageUrl.split("/").pop() ?? "";
  let draft;
  try {
    draft = await readSlideFromImage(readFileSync(`uploads/${file}`).toString("base64"), "image/webp");
  } catch (error) {
    report.push(`\n########## ${slide.title}`, `  พัง: ${error instanceof Error ? error.message : error}`);
    continue;
  }

  const sets: string[] = [];
  if (draft.title.trim()) sets.push(`title = ${q(draft.title.trim())}`);
  if (draft.caption.trim()) sets.push(`caption = ${q(draft.caption.trim())}`);
  /*
    ⚠️ ปักปฏิทินเฉพาะใบที่ AI บอกเองว่าเป็นกิจกรรม (eventType ไม่ว่าง)

    ใบรับสมัครกรรมการตอบ eventType="" (ไม่ใช่กิจกรรม) แต่ดัน**ให้วันอบรมเตรียมความพร้อม
    มาเป็น eventDate** ซึ่งเป็นวันที่ผ่านไปแล้ว เอาไปปักปฏิทินก็ผิดเรื่อง
    — สองช่องนี้ขัดกันเมื่อไหร่ให้เชื่อ eventType
  */
  // วันที่ผ่านไปแล้วไม่ต้องปัก — ใบรับสมัครมักอ้างถึงวันอบรมที่จัดไปแล้วเป็นเงื่อนไข
  const future = draft.eventDate >= new Date().toISOString().slice(0, 10);
  if (draft.eventDate && draft.eventType && future) {
    // วันที่เก็บเป็นเที่ยงคืนเวลาไทย เหมือน parseDay() ใน src/app/api/admin/slides/route.ts
    sets.push(`"eventDate" = ${q(`${draft.eventDate}T00:00:00+07:00`)}::timestamptz`);
    sets.push(`"eventType" = ${q(draft.eventType)}`);
  }
  /*
    ⚠️ **ไม่แตะช่วงเวลาเผยแพร่ของสไลด์ที่มีอยู่แล้ว**

    ใบอบรมอาชีพเสริมถูกอ่านได้ startsAt = endsAt = วันจัดงาน (5 ก.ย.) ซึ่งถ้าเขียนลงไป
    สไลด์จะ**หายจากหน้าแรกทันที**จนกว่าจะถึงวันนั้น (getSlides() กรอง startsAt)
    · ช่วงเวลาที่ตั้งไว้เดิมเจ้าหน้าที่ตั้งใจตั้งเอง และคิวสไลด์ก็เรียงตาม endsAt อยู่
    ใบใหม่ที่เพิ่งอัปยังได้วันจาก AI ตามปกติ ตรงนี้กันเฉพาะการไล่เขียนทับทั้งชุด
  */

  report.push(
    `\n########## ${slide.title}`,
    `  หัวข้อใหม่ : ${draft.title} (${draft.title.length} ตัวอักษร)`,
    `  เงื่อนไขเดิม: ${slide.caption ?? "(ว่าง)"}`,
    `  เงื่อนไขใหม่: ${draft.caption} (${draft.caption.length} ตัวอักษร)`,
    `  วันจัดงาน  : ${draft.eventDate || "(ไม่ระบุ)"} [${draft.eventType || "-"}]`,
    `  เผยแพร่    : ${draft.startsAt || "-"} ถึง ${draft.endsAt || "-"}`,
  );

  if (sets.length > 0) {
    sql.push(`update "Slide" set ${sets.join(", ")}, "updatedAt" = now() where id = ${q(slide.id)};`);
  }
}

writeFileSync(process.argv[3], report.join("\n"), "utf8");
writeFileSync(process.argv[4], sql.join("\n") + "\n", "utf8");
console.log(`อ่านแล้ว ${slides.length} ใบ · เขียน SQL ${sql.length} คำสั่ง`);
