import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { WARM_ONLY_PATHS, publicPaths } from "@/lib/publicPaths";

/**
 * รายชื่อที่อยู่หน้าสาธารณะทั้งหมด — ให้ตัวมิเรอร์ฝั่งโฮสต์เอาไปไล่ดึงมาเก็บล่วงหน้า
 *
 * เปิดสาธารณะได้เพราะไม่มีอะไรลับ (เป็นที่อยู่หน้าที่ใครก็เปิดดูได้อยู่แล้ว)
 * และตัวมิเรอร์อยู่คนละเครื่อง จะให้ล็อกอินก่อนก็ยุ่งยากเกินเหตุ
 * หน้าที่ยังไม่เผยแพร่ไม่อยู่ในรายการนี้
 */

export const dynamic = "force-dynamic";

/**
 * ไฟล์ที่หน้าเว็บเรียกใช้ตอนทำงาน แต่ไม่ได้เขียนที่อยู่ไว้ใน HTML สักหน้า
 *
 * ตัวมิเรอร์ฝั่งโฮสต์เก็บของจากที่เห็นใน HTML เท่านั้น สามกลุ่มนี้จึงหลุดไป:
 *   1. ตัวถอดรหัส PDF ของตัวอ่านหนังสือ — สคริปต์สร้างที่อยู่ตอนกดอ่าน
 *   2. ฟอนต์ — ที่อยู่ซ่อนอยู่ใน CSS ไม่ใช่ใน HTML
 *   3. สคริปต์ที่โหลดเพิ่มทีหลัง — ชื่อไฟล์ฝังอยู่ในสคริปต์ตัวหลักอีกที
 *   4. **รูปที่อยู่หลังสไลด์** — แบนเนอร์ · ทำเนียบกรรมการ · รายการที่เลื่อนเอง
 *      หน้าเว็บวาดทีละใบ ใน HTML จึงมีแค่ใบแรกใบเดียว อีก 10 กว่าใบไม่มีที่อยู่ให้เห็นเลย
 *
 * ขาดกลุ่มไหนไป พอเครื่องที่สำนักงานปิดตอนกลางคืนหรือวันหยุด สมาชิกจะเจอหน้าเว็บ
 * ฟอนต์เพี้ยน ปุ่มกดไม่ทำงาน หรือกดอ่านหนังสือแล้วค้าง — บอกรายชื่อไปให้เก็บล่วงหน้าเสียเลย
 */
async function runtimeFiles(): Promise<string[]> {
  const found = ["/pdf.worker.min.mjs"];

  for (const dir of ["cmaps", "standard_fonts", "wasm"]) {
    const names = await readdir(join(process.cwd(), "public", "pdfjs", dir)).catch(() => []);
    found.push(...names.map((name) => `/pdfjs/${dir}/${name}`));
  }

  /*
    รูปที่อัปจากหลังบ้านทั้งโฟลเดอร์ (~2.7 MB · ~110 ไฟล์)

    ⚠️ **นี่คือของที่หายไปตอนปิดเครื่อง** — ของที่เลื่อนเองทุกตัว (แบนเนอร์ ·
    ทำเนียบกรรมการ · การ์ดที่วนทีละใบ) วาดลง HTML แค่ใบที่กำลังแสดงอยู่ใบเดียว
    ตัวอุ่นแคชอ่านที่อยู่จาก HTML จึงเก็บได้แค่รูปใบแรกของแต่ละสไลด์
    พอปิดเครื่องแล้วสไลด์วนไปใบที่ 2 รูปก็แตก (เจอจริง 24 ส.ค. 2026 — รูปกรรมการ
    ชุดที่ 45 ขึ้นไม่ครบบน www.spsccoop.com ตอนเครื่องนี้ปิด)

    เอาเฉพาะ**รูป** ไม่เอา PDF — PDF ในโฟลเดอร์เดียวกันหนัก 310 MB ซึ่งเกินพื้นที่
    แคชของโฮสต์ · ไฟล์ PDF ส่วนใหญ่มีลิงก์อยู่ในหน้าดาวน์โหลดอยู่แล้ว ตัวอุ่นแคช
    เห็นเองจาก HTML
  */
  const uploads = await readdir(join(process.cwd(), "public", "uploads")).catch(() => []);
  found.push(
    ...uploads
      .filter((name) => /\.(png|jpe?g|webp|gif|svg|avif)$/i.test(name))
      .map((name) => `/uploads/${name}`),
  );

  // ไฟล์ประกอบเว็บทั้งชุด (~20 MB) — ไล่ทั้งโฟลเดอร์ดีกว่าไล่เดาว่าหน้าไหนใช้อะไร
  const root = join(process.cwd(), ".next", "static");
  const walk = async (dir: string, prefix: string): Promise<void> => {
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const url = `${prefix}/${entry.name}`;
      if (entry.isDirectory()) {
        await walk(join(dir, entry.name), url);
      } else {
        found.push(url);
      }
    }
  };
  await walk(root, "/_next/static");

  return found;
}

export async function GET() {
  const paths = [...new Set([...(await publicPaths()), ...WARM_ONLY_PATHS])];

  const assets = await runtimeFiles();

  return NextResponse.json({
    paths,
    count: paths.length,
    assets,
    generatedAt: new Date().toISOString(),
  });
}
