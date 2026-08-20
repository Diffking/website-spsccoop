import { NextResponse } from "next/server";
import { requireWrite } from "@/lib/apiAuth";
import { SECTION_AREA } from "@/lib/homeSectionAreas";
import { db } from "@/lib/db";
import { purgeEverySite } from "@/lib/mirrorPurge";

const SECTIONS = Object.keys(SECTION_AREA);

/**
 * จัดลำดับใหม่ทั้งส่วน — รับ id เรียงตามลำดับที่ต้องการให้แสดง
 * เขียน sortOrder ใหม่ทั้งชุดในธุรกรรมเดียว เหมือนที่ทำกับสไลด์และประกาศ
 */
export async function PUT(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { section?: unknown; order?: unknown };
  const section = typeof body.section === "string" ? body.section : "";
  if (!SECTIONS.includes(section)) {
    return NextResponse.json({ error: "ไม่รู้จักส่วนที่จะจัดลำดับ" }, { status: 400 });
  }

  // แต่ละส่วนของหน้าแรกมีเจ้าของคนละคน เช็คสิทธิ์หลังรู้แล้วว่ากำลังแก้ส่วนไหน
  const auth = await requireWrite(SECTION_AREA[section]);
  if (auth instanceof NextResponse) return auth;

  const order = Array.isArray(body.order)
    ? body.order.filter((v): v is string => typeof v === "string")
    : [];
  if (order.length === 0) {
    return NextResponse.json({ error: "ไม่ได้ส่งลำดับมา" }, { status: 400 });
  }

  // ต้องครบทุกตัวในส่วนนั้นและไม่ซ้ำ ไม่งั้นจะมีตัวที่ sortOrder ค้างของเดิมแล้วลำดับเพี้ยน
  const existing = await db.homeItem.findMany({ where: { section }, select: { id: true } });
  const ids = new Set(existing.map((i) => i.id));
  if (new Set(order).size !== order.length || order.length !== ids.size || order.some((id) => !ids.has(id))) {
    // สมาชิกจะได้เห็นของใหม่ทันที ไม่ต้องรอสำเนาบนโฮสต์หมดอายุ
    purgeEverySite();
    return NextResponse.json(
      { error: "รายการที่ส่งมาไม่ตรงกับที่มีอยู่ ลองโหลดหน้าใหม่" },
      { status: 409 },
    );
  }

  await db.$transaction(
    order.map((id, index) => db.homeItem.update({ where: { id }, data: { sortOrder: index } })),
  );

  // สมาชิกจะได้เห็นของใหม่ทันที ไม่ต้องรอสำเนาบนโฮสต์หมดอายุ
  purgeEverySite();
  return NextResponse.json({ ok: true });
}

/** เพิ่มรายการในส่วนใดส่วนหนึ่งของหน้าแรก */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, string | undefined>;
  const section = String(body.section ?? "");
  const title = String(body.title ?? "").trim();

  if (!SECTIONS.includes(section)) {
    return NextResponse.json({ error: "ไม่รู้จักส่วนนี้" }, { status: 400 });
  }

  const auth = await requireWrite(SECTION_AREA[section]);
  if (auth instanceof NextResponse) return auth;
  if (!title) {
    return NextResponse.json({ error: "ชื่อรายการห้ามว่าง" }, { status: 400 });
  }

  const last = await db.homeItem.findFirst({ where: { section }, orderBy: { sortOrder: "desc" } });

  const item = await db.homeItem.create({
    data: {
      section,
      title,
      subtitle: String(body.subtitle ?? "").trim() || null,
      icon: String(body.icon ?? "").trim() || null,
      href: String(body.href ?? "").trim() || null,
      imageUrl: String(body.imageUrl ?? "").trim() || null,
      theme: String(body.theme ?? "").trim() || null,
      category: String(body.category ?? "").trim() || null,
      sortOrder: (last?.sortOrder ?? 0) + 1,
    },
  });

  // สมาชิกจะได้เห็นของใหม่ทันที ไม่ต้องรอสำเนาบนโฮสต์หมดอายุ
  purgeEverySite();
  return NextResponse.json({ item }, { status: 201 });
}
