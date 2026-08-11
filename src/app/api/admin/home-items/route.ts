import { NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { db } from "@/lib/db";

const SECTIONS = [
  "services",
  "recommends",
  "memberFeatures",
  "memberLinks",
  "committees",
  "officers",
  "footerLinks",
];

/** เพิ่มรายการในส่วนใดส่วนหนึ่งของหน้าแรก */
export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json().catch(() => ({}))) as Record<string, string | undefined>;
  const section = String(body.section ?? "");
  const title = String(body.title ?? "").trim();

  if (!SECTIONS.includes(section)) {
    return NextResponse.json({ error: "ไม่รู้จักส่วนนี้" }, { status: 400 });
  }
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
      sortOrder: (last?.sortOrder ?? 0) + 1,
    },
  });

  return NextResponse.json({ item }, { status: 201 });
}
