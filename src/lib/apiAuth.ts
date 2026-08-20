import { NextResponse } from "next/server";
import { currentView, type SessionUser } from "@/lib/auth";
import { canArea, canPage, type Actor, type AreaKey } from "@/lib/permissions";

/**
 * ตัวช่วยสำหรับ API หลังบ้าน — เรียกต้นฟังก์ชันทุก route
 *
 * อ่านอย่างเดียวใช้ requireUser() ส่วนอะไรที่เขียนลงฐาน/ส่งไฟล์ ให้ใช้ requireWrite()
 * พร้อมบอกพื้นที่ที่ route นั้นดูแล:
 *
 *   const auth = await requireWrite("home.announcements");
 *   if (auth instanceof NextResponse) return auth;   // ไม่ล็อกอิน / ไม่มีสิทธิ์ / อยู่ในมุมมองผู้ใช้
 *   // ใช้ auth.user ต่อได้เลย
 */
export async function requireUser(): Promise<{ user: SessionUser } | NextResponse> {
  const view = await currentView();
  if (!view) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }
  return { user: view.user };
}

/** ข้อความเดียวกันทุกที่ — เจ้าหน้าที่จะได้รู้ว่าไม่ใช่ระบบพัง แต่ไม่ใช่หน้าที่ตัวเอง */
const NO_RIGHT = "ส่วนนี้ไม่ได้อยู่ในความรับผิดชอบของคุณ";

/**
 * ด่านสำหรับทุก route ที่เขียนข้อมูล — กันไว้สามชั้น
 *
 * 1. ยังไม่ได้ล็อกอิน → 401
 * 2. ADMIN กำลังเปิดมุมมองผู้ใช้อยู่ → 403 (มุมมองนั้นดูได้อย่างเดียวเสมอ
 *    ต่อให้กดปุ่มจากหน้าจอเก่าที่ค้างอยู่ หรือยิงตรงมาที่ API ก็เขียนไม่ได้)
 * 3. ไม่ได้ดูแลพื้นที่นี้ → 403
 *
 * ไม่ส่ง area มา = แค่ต้องล็อกอินและไม่ได้อยู่ในมุมมองผู้ใช้ (เช่น อัปไฟล์ ให้ AI อ่านภาพ)
 */
export async function requireWrite(
  area?: AreaKey | AreaKey[],
): Promise<{ user: SessionUser } | NextResponse> {
  const view = await currentView();
  if (!view) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }
  if (view.viewing) {
    return NextResponse.json(
      { error: `กำลังดูในมุมมองของ ${view.user.name} — มุมมองนี้ดูได้อย่างเดียว แก้ไขไม่ได้` },
      { status: 403 },
    );
  }
  if (area && !canArea(view.user, area)) {
    return NextResponse.json({ error: NO_RIGHT }, { status: 403 });
  }
  return { user: view.user };
}

/** เหมือน requireWrite แต่เช็คสิทธิ์จากหมวดของหน้าเนื้อหาที่กำลังจะแก้ */
export async function requireWritePage(
  page: { slug: string; category?: string | null },
): Promise<{ user: SessionUser } | NextResponse> {
  const auth = await requireWrite();
  if (auth instanceof NextResponse) return auth;
  if (!canPage(auth.user as Actor, page)) {
    return NextResponse.json({ error: NO_RIGHT }, { status: 403 });
  }
  return auth;
}

/** แปลงข้อความให้เป็น slug ที่ใช้ใน URL ได้ — รองรับภาษาไทย */
export function toSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^\p{L}\p{N}/-]+/gu, "")
    .replace(/-{2,}/g, "-")
    .replace(/^[-/]+|[-/]+$/g, "");
}
