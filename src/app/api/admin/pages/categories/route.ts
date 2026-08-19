import { NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { db } from "@/lib/db";
import { groupKeyOf } from "@/lib/pageGroups";

/**
 * เปลี่ยนชื่อหมวดทีเดียวทั้งกลุ่ม
 *
 * ครอบคลุมหน้าที่ยังไม่เคยตั้งหมวดด้วย — หน้าพวกนั้นถูกจัดกลุ่มอัตโนมัติตามที่อยู่
 * (about/directory ฯลฯ) พอเปลี่ยนชื่อกลุ่มนั้นเป็นภาษาไทย ก็เท่ากับตั้งหมวดให้ทั้งกลุ่ม
 * ในคลิกเดียว ไม่ต้องเข้าไปแก้ทีละหน้า
 *
 * to ว่าง = ล้างหมวดของทั้งกลุ่ม กลับไปให้ระบบจัดกลุ่มตามที่อยู่หน้าเอง
 */
export async function PATCH(request: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json().catch(() => ({}))) as { from?: string; to?: string };
  const from = body.from?.trim() ?? "";
  const to = body.to?.trim() ?? "";

  if (!from) {
    return NextResponse.json({ error: "ไม่ได้ระบุหมวดที่จะเปลี่ยน" }, { status: 400 });
  }
  if (to.length > 60) {
    return NextResponse.json({ error: "ชื่อหมวดยาวเกินไป (ไม่เกิน 60 ตัวอักษร)" }, { status: 400 });
  }

  const pages = await db.page.findMany({ select: { id: true, slug: true, category: true } });
  const targets = pages.filter((page) => groupKeyOf(page) === from);

  if (targets.length === 0) {
    return NextResponse.json({ error: `ไม่พบหน้าที่อยู่ในหมวด "${from}"` }, { status: 404 });
  }

  await db.page.updateMany({
    where: { id: { in: targets.map((p) => p.id) } },
    data: { category: to || null },
  });

  return NextResponse.json({ moved: targets.length, from, to });
}
