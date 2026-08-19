import { NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { saveSetting } from "@/lib/settings";
import type { SplashContent, SplashOccasion, SplashRepeat, SplashTiming } from "@/content/splash";
import { DEFAULT_SPLASH_BG, isSplashBackground } from "@/lib/splashTheme";
import { purgeEverySite } from "@/lib/mirrorPurge";

const DATE_PATTERN = /^(?:\d{4}-)?\d{2}-\d{2}$/;

/** บันทึกหน้า splash วันสำคัญทั้งก้อน (สวิตช์ใหญ่ + ข้อความปุ่ม + รายการวันสำคัญ) */
export async function PUT(request: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json().catch(() => null)) as SplashContent | null;
  if (!body || !Array.isArray(body.occasions)) {
    return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
  }

  if (!body.buttonText?.trim()) {
    return NextResponse.json({ error: "ข้อความบนปุ่มห้ามว่าง" }, { status: 400 });
  }

  const seen = new Set<string>();
  const occasions: SplashOccasion[] = [];

  for (const raw of body.occasions) {
    const id = String(raw.id ?? "").trim();
    const name = String(raw.name ?? "").trim();
    const image = String(raw.image ?? "").trim();
    const from = String(raw.from ?? "").trim();
    const to = String(raw.to ?? "").trim();

    if (!id || !name || !image) {
      return NextResponse.json({ error: `"${name || id || "วันสำคัญ"}" ต้องมีชื่อและรูป` }, { status: 400 });
    }
    if (!DATE_PATTERN.test(from) || !DATE_PATTERN.test(to)) {
      // สมาชิกจะได้เห็นของใหม่ทันที ไม่ต้องรอสำเนาบนโฮสต์หมดอายุ
      purgeEverySite();
      return NextResponse.json(
        { error: `วันที่ของ "${name}" ต้องเป็น MM-DD หรือ YYYY-MM-DD` },
        { status: 400 },
      );
    }
    // id ซ้ำจะทำให้ปุ่มดูตัวอย่าง (?preview=id) ชี้ผิดตัว
    if (seen.has(id)) {
      return NextResponse.json({ error: `รหัส "${id}" ซ้ำกัน` }, { status: 400 });
    }
    seen.add(id);

    occasions.push({
      id,
      name,
      enabled: Boolean(raw.enabled),
      from,
      to,
      image,
      alt: String(raw.alt ?? "").trim(),
      headline: String(raw.headline ?? "").trim(),
      subtext: String(raw.subtext ?? "").trim(),
      // ค่าที่ไม่รู้จักถอยไปใช้พื้นดำ ดีกว่าปล่อยค่าแปลกลงฐานแล้วหน้าเว็บพื้นหาย
      bg: isSplashBackground(raw.bg) ? raw.bg : DEFAULT_SPLASH_BG,
    });
  }

  // ค่าที่ไม่รู้จักถอยไปใช้พฤติกรรมเดิม (ตามวันที่ · ครั้งเดียวต่อการเข้าเว็บ)
  const timing: SplashTiming = body.timing === "now" ? "now" : "schedule";
  const repeat: SplashRepeat = body.repeat === "always" ? "always" : "session";

  await saveSetting("splash", {
    enabled: Boolean(body.enabled),
    buttonText: body.buttonText.trim(),
    timing,
    repeat,
    occasions,
  } satisfies SplashContent);

  // สมาชิกจะได้เห็นของใหม่ทันที ไม่ต้องรอสำเนาบนโฮสต์หมดอายุ
  purgeEverySite();
  return NextResponse.json({ ok: true });
}
