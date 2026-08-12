import { NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
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
    await saveSetting("interestRates", r);
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
    } satisfies TickerSettings);
  }

  return NextResponse.json({ ok: true });
}
