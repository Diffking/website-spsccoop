import { NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { saveSetting } from "@/lib/settings";
import type { SeoPage, SeoSettings } from "@/lib/seo";
import { purgeEverySite } from "@/lib/mirrorPurge";

/** บันทึกการตั้งค่า SEO ทั้งก้อน */
export async function PUT(request: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json().catch(() => null)) as SeoSettings | null;
  if (!body || !Array.isArray(body.pages)) {
    return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
  }

  const siteUrl = String(body.siteUrl ?? "").trim().replace(/\/$/, "");
  try {
    // ต้องเป็น URL ที่ใช้ได้จริง ไม่งั้น new URL() ในหน้าเว็บจะพังทั้งเว็บ
    new URL(siteUrl);
  } catch {
    // สมาชิกจะได้เห็นของใหม่ทันที ไม่ต้องรอสำเนาบนโฮสต์หมดอายุ
    purgeEverySite();
    return NextResponse.json(
      { error: "ที่อยู่เว็บไซต์ไม่ถูกต้อง ต้องขึ้นต้นด้วย https://" },
      { status: 400 },
    );
  }

  if (!body.siteName?.trim() || !body.defaultTitle?.trim()) {
    return NextResponse.json({ error: "ชื่อเว็บไซต์และหัวข้อตั้งต้นห้ามว่าง" }, { status: 400 });
  }

  const seen = new Set<string>();
  const pages: SeoPage[] = [];

  for (const raw of body.pages) {
    const path = String(raw.path ?? "").trim();
    const label = String(raw.label ?? "").trim();

    if (!path.startsWith("/")) {
      // สมาชิกจะได้เห็นของใหม่ทันที ไม่ต้องรอสำเนาบนโฮสต์หมดอายุ
      purgeEverySite();
      return NextResponse.json(
        { error: `เส้นทาง "${path || "(ว่าง)"}" ต้องขึ้นต้นด้วย /` },
        { status: 400 },
      );
    }
    if (seen.has(path)) {
      return NextResponse.json({ error: `เส้นทาง "${path}" ซ้ำกัน` }, { status: 400 });
    }
    seen.add(path);

    pages.push({
      path,
      label: label || path,
      indexed: Boolean(raw.indexed),
      title: String(raw.title ?? "").trim(),
      description: String(raw.description ?? "").trim(),
    });
  }

  await saveSetting("seo", {
    enabled: Boolean(body.enabled),
    // ค่าที่ไม่รู้จักถอยไปใช้ "ทุกหน้า" ตามพฤติกรรมเดิม
    scope: body.scope === "home" || body.scope === "home-strict" ? body.scope : "all",
    siteUrl,
    siteName: body.siteName.trim(),
    defaultTitle: body.defaultTitle.trim(),
    defaultDescription: String(body.defaultDescription ?? "").trim(),
    keywords: (body.keywords ?? []).map((k) => String(k).trim()).filter(Boolean),
    pages,
  } satisfies SeoSettings);

  // สมาชิกจะได้เห็นของใหม่ทันที ไม่ต้องรอสำเนาบนโฮสต์หมดอายุ
  purgeEverySite();
  return NextResponse.json({ ok: true });
}
