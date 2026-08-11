import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/apiAuth";
import { hashPassword, passwordFromPhone } from "@/lib/auth";

/** เฉพาะ ADMIN เท่านั้นที่จัดการผู้ใช้ได้ */
async function requireAdmin() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  if (auth.user.role !== "ADMIN") {
    return NextResponse.json({ error: "ต้องเป็นผู้ดูแลระบบเท่านั้น" }, { status: 403 });
  }
  return auth;
}

export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const users = await db.user.findMany({
    orderBy: { username: "asc" },
    select: {
      id: true,
      username: true,
      name: true,
      phone: true,
      role: true,
      active: true,
      lastLoginAt: true,
    },
  });
  return NextResponse.json({ users });
}

/** เพิ่มผู้ใช้ใหม่ — รหัสผ่านคือ 4 ตัวท้ายของเบอร์โทร */
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json().catch(() => ({}))) as {
    username?: string;
    name?: string;
    phone?: string;
    role?: "ADMIN" | "EDITOR";
  };

  const username = body.username?.trim() ?? "";
  const name = body.name?.trim() ?? "";
  const phone = body.phone?.trim() ?? "";

  if (!username || !name) {
    return NextResponse.json({ error: "กรุณาใส่รหัสผู้ใช้และชื่อ" }, { status: 400 });
  }

  const password = passwordFromPhone(phone);
  if (!password) {
    return NextResponse.json({ error: "เบอร์โทรต้องมีตัวเลขอย่างน้อย 4 ตัว" }, { status: 400 });
  }

  if (await db.user.findUnique({ where: { username } })) {
    return NextResponse.json({ error: `มีผู้ใช้รหัส ${username} อยู่แล้ว` }, { status: 409 });
  }

  const user = await db.user.create({
    data: {
      username,
      name,
      phone,
      passwordHash: await hashPassword(password),
      role: body.role === "ADMIN" ? "ADMIN" : "EDITOR",
    },
    select: { id: true, username: true, name: true, phone: true, role: true, active: true },
  });

  return NextResponse.json({ user, password }, { status: 201 });
}
