import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentView, startViewAs, stopViewAs } from "@/lib/auth";

/**
 * มุมมองผู้ใช้ — ADMIN สวมมุมมองของเจ้าหน้าที่คนหนึ่งเพื่อดูว่าเขาเห็นเมนูอะไรบ้าง
 *
 * เห็นอย่างเดียว แก้ไม่ได้ — ทุก route ที่เขียนข้อมูลใช้ requireWrite() ซึ่งปฏิเสธ
 * ทุกคำขอที่ส่งมาระหว่างเปิดมุมมองอยู่ ไม่ว่าจะกดจากหน้าจอหรือยิงตรงมาที่ API
 *
 * เปิด/ปิดมุมมองต้องเช็คจาก session จริงเสมอ (currentView().real) ไม่ใช่ตัวตนที่สวมอยู่
 * ไม่งั้นพอสวมเป็น EDITOR แล้วจะออกจากมุมมองไม่ได้ ติดอยู่ในนั้นจนกว่าจะล็อกเอาต์
 */

export async function POST(request: Request) {
  const view = await currentView();
  if (!view) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }
  if (view.real.role !== "ADMIN") {
    return NextResponse.json({ error: "ต้องเป็นผู้ดูแลระบบเท่านั้น" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { userId?: string };
  const userId = body.userId?.trim() ?? "";
  if (!userId) {
    return NextResponse.json({ error: "ไม่ได้ระบุผู้ใช้ที่จะดูมุมมอง" }, { status: 400 });
  }
  if (userId === view.real.id) {
    return NextResponse.json({ error: "นี่คือบัญชีของคุณเอง" }, { status: 400 });
  }

  const target = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, username: true },
  });
  if (!target) {
    return NextResponse.json({ error: "ไม่พบผู้ใช้" }, { status: 404 });
  }

  await startViewAs(target.id);
  return NextResponse.json({ viewing: target });
}

export async function DELETE() {
  const view = await currentView();
  if (!view) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }

  await stopViewAs();
  return NextResponse.json({ ok: true });
}
