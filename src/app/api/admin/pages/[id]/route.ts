import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, toSlug } from "@/lib/apiAuth";
import { cleanPageFolder, pageFolder } from "@/lib/ftp";
import { repairStructure } from "@/lib/htmlStructure";
import { limitInlineStyles } from "@/lib/pageHtml";
import { purgeEverySite } from "@/lib/mirrorPurge";

type Params = { params: Promise<{ id: string }> };

/** แก้หน้าเนื้อหา — ส่งมาเฉพาะช่องที่เปลี่ยนก็ได้ */
export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const existing = await db.page.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "ไม่พบหน้านี้" }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    title?: string;
    slug?: string;
    content?: string;
    published?: boolean;
    assetFolder?: string;
    category?: string;
  };

  const data: {
    title?: string;
    slug?: string;
    body?: string;
    published?: boolean;
    assetFolder?: string;
    category?: string | null;
  } = {};

  if (typeof body.title === "string") {
    const title = body.title.trim();
    if (!title) return NextResponse.json({ error: "ชื่อหน้าห้ามว่าง" }, { status: 400 });
    data.title = title;
  }

  if (typeof body.slug === "string") {
    const slug = toSlug(body.slug);
    if (!slug) return NextResponse.json({ error: "ที่อยู่หน้าไม่ถูกต้อง" }, { status: 400 });
    if (slug !== existing.slug) {
      const clash = await db.page.findUnique({ where: { slug } });
      if (clash) {
        return NextResponse.json({ error: `มีหน้าที่ใช้ที่อยู่ "${slug}" อยู่แล้ว` }, { status: 409 });
      }
    }
    data.slug = slug;
  }

  /*
   * ด่านสุดท้ายก่อนลงฐาน — ซ่อมโครงสร้าง <div> ให้สมดุลเสมอ
   *
   * หน้าจอแก้ไขซ่อมให้อยู่แล้ว แต่ด่านนี้กันทุกทางที่เขียนเนื้อหา (สคริปต์ เครื่องมืออื่น
   * หรือหน้าจอที่ยังไม่ได้อัปเดต) ไม่ให้บันทึกโครงที่ทำหน้าเว็บเพี้ยนลงไปได้เลย
   */
  if (typeof body.content === "string") {
    data.body = limitInlineStyles(repairStructure(body.content));
  }
  if (typeof body.published === "boolean") data.published = body.published;

  /*
   * โฟลเดอร์เก็บไฟล์ของหน้านี้ — พิมพ์ผิดรูปแบบก็ไม่ปฏิเสธ แต่ใช้ชื่อที่คำนวณจาก slug แทน
   * (ไฟล์ต้องมีที่อยู่เสมอ ปล่อยว่างแล้วไฟล์จะไปกองผิดที่)
   */
  // หมวดไว้จัดกลุ่มในหลังบ้านเท่านั้น เว้นว่าง = ให้ระบบจัดกลุ่มตามที่อยู่หน้าเอง
  if (typeof body.category === "string") data.category = body.category.trim() || null;

  if (typeof body.assetFolder === "string") {
    data.assetFolder = cleanPageFolder(body.assetFolder, data.slug ?? existing.slug);
  } else if (data.slug && !existing.assetFolder) {
    // หน้าเก่าที่ยังไม่เคยตั้งโฟลเดอร์ — เติมให้ตอนบันทึกครั้งแรก
    data.assetFolder = pageFolder(data.slug);
  }

  const page = await db.page.update({ where: { id }, data });
  // สมาชิกจะได้เห็นของใหม่ทันที ไม่ต้องรอสำเนาบนโฮสต์หมดอายุ
  purgeEverySite();
  return NextResponse.json({ page });
}

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  await db.page.deleteMany({ where: { id } });
  // สมาชิกจะได้เห็นของใหม่ทันที ไม่ต้องรอสำเนาบนโฮสต์หมดอายุ
  purgeEverySite();
  return NextResponse.json({ ok: true });
}
