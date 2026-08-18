import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, toSlug } from "@/lib/apiAuth";
import { pageFolder } from "@/lib/ftp";

/** รายการหน้าเนื้อหาทั้งหมด */
export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const pages = await db.page.findMany({
    orderBy: { slug: "asc" },
    select: { id: true, slug: true, title: true, published: true, updatedAt: true },
  });
  return NextResponse.json({ pages });
}

/** สร้างหน้าใหม่ */
export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json().catch(() => ({}))) as { title?: string; slug?: string };
  const title = body.title?.trim() ?? "";
  const slug = toSlug(body.slug || title);

  if (!title) {
    return NextResponse.json({ error: "กรุณาใส่ชื่อหน้า" }, { status: 400 });
  }
  if (!slug) {
    return NextResponse.json({ error: "ที่อยู่หน้า (slug) ไม่ถูกต้อง" }, { status: 400 });
  }
  if (await db.page.findUnique({ where: { slug } })) {
    return NextResponse.json({ error: `มีหน้าที่ใช้ที่อยู่ "${slug}" อยู่แล้ว` }, { status: 409 });
  }

  /*
   * ตั้งโฟลเดอร์เก็บไฟล์ของหน้านี้ให้ตั้งแต่ตอนสร้าง — ไฟล์ที่แนบในหน้าจะได้ไม่ไปกอง
   * รวมกันหมดในโฟลเดอร์เดียว เจ้าหน้าที่แก้ชื่อโฟลเดอร์เองทีหลังได้ที่หน้าแก้ไข
   */
  const page = await db.page.create({
    data: { title, slug, assetFolder: pageFolder(slug) },
  });
  return NextResponse.json({ page }, { status: 201 });
}
