import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, toSlug } from "@/lib/apiAuth";
import { pageFolder } from "@/lib/ftp";
import { purgeEverySite } from "@/lib/mirrorPurge";

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

/**
 * หมวดที่ควรได้ตอนสร้างหน้าใหม่ — เอาจากหน้าแม่ก่อน ไม่มีก็ดูหน้าพี่น้องที่อยู่ชั้นเดียวกัน
 * ไม่เจอเลยคืน null (ระบบจะจัดกลุ่มตามที่อยู่หน้าให้เอง)
 */
async function inheritCategory(slug: string): Promise<string | null> {
  const parts = slug.split("/").filter(Boolean);
  if (parts.length < 2) return null;

  const parent = parts.slice(0, -1).join("/");
  const family = await db.page
    .findMany({
      where: { OR: [{ slug: parent }, { slug: { startsWith: `${parent}/` } }] },
      select: { slug: true, category: true },
    })
    .catch(() => []);

  const fromParent = family.find((p) => p.slug === parent)?.category?.trim();
  if (fromParent) return fromParent;

  // หน้าพี่น้องใช้หมวดไหนมากสุดก็เอาอันนั้น
  const counts = new Map<string, number>();
  for (const page of family) {
    const key = page.category?.trim();
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const best = [...counts].sort((a, b) => b[1] - a[1])[0];
  return best?.[0] ?? null;
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
   *
   * หมวดก็รับมาจากหน้าข้างเคียงเลย — สร้าง download/doc-welfare ต่อจาก download/doc-loan
   * ก็ควรอยู่หมวด "ดาวน์โหลดเอกสาร" เหมือนกัน ไม่ใช่ปล่อยไว้ว่างแล้วไปโผล่เป็นกลุ่ม "download"
   */
  const page = await db.page.create({
    data: { title, slug, assetFolder: pageFolder(slug), category: await inheritCategory(slug) },
  });
  // สมาชิกจะได้เห็นของใหม่ทันที ไม่ต้องรอสำเนาบนโฮสต์หมดอายุ
  purgeEverySite();
  return NextResponse.json({ page }, { status: 201 });
}
