import { NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { saveSetting, type InterestRates, type SiteInfo } from "@/lib/settings";

/** บันทึกข้อมูลสหกรณ์ + อัตราดอกเบี้ยของหน้าแรก */
export async function PUT(request: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json().catch(() => ({}))) as {
    siteInfo?: SiteInfo;
    interestRates?: InterestRates;
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

  return NextResponse.json({ ok: true });
}
