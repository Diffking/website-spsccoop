import { NextResponse } from "next/server";
import { applyHolidaySync } from "@/lib/holidaySync";

/**
 * ตัวดึงวันหยุดอัตโนมัติเรียกที่นี่ — service `holiday-sync` ใน docker-compose.yml
 *
 * **ไม่มีอะไรเปลี่ยนก็ไม่ทำอะไรเลย** ไม่เขียนฐาน ไม่ล้างสำเนาบนโฮสต์ ไม่ขึ้น log
 * (ตัวเรียกเงียบเมื่อได้ added:0 renamed:0) วิ่งทุก 6 ชม. จึงไม่สร้างงานให้ใคร
 *
 * อยู่นอก /api/admin ตั้งใจ — เส้นทางนั้นเปิดได้เฉพาะโดเมนหลังบ้าน (src/proxy.ts)
 * ส่วนตัวตั้งเวลาเรียกผ่านชื่อ `web:3000` ในเน็ตเวิร์ก Docker ซึ่งไม่ใช่โดเมนหลังบ้าน
 *
 * ด่านของเส้นทางนี้จึงเป็น **โทเคน** แทน: ตั้ง `HOLIDAY_SYNC_TOKEN` ใน .env
 * ไม่ตั้ง = ปิดตาย ตอบ 404 เหมือนไม่มีเส้นทางนี้อยู่ (เผลอเปิดทิ้งไว้ไม่ได้)
 *
 * ไม่ทับชื่อที่เจ้าหน้าที่แก้ไว้เด็ดขาด — ตรงนี้ไม่มีใครนั่งดูว่ามันทับอะไรไป
 * ใครอยากทับต้องไปกดเองในหลังบ้าน (มีให้ติ๊กยืนยันทีละครั้ง)
 */
export async function POST(request: Request) {
  const expected = (process.env.HOLIDAY_SYNC_TOKEN ?? "").trim();
  if (!expected) {
    return NextResponse.json({ error: "ไม่พบเส้นทางนี้" }, { status: 404 });
  }

  const url = new URL(request.url);
  const given = request.headers.get("x-sync-token") ?? url.searchParams.get("token") ?? "";
  if (given !== expected) {
    return NextResponse.json({ error: "โทเคนไม่ถูกต้อง" }, { status: 401 });
  }

  const result = await applyHolidaySync(false);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    added: result.added,
    renamed: result.renamed,
    // บอกด้วยว่าเพิ่มวันไหนไปบ้าง เผื่อต้องย้อนดูใน log ว่าของมาจากไหน
    dates: result.changed.map((item) => `${item.date} ${item.title}`),
  });
}
