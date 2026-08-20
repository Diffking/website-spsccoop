import { NextResponse, type NextRequest } from "next/server";

/**
 * หลังบ้านเปิดได้เฉพาะโดเมนของหลังบ้าน
 * โดเมนสาธารณะ (spsccoop.com) จะตอบ 404 เหมือนไม่มีหน้านี้อยู่จริง
 * — คนนอกหาหลังบ้านไม่เจอ ถึงจะเดา URL ถูกก็ตาม
 *
 * ตั้งค่าโดเมนหลังบ้านที่ ADMIN_HOST ใน .env
 * ไม่ตั้ง = เปิดได้ทุกโดเมน (สะดวกตอน dev บน localhost)
 *
 * ใส่ได้หลายโดเมนคั่นด้วยจุลภาค เช่น admin.coopsmile.org,coopsmile.org
 * — ใช้ตอนย้ายทางเข้าไปโดเมนใหม่ เปิดทางเก่าค้างไว้จนกว่าทางใหม่จะใช้ได้จริง
 * แล้วค่อยลบทางเก่าออก ไม่ต้องเสี่ยงเข้าหลังบ้านไม่ได้ทั้งสองทาง
 */
export function proxy(request: NextRequest) {
  const hosts = (process.env.ADMIN_HOST ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);

  if (hosts.length === 0) {
    return NextResponse.next();
  }

  const host = request.headers.get("host")?.split(":")[0].toLowerCase() ?? "";
  // localhost เปิดไว้เสมอ — ตั้งค่าโดเมนผิดแล้วยังเข้าหลังบ้านจากเครื่องนี้ได้ ไม่ล็อกตัวเองออก
  const allowed = hosts.includes(host) || host === "localhost" || host === "127.0.0.1";

  if (!allowed) {
    return new NextResponse(null, { status: 404 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/auth/:path*", "/api/admin/:path*"],
};
