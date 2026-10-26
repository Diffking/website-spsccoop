import { NextResponse } from "next/server";
import { importMembers, signatureOk } from "@/lib/memberSync";

/**
 * POST https://spsccoop.org/api/eval/members/ — sync-agent ส่งทะเบียนสมาชิกทั้งชุดมาวันละ 2 รอบ
 *
 * อยู่นอก /api/admin ตั้งใจ (หลักเดียวกับ /api/holidays/sync) — ด่านคือลายเซ็น HMAC ไม่ใช่โดเมน
 * ไม่ตั้ง EVAL_API_KEY = 404 เหมือนไม่มีเส้นทางนี้
 * ⚠️ ต้องมี / ปิดท้าย (trailingSlash ใน next.config.ts) — sync-agent ไม่ตาม redirect
 * ⚠️ ห้าม log body ไม่ว่ากรณีไหน (มีชื่อสมาชิกทั้งสหกรณ์)
 */
export async function POST(request: Request) {
  if (!process.env.EVAL_API_KEY) return new NextResponse(null, { status: 404 });

  // อ่าน raw ก่อนทำอะไรทั้งนั้น — ลายเซ็นคิดจาก byte ตามที่ส่งมา
  const raw = Buffer.from(await request.arrayBuffer());
  if (!signatureOk(request.headers.get("x-eval-timestamp"), request.headers.get("x-eval-signature"), raw)) {
    return NextResponse.json({ error: "ลายเซ็นไม่ถูกต้องหรือหมดอายุ" }, { status: 401 });
  }

  try {
    const result = await importMembers(raw);
    if (result.status === 200) console.log(`รับทะเบียนสมาชิก: ${result.body.rows} คน`);
    else console.warn(`ปฏิเสธทะเบียนสมาชิก: ${result.body.error}`);
    return NextResponse.json(result.body, { status: result.status });
  } catch (e) {
    // ฐานของเราสะดุด — 5xx ให้ sync-agent ลองใหม่ (ไม่พิมพ์ body)
    console.error("บันทึกทะเบียนสมาชิกไม่สำเร็จ:", e instanceof Error ? e.message : "unknown");
    return NextResponse.json({ error: "บันทึกไม่สำเร็จ" }, { status: 500 });
  }
}
