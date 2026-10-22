import { NextResponse } from "next/server";
import { requireWrite } from "@/lib/apiAuth";
import { lookupMember, memberSourceReady, readIdentifier } from "@/lib/memberLookup";

/**
 * ค้นสมาชิกจากฐานทะเบียน — ให้เจ้าหน้าที่ใช้ตอนแก้คำตอบที่ระบบตรวจไม่ผ่านให้ตรงกับระบบ
 *
 * คืนข้อมูลเต็ม (ชื่อ · เบอร์ · หน่วยงาน) ต่างจากหน้าสาธารณะที่ปิดบังชื่อ — เปิดได้เฉพาะคนที่ดูแลแบบประเมิน
 * ใช้ requireWrite เพราะเป็นข้อมูลส่วนบุคคล มุมมองผู้ใช้ (ดูอย่างเดียว) ก็ไม่ควรค้นได้
 */
export async function POST(request: Request) {
  const auth = await requireWrite("surveys");
  if (auth instanceof NextResponse) return auth;

  if (!memberSourceReady()) {
    return NextResponse.json({ error: "ยังไม่ได้เชื่อมฐานสมาชิก" }, { status: 503 });
  }
  const body = (await request.json().catch(() => ({}))) as { q?: unknown };
  const id = readIdentifier(typeof body.q === "string" ? body.q : "");
  if (!id) return NextResponse.json({ error: "ใส่เลขที่สมาชิก หรือเบอร์มือถือ 10 หลัก" }, { status: 400 });

  const found = await lookupMember(id);
  if (!found.ok) {
    return NextResponse.json(
      { error: found.reason === "unavailable" ? "ฐานสมาชิกขัดข้อง ลองใหม่อีกครั้ง" : "ไม่พบในทะเบียนสมาชิก" },
      { status: found.reason === "unavailable" ? 503 : 404 },
    );
  }
  const m = found.member;
  return NextResponse.json({ member: { membNo: m.membNo, name: m.name, phone: m.phone, department: m.department } });
}
