import { NextResponse } from "next/server";
import { requireWrite } from "@/lib/apiAuth";
import { canArea, type AreaKey } from "@/lib/permissions";
import { KINDS } from "@/lib/announcementKinds";
import { TICKER_MAX_PER_KIND } from "@/lib/content";
import { COMMITTEE_PHOTO_SCALES } from "@/lib/committee";
import { fillOfficeHours, type OfficeHours } from "@/lib/officeHours";
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
import { purgeEverySite } from "@/lib/mirrorPurge";

/**
 * ค่าตั้งแต่ละก้อนในคำขอนี้อยู่คนละหน้าในหลังบ้าน จึงอยู่ในความรับผิดชอบคนละคน
 * (route เดียวรับหมดเพราะทุกก้อนลงตาราง Setting เหมือนกัน)
 */
const FIELD_AREA: Record<string, AreaKey> = {
  siteInfo: "footer",
  officeHours: "footer",
  interestRates: "home.rates",
  ticker: "home.ticker",
  committeeSet: "home.committees",
  committeePhotoScale: "home.committees",
  homeSections: "home.layout",
  homeTones: "home.layout",
  homeOrder: "home.layout",
};

/** บันทึกข้อมูลสหกรณ์ + อัตราดอกเบี้ย + ตั้งค่าข่าววิ่ง ของหน้าแรก */
export async function PUT(request: Request) {
  const auth = await requireWrite();
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
    officeHours?: Partial<OfficeHours>;
  };

  // ส่งอะไรมาก็ต้องดูแลส่วนนั้นให้ครบทุกก้อน ไม่ใช่มีสิทธิ์ก้อนเดียวแล้วแอบแก้ก้อนอื่นติดมาด้วย
  for (const [field, area] of Object.entries(FIELD_AREA)) {
    if (body[field as keyof typeof body] !== undefined && !canArea(auth.user, area)) {
      return NextResponse.json({ error: "ส่วนนี้ไม่ได้อยู่ในความรับผิดชอบของคุณ" }, { status: 403 });
    }
  }

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
    // โควตาป้ายแยกตามหมวด — รับเฉพาะหมวดที่รู้จัก ที่เหลือใช้ค่าตั้งต้น
    const counts = { ...DEFAULT_TICKER.badgeCounts };
    for (const kind of KINDS) {
      counts[kind] = clamp(t.badgeCounts?.[kind], 0, 30, DEFAULT_TICKER.badgeCounts[kind]);
    }

    await saveSetting("ticker", {
      auto: t.auto ?? DEFAULT_TICKER.auto,
      perKind: clamp(t.perKind, 1, TICKER_MAX_PER_KIND, DEFAULT_TICKER.perKind),
      badgeText: (t.badgeText ?? DEFAULT_TICKER.badgeText).trim().slice(0, 12),
      badgeCounts: counts,
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
      // สมาชิกจะได้เห็นของใหม่ทันที ไม่ต้องรอสำเนาบนโฮสต์หมดอายุ
      purgeEverySite();
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

  if (body.officeHours) {
    // fill ตัดวันแปลก ๆ และเวลาที่รูปแบบผิดทิ้งให้แล้ว เหลือแต่ค่าที่ใช้ได้จริง
    const hours = fillOfficeHours(body.officeHours);
    if (hours.open >= hours.close) {
      return NextResponse.json({ error: "เวลาเปิดต้องมาก่อนเวลาปิด" }, { status: 400 });
    }
    await saveSetting("officeHours", hours);
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

  // สมาชิกจะได้เห็นของใหม่ทันที ไม่ต้องรอสำเนาบนโฮสต์หมดอายุ
  purgeEverySite();
  return NextResponse.json({ ok: true });
}
