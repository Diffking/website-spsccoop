import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { DESIGNED_PAGES } from "@/lib/designedPages";

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
  const pages = await db.page
    .findMany({ where: { published: true }, select: { slug: true }, orderBy: { slug: "asc" } })
    .catch(() => []);

  const paths = [
    "/",
    ...DESIGNED_PAGES.map((p) => p.path),
    ...pages.map((p) => `/${p.slug}/`),
  ];

  const assets = await runtimeFiles();

  return NextResponse.json({
    paths: [...new Set(paths)],
    count: new Set(paths).size,
    assets,
    generatedAt: new Date().toISOString(),
  });
}
