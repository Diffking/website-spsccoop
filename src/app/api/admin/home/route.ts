import { NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { COMMITTEE_PHOTO_SCALES } from "@/lib/committee";
import {
  DEFAULT_HOME_SECTIONS,
  DEFAULT_HOME_TONES,
  fillHomeOrder,
  isHomeSectionKey,
  isToneKey,
} from "@/lib/homeSections";
import {
  saveSetting,
  DEFAULT_TICKER,
  type InterestRates,
  type SiteInfo,
  type TickerSettings,
} from "@/lib/settings";

/** บันทึกข้อมูลสหกรณ์ + อัตราดอกเบี้ย + ตั้งค่าข่าววิ่ง ของหน้าแรก */
export async function PUT(request: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json().catch(() => ({}))) as {
    siteInfo?: SiteInfo;
    interestRates?: InterestRates;
    ticker?: Partial<TickerSettings>;
    committeeSet?: number;
    committeePhotoScale?: number;
    homeSections?: Record<string, unknown>;
    homeTones?: Record<string, unknown>;
    homeOrder?: unknown;
  };

  if (body.siteInfo) {
    const s = body.siteInfo;
    if (!s.address?.trim() || !s.phone?.trim()) {
      return NextResponse.json({ error: "ที่อยู่และเบอร์โทรห้ามว่าง" }, { status: 400 });
    }
    await saveSetting("siteInfo", s);
  }

  if (body.interestRates) {
    const r = body.interestRates;
    const bad = [...(r.deposit ?? []), ...(r.loan ?? [])].some(
      (item) => !item.label?.trim() || !/^\d+(\.\d+)?$/.test(item.rate?.trim() ?? ""),
    );
    if (bad) {
      return NextResponse.json({ error: "อัตราดอกเบี้ยต้องเป็นตัวเลข และชื่อรายการห้ามว่าง" }, { status: 400 });
    }
    const num = (value: unknown, min: number, max: number, fallback: number) => {
      const n = Math.trunc(Number(value));
      return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
    };
    await saveSetting("interestRates", {
      deposit: r.deposit ?? [],
      loan: r.loan ?? [],
      perPage: num(r.perPage, 1, 20, 5),
      autoSeconds: num(r.autoSeconds, 0, 60, 5),
    } satisfies InterestRates);
  }

  if (body.ticker) {
    const t = body.ticker;
    // บีบค่าให้อยู่ในช่วงที่ใช้ได้ แทนที่จะปฏิเสธ — พิมพ์ 999 มาก็แค่ได้ 30
    const clamp = (value: unknown, min: number, max: number, fallback: number) => {
      const n = Math.trunc(Number(value));
      return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
    };
    await saveSetting("ticker", {
      auto: t.auto ?? DEFAULT_TICKER.auto,
      limit: clamp(t.limit, 1, 30, DEFAULT_TICKER.limit),
      badgeText: (t.badgeText ?? DEFAULT_TICKER.badgeText).trim().slice(0, 12),
      badgeCount: clamp(t.badgeCount, 0, 30, DEFAULT_TICKER.badgeCount),
      badgeBlink: t.badgeBlink ?? DEFAULT_TICKER.badgeBlink,
      secondsPerItem: clamp(t.secondsPerItem, 3, 30, DEFAULT_TICKER.secondsPerItem),
    } satisfies TickerSettings);
  }

  if (body.committeeSet !== undefined) {
    const set = Math.trunc(Number(body.committeeSet));
    if (!Number.isFinite(set) || set < 1 || set > 999) {
      return NextResponse.json({ error: "ชุดที่ต้องเป็นตัวเลข 1-999" }, { status: 400 });
    }
    await saveSetting("committeeSet", set);
  }

  if (body.committeePhotoScale !== undefined) {
    const scale = Math.trunc(Number(body.committeePhotoScale));
    if (!(COMMITTEE_PHOTO_SCALES as readonly number[]).includes(scale)) {
      return NextResponse.json(
        { error: `ขนาดรูปเลือกได้เฉพาะ ${COMMITTEE_PHOTO_SCALES.join(", ")}%` },
        { status: 400 },
      );
    }
    await saveSetting("committeePhotoScale", scale);
  }

  if (body.homeSections) {
    // รับเฉพาะคีย์ที่รู้จัก และบังคับเป็น boolean — กันค่าแปลกปลอมเข้าฐาน
    const next = { ...DEFAULT_HOME_SECTIONS };
    for (const [key, value] of Object.entries(body.homeSections)) {
      if (isHomeSectionKey(key)) next[key] = value === true;
    }
    await saveSetting("homeSections", next);
  }

  if (body.homeOrder !== undefined) {
    // fill ตัดคีย์แปลกปลอม/ตัวซ้ำ และเติมส่วนที่ขาดให้ครบ — ลำดับที่เก็บจึงใช้ได้เสมอ
    await saveSetting("homeOrder", fillHomeOrder(body.homeOrder));
  }

  if (body.homeTones) {
    // รับเฉพาะคีย์และโทนที่รู้จัก ค่าที่เหลือใช้ค่าตั้งต้น
    const next = { ...DEFAULT_HOME_TONES };
    for (const [key, value] of Object.entries(body.homeTones)) {
      if (isHomeSectionKey(key) && isToneKey(value)) next[key] = value;
    }
    await saveSetting("homeTones", next);
  }

  return NextResponse.json({ ok: true });
}
