import { NextResponse } from "next/server";
import { applyEventSync } from "@/lib/officerEventSync";

/**
 * ตัวดึงกิจกรรมอัตโนมัติเรียกที่นี่ — service `holiday-sync` ใน docker-compose.yml
 * (service เดียวกับวันหยุด ยิงสองเส้นทางในรอบเดียว จะได้ไม่ต้องมีตัวตั้งเวลาสองตัว)
 *
 * **เพิ่มของใหม่ทุกชนิด** (`addAll`) · **อัปเดต/ลบเฉพาะรอบรถตู้ที่มาจากระบบสำนักงาน**
 * (`followVan` — ตารางออกหน่วยบนหน้าเว็บต้องตรงกับที่รถออกจริง) · ของที่เจ้าหน้าที่พิมพ์เอง
 * และโครงการ/สัมมนา การทับหรือลบยังต้องมีคนติ๊กเองในหลังบ้านเท่านั้น
 *
 * **ไม่มีอะไรเปลี่ยนก็ไม่ทำอะไรเลย** ไม่เขียนฐาน ไม่ล้างสำเนาบนโฮสต์ ไม่ขึ้น log
 * วิ่งทุก 6 ชม. จึงไม่สร้างงานให้ใคร
 *
 * อยู่นอก /api/admin ตั้งใจ — เส้นทางนั้นเปิดได้เฉพาะโดเมนหลังบ้าน (src/proxy.ts)
 * ส่วนตัวตั้งเวลาเรียกผ่านชื่อ `web:3000` ในเน็ตเวิร์ก Docker ซึ่งไม่ใช่โดเมนหลังบ้าน
 *
 * ด่านของเส้นทางนี้จึงเป็น **โทเคน** แทน — ใช้ตัวเดียวกับวันหยุด (`HOLIDAY_SYNC_TOKEN`)
 * หรือจะตั้งแยกที่ `CALENDAR_SYNC_TOKEN` ก็ได้ · ไม่ตั้งเลย = ปิดตาย ตอบ 404
 * เหมือนไม่มีเส้นทางนี้อยู่ (เผลอเปิดทิ้งไว้ไม่ได้)
 */
export async function POST(request: Request) {
  const expected = (
    process.env.CALENDAR_SYNC_TOKEN ??
    process.env.HOLIDAY_SYNC_TOKEN ??
    ""
  ).trim();
  if (!expected) {
    return NextResponse.json({ error: "ไม่พบเส้นทางนี้" }, { status: 404 });
  }

  const url = new URL(request.url);
  const given = request.headers.get("x-sync-token") ?? url.searchParams.get("token") ?? "";
  if (given !== expected) {
    return NextResponse.json({ error: "โทเคนไม่ถูกต้อง" }, { status: 401 });
  }

  const result = await applyEventSync({ addAll: true, followVan: true });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    added: result.added,
    changed: result.changed,
    removed: result.removed,
  });
}
