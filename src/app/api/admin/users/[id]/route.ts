import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/apiAuth";
import { hashPassword, passwordFromPhone, verifyPassword } from "@/lib/auth";
import { cleanAreas } from "@/lib/permissions";

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
    areas?: unknown;
    active?: boolean;
    /** ตั้งรหัสผ่านเอง — เจ้าตัวเท่านั้น และต้องยืนยันรหัสเดิมด้วย */
    password?: string;
    currentPassword?: string;
    /** ADMIN สั่งตั้งรหัสใหม่จากเบอร์โทรให้คนที่ลืมรหัส */
    resetPassword?: boolean;
  };

  const data: {
    name?: string;
    phone?: string;
    passwordHash?: string;
    ownPassword?: boolean;
    role?: "ADMIN" | "EDITOR";
    areas?: string[];
    active?: boolean;
  } = {};
  let newPassword: string | null = null;

  if (typeof body.name === "string") {
    if (!body.name.trim()) return NextResponse.json({ error: "ชื่อห้ามว่าง" }, { status: 400 });
    data.name = body.name.trim();
  }

  if (typeof body.phone === "string") {
    const phone = body.phone.trim();
    const fromPhone = passwordFromPhone(phone);
    if (!fromPhone) {
      return NextResponse.json({ error: "เบอร์โทรต้องมีตัวเลขอย่างน้อย 4 ตัว" }, { status: 400 });
    }
    data.phone = phone;

    /*
     * เบอร์โทรเป็นที่มาของรหัสผ่าน "ตั้งต้น" เท่านั้น
     * ใครที่ตั้งรหัสเองไปแล้ว แก้เบอร์ต้องไม่ทำให้รหัสที่ตั้งไว้หายไปเงียบ ๆ
     * — ลืมรหัสให้ ADMIN กดตั้งรหัสใหม่จากเบอร์แทน (resetPassword ข้างล่าง)
     */
    if (!target.ownPassword) {
      newPassword = fromPhone;
      data.passwordHash = await hashPassword(fromPhone);
    }
  }

  /*
   * ตั้งรหัสผ่านเอง — เจ้าตัวเท่านั้น และต้องยืนยันรหัสเดิม
   *
   * ที่ต้องถามรหัสเดิมทั้งที่ล็อกอินอยู่แล้ว เพราะกันกรณีลุกจากโต๊ะโดยไม่ล็อกหน้าจอ
   * แล้วมีคนมาเปลี่ยนรหัสยึดบัญชีไป
   */
  if (typeof body.password === "string") {
    if (!isSelf) {
      return NextResponse.json(
        { error: "ตั้งรหัสผ่านให้คนอื่นไม่ได้ — ถ้าเขาลืมรหัส ให้กด “ตั้งรหัสใหม่จากเบอร์โทร”" },
        { status: 403 },
      );
    }
    const next = body.password;
    if (next.trim().length < 8) {
      return NextResponse.json({ error: "รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร" }, { status: 400 });
    }
    if (!(await verifyPassword(target.username, String(body.currentPassword ?? "")))) {
      return NextResponse.json({ error: "รหัสผ่านเดิมไม่ถูกต้อง" }, { status: 400 });
    }
    data.passwordHash = await hashPassword(next);
    data.ownPassword = true;
  }

  /* ADMIN ตั้งรหัสใหม่จากเบอร์โทรให้คนที่ลืมรหัส — คืนรหัสใหม่ไปบอกเจ้าตัว */
  if (body.resetPassword === true) {
    if (!isAdmin) {
      return NextResponse.json({ error: "ต้องเป็นผู้ดูแลระบบเท่านั้น" }, { status: 403 });
    }
    const fromPhone = passwordFromPhone(data.phone ?? target.phone ?? "");
    if (!fromPhone) {
      return NextResponse.json(
        { error: "ผู้ใช้คนนี้ยังไม่มีเบอร์โทร ใส่เบอร์ก่อนแล้วค่อยตั้งรหัสใหม่" },
        { status: 400 },
      );
    }
    newPassword = fromPhone;
    data.passwordHash = await hashPassword(fromPhone);
    data.ownPassword = false;
  }

  // เปลี่ยนสิทธิ์/พื้นที่รับผิดชอบ/ปิดใช้งาน ทำได้เฉพาะ ADMIN และห้ามทำกับตัวเอง (กันล็อกตัวเองออกจากระบบ)
  if (typeof body.role === "string" || typeof body.active === "boolean" || body.areas !== undefined) {
    if (!isAdmin) {
      return NextResponse.json({ error: "ต้องเป็นผู้ดูแลระบบเท่านั้น" }, { status: 403 });
    }
    if (isSelf) {
      return NextResponse.json({ error: "เปลี่ยนสิทธิ์หรือปิดใช้งานบัญชีตัวเองไม่ได้" }, { status: 400 });
    }
    if (typeof body.role === "string") data.role = body.role === "ADMIN" ? "ADMIN" : "EDITOR";
    if (typeof body.active === "boolean") data.active = body.active;
    if (body.areas !== undefined) data.areas = cleanAreas(body.areas);
    // ยกขึ้นเป็น ADMIN = ดูแลทั้งเว็บ พื้นที่เดิมไม่มีความหมายแล้ว
    if (data.role === "ADMIN") data.areas = [];
  }

  const user = await db.user.update({
    where: { id },
    data,
    select: {
      id: true,
      username: true,
      name: true,
      phone: true,
      role: true,
      areas: true,
      active: true,
      ownPassword: true,
    },
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
