import { NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { cleanNav, type SiteBrand } from "@/lib/nav";
import { saveSetting } from "@/lib/settings";
import { purgeEverySite } from "@/lib/mirrorPurge";

/** บันทึกเมนูนำทาง + ชื่อ/โลโก้ของหัวเว็บ */
export async function PUT(request: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json().catch(() => ({}))) as {
    nav?: unknown;
    brand?: Partial<SiteBrand>;
  };

  if (body.nav !== undefined) {
    const nav = cleanNav(body.nav);
    if (nav.length === 0) {
      return NextResponse.json({ error: "ต้องมีเมนูอย่างน้อย 1 รายการ" }, { status: 400 });
    }
    await saveSetting("nav", nav);
  }

  if (body.brand) {
    const name = body.brand.name?.trim() ?? "";
    const shortName = body.brand.shortName?.trim() ?? "";
    if (!name || !shortName) {
      return NextResponse.json({ error: "ชื่อเต็มและชื่อย่อห้ามว่าง" }, { status: 400 });
    }
    await saveSetting("siteBrand", {
      name,
      shortName,
      logoUrl: body.brand.logoUrl?.trim() ?? "",
    } satisfies SiteBrand);
  }

  // สมาชิกจะได้เห็นของใหม่ทันที ไม่ต้องรอสำเนาบนโฮสต์หมดอายุ
  purgeEverySite();
  return NextResponse.json({ ok: true });
}
