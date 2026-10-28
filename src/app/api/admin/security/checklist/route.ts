import { NextResponse } from "next/server";
import { requireWrite } from "@/lib/apiAuth";
import { db } from "@/lib/db";
import { MACHINE_ITEMS, checklistState } from "@/lib/securityReport";

/** ติ๊ก/ยกเลิก "จัดการแล้ว" ของรายการค้างบนเครื่อง — ADMIN เท่านั้น · body = { id, done } */
export async function PUT(request: Request) {
  const auth = await requireWrite();
  if (auth instanceof NextResponse) return auth;
  if (auth.user.role !== "ADMIN") return NextResponse.json({ error: "เฉพาะผู้ดูแลระบบ" }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as { id?: unknown; done?: unknown };
  const id = typeof body.id === "string" ? body.id : "";
  if (!MACHINE_ITEMS.some((i) => i.id === id)) return NextResponse.json({ error: "ไม่รู้จักรายการนี้" }, { status: 400 });

  const state = await checklistState();
  state[id] = { done: body.done === true, by: auth.user.name, at: new Date().toISOString() };
  await db.setting.upsert({
    where: { key: "securityChecklist" },
    create: { key: "securityChecklist", value: state },
    update: { value: state },
  });
  return NextResponse.json({ ok: true, item: state[id] });
}
