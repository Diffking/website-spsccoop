import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/apiAuth";
import { hashPassword, passwordFromPhone } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

/**
 * แก้ผู้ใช้ — เปลี่ยนเบอร์โทรแล้วรหัสผ่านเปลี่ยนตามทันที (4 ตัวท้าย)
 *
 * เจ้าตัวแก้เบอร์ตัวเองได้ ส่วน ADMIN แก้ของคนอื่นได้ด้วย
 */
export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const target = await db.user.findUnique({ where: { id } });
  if (!target) {
    return NextResponse.json({ error: "ไม่พบผู้ใช้" }, { status: 404 });
  }

  const isAdmin = auth.user.role === "ADMIN";
  const isSelf = auth.user.id === id;
  if (!isAdmin && !isSelf) {
    return NextResponse.json({ error: "แก้ได้เฉพาะข้อมูลของตัวเอง" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    phone?: string;
    role?: "ADMIN" | "EDITOR";
    active?: boolean;
  };

  const data: {
    name?: string;
    phone?: string;
    passwordHash?: string;
    role?: "ADMIN" | "EDITOR";
    active?: boolean;
  } = {};
  let newPassword: string | null = null;

  if (typeof body.name === "string") {
    if (!body.name.trim()) return NextResponse.json({ error: "ชื่อห้ามว่าง" }, { status: 400 });
    data.name = body.name.trim();
  }

  if (typeof body.phone === "string") {
    const phone = body.phone.trim();
    newPassword = passwordFromPhone(phone);
    if (!newPassword) {
      return NextResponse.json({ error: "เบอร์โทรต้องมีตัวเลขอย่างน้อย 4 ตัว" }, { status: 400 });
    }
    data.phone = phone;
    data.passwordHash = await hashPassword(newPassword);
  }

  // เปลี่ยนสิทธิ์/ปิดใช้งาน ทำได้เฉพาะ ADMIN และห้ามทำกับตัวเอง (กันล็อกตัวเองออกจากระบบ)
  if (typeof body.role === "string" || typeof body.active === "boolean") {
    if (!isAdmin) {
      return NextResponse.json({ error: "ต้องเป็นผู้ดูแลระบบเท่านั้น" }, { status: 403 });
    }
    if (isSelf) {
      return NextResponse.json({ error: "เปลี่ยนสิทธิ์หรือปิดใช้งานบัญชีตัวเองไม่ได้" }, { status: 400 });
    }
    if (typeof body.role === "string") data.role = body.role === "ADMIN" ? "ADMIN" : "EDITOR";
    if (typeof body.active === "boolean") data.active = body.active;
  }

  const user = await db.user.update({
    where: { id },
    data,
    select: { id: true, username: true, name: true, phone: true, role: true, active: true },
  });

  // ปิดใช้งานแล้วต้องเตะออกจากระบบทันที ไม่ให้ session เดิมใช้ต่อได้
  if (data.active === false) {
    await db.session.deleteMany({ where: { userId: id } });
  }

  return NextResponse.json({ user, password: newPassword });
}

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  if (auth.user.role !== "ADMIN") {
    return NextResponse.json({ error: "ต้องเป็นผู้ดูแลระบบเท่านั้น" }, { status: 403 });
  }

  const { id } = await params;
  if (auth.user.id === id) {
    return NextResponse.json({ error: "ลบบัญชีตัวเองไม่ได้" }, { status: 400 });
  }

  await db.user.deleteMany({ where: { id } });
  return NextResponse.json({ ok: true });
}
