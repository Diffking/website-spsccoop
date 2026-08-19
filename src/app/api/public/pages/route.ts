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

export async function GET() {
  const pages = await db.page
    .findMany({ where: { published: true }, select: { slug: true }, orderBy: { slug: "asc" } })
    .catch(() => []);

  const paths = [
    "/",
    ...DESIGNED_PAGES.map((p) => p.path),
    ...pages.map((p) => `/${p.slug}/`),
  ];

  return NextResponse.json({
    paths: [...new Set(paths)],
    count: new Set(paths).size,
    generatedAt: new Date().toISOString(),
  });
}
