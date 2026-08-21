import { NextResponse, type NextRequest } from "next/server";

/**
 * หลังบ้านเปิดได้เฉพาะโดเมนของหลังบ้าน
 * โดเมนสาธารณะ (spsccoop.com) จะตอบ 404 เหมือนไม่มีหน้านี้อยู่จริง
 * — คนนอกหาหลังบ้านไม่เจอ ถึงจะเดา URL ถูกก็ตาม
 *
 * ตั้งค่าโดเมนหลังบ้านที่ ADMIN_HOST ใน .env
 * ไม่ตั้ง = เปิดได้ทุกโดเมน (สะดวกตอน dev บน localhost)
 *
 * ใส่ได้หลายโดเมนคั่นด้วยจุลภาค เช่น admin.spsccoop.org,spsccoop.org
 * — ใช้ตอนย้ายทางเข้าไปโดเมนใหม่ เปิดทางเก่าค้างไว้จนกว่าทางใหม่จะใช้ได้จริง
 * แล้วค่อยลบทางเก่าออก ไม่ต้องเสี่ยงเข้าหลังบ้านไม่ได้ทั้งสองทาง
 */
/** อ่านรายชื่อโดเมนจาก .env — คั่นด้วยจุลภาค เว้นวรรคได้ ตัวพิมพ์ใหญ่เล็กไม่สำคัญ */
function hostList(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

export function proxy(request: NextRequest) {
  const hosts = hostList(process.env.ADMIN_HOST);
  const host = request.headers.get("host")?.split(":")[0].toLowerCase() ?? "";

  /*
   * โดเมนที่มีไว้ทำงานหลังบ้านอย่างเดียว — เปิดหน้าแรกแล้วพาไปหลังบ้านให้เลย
   * เจ้าหน้าที่จะได้พิมพ์แค่ admin.spsccoop.org ไม่ต้องต่อ /admin ทุกครั้ง
   *
   * ตั้งแยกจาก ADMIN_HOST ไม่ได้รวมกัน เพราะ spsccoop.org ก็อยู่ใน ADMIN_HOST เหมือนกัน
   * แต่หน้าแรกของมันคือหน้าเว็บจริงที่ตัวมิเรอร์ดึงไปให้สมาชิก ถ้าพาไปหลังบ้านด้วย
   * สมาชิกจะเปิดเว็บไม่ได้ทั้งเว็บ — โดเมนที่ใส่ตรงนี้ต้องเป็นโดเมนของหลังบ้านล้วน ๆ เท่านั้น
   */
  if (request.nextUrl.pathname === "/") {
    if (hostList(process.env.ADMIN_ROOT_HOST).includes(host)) {
      // 307 ไม่ใช่ 308 — เบราว์เซอร์จะได้ไม่จำถาวร เผื่อวันหลังเปลี่ยนใจให้โดเมนนี้ทำอย่างอื่น
      return NextResponse.redirect(new URL("/admin/", request.url), 307);
    }
    // หน้าแรกของโดเมนอื่นต้องเปิดได้เสมอ ห้ามเอาด่านหลังบ้านข้างล่างมาปิด
    return NextResponse.next();
  }

  if (hosts.length === 0) {
    return NextResponse.next();
  }
  // localhost เปิดไว้เสมอ — ตั้งค่าโดเมนผิดแล้วยังเข้าหลังบ้านจากเครื่องนี้ได้ ไม่ล็อกตัวเองออก
  const allowed = hosts.includes(host) || host === "localhost" || host === "127.0.0.1";

  if (!allowed) {
    return new NextResponse(null, { status: 404 });
  }
  return NextResponse.next();
}

export const config = {
  // "/" อยู่ในรายการเพราะต้องพาหน้าแรกของโดเมนหลังบ้านไป /admin — หน้าอื่นไม่ถูกแตะ
  // /login ต้องอยู่ด้วย ไม่งั้นโดเมนสาธารณะจะเปิดหน้าเข้าสู่ระบบได้ทั้งที่หลังบ้านซ่อนอยู่
  matcher: ["/", "/login/:path*", "/admin/:path*", "/api/auth/:path*", "/api/admin/:path*"],
};
