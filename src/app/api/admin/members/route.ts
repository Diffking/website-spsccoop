import { NextResponse } from "next/server";
import { requireWrite } from "@/lib/apiAuth";
import { lookupByPhone, lookupMember, memberSourceReady, normalizePhone, readMembNo } from "@/lib/memberLookup";
import { clearMembers } from "@/lib/memberSync";

/**
 * ค้นสมาชิกจากทะเบียน — ให้เจ้าหน้าที่ใช้ตอนแก้คำตอบที่ระบบตรวจไม่ผ่านให้ตรงกับระบบ
 *
 * คืนชื่อเต็ม · กลุ่มเรียกเก็บ ต่างจากหน้าสาธารณะที่ปิดบังชื่อ — เปิดได้เฉพาะคนที่ดูแลแบบประเมิน
 * ใช้ requireWrite เพราะเป็นข้อมูลส่วนบุคคล มุมมองผู้ใช้ (ดูอย่างเดียว) ก็ไม่ควรค้นได้
 * ค้นด้วยเบอร์ได้ด้วยการ HMAC เบอร์ที่พิมพ์แล้วเทียบ — ทะเบียนไม่มีเบอร์จริง จึงไม่มีเบอร์ส่งกลับ
 */
export async function POST(request: Request) {
  const auth = await requireWrite("surveys");
  if (auth instanceof NextResponse) return auth;

  if (!(await memberSourceReady())) {
    return NextResponse.json({ error: "ยังไม่ได้รับทะเบียนสมาชิกจาก sync-agent" }, { status: 503 });
  }
  const body = (await request.json().catch(() => ({}))) as { q?: unknown };
  const phone = normalizePhone(body.q);
  const membNo = phone ? null : readMembNo(body.q);
  if (!phone && !membNo) return NextResponse.json({ error: "ใส่เลขที่สมาชิก หรือเบอร์มือถือ 10 หลัก" }, { status: 400 });

  const found = phone ? await lookupByPhone(phone) : await lookupMember(membNo!);
  if (!found.ok) {
    return NextResponse.json(
      { error: found.reason === "unavailable" ? "ทะเบียนสมาชิกไม่พร้อม ลองใหม่อีกครั้ง" : "ไม่พบในทะเบียนสมาชิก" },
      { status: found.reason === "unavailable" ? 503 : 404 },
    );
  }
  const m = found.member;
  return NextResponse.json({ member: { membNo: m.membNo, name: m.name, phone: m.phone, department: m.department } });
}

/** จบการประเมินแล้ว ลบทะเบียนทั้งชุด (สเปก sync-agent ข้อ 5) — ADMIN เท่านั้น */
export async function DELETE() {
  const auth = await requireWrite("surveys");
  if (auth instanceof NextResponse) return auth;
  if (auth.user.role !== "ADMIN") return NextResponse.json({ error: "เฉพาะผู้ดูแลระบบ" }, { status: 403 });
  const removed = await clearMembers();
  console.log(`ลบทะเบียนสมาชิก ${removed} คน โดย ${auth.user.username}`);
  return NextResponse.json({ ok: true, removed });
}
