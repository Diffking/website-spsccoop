import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireWrite } from "@/lib/apiAuth";
import { db } from "@/lib/db";
import { lookupMember, memberSourceReady } from "@/lib/memberLookup";
import { memberFields } from "@/lib/surveyVerify";

type Params = { params: Promise<{ id: string; rid: string }> };

/**
 * เจ้าหน้าที่ตรวจคำตอบรายคน — เจ้าของเว็บสั่ง 22 ต.ค. 2569:
 * "ให้เจ้าหน้าที่ไปเช็ครายคน Tag ไว้ว่าตรวจสอบ แก้ไขข้อมูลให้ตรงกับระบบ หรือตัดทิ้งตามที่เห็นสมควร"
 *
 *   { action: "assign", membNo }   ผูกกับสมาชิกคนนี้ — ชื่อ เบอร์ หน่วยงาน ดึงจากฐานให้ ไม่ให้พิมพ์เอง
 *                                  (พิมพ์เองได้ = ข้อมูลไม่ตรงกับฐาน 100% อย่างที่ต้องการ)
 *   { action: "reject", reason }   ตัดทิ้ง — เก็บแถวไว้ตรวจย้อนได้ ไม่นำไปใช้ต่อ
 *   { action: "reopen" }           ดึงกลับมาเป็น "ให้เจ้าหน้าที่ดู" (เผลอตัดผิด)
 *
 * ทุกทางติดป้าย "ตรวจสอบโดย ⟨ชื่อ⟩ · เวลา" (reviewedBy*)
 */
export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireWrite("surveys");
  if (auth instanceof NextResponse) return auth;

  const { id, rid } = await params;
  const row = await db.surveyResponse.findFirst({ where: { id: rid, surveyId: id } });
  if (!row) return NextResponse.json({ error: "ไม่พบคำตอบนี้" }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as { action?: string; membNo?: unknown; reason?: unknown };
  const tag = { reviewedById: auth.user.id, reviewedByName: auth.user.name, reviewedAt: new Date() };

  if (body.action === "assign") {
    if (!memberSourceReady()) return NextResponse.json({ error: "ยังไม่ได้เชื่อมฐานสมาชิก" }, { status: 503 });
    const membNo = typeof body.membNo === "string" ? body.membNo.replace(/\D/g, "") : "";
    if (!membNo) return NextResponse.json({ error: "ใส่เลขที่สมาชิก" }, { status: 400 });

    const found = await lookupMember({ kind: "membNo", value: membNo });
    if (!found.ok) {
      return NextResponse.json(
        { error: found.reason === "unavailable" ? "ฐานสมาชิกขัดข้อง ลองใหม่อีกครั้ง" : "ไม่พบเลขที่สมาชิกนี้ในทะเบียน" },
        { status: found.reason === "unavailable" ? 503 : 404 },
      );
    }
    try {
      await db.surveyResponse.update({
        where: { id: rid },
        data: {
          ...memberFields(found.member),
          status: "verified",
          statusNote: "เจ้าหน้าที่ตรวจและยืนยันตัวตนแล้ว",
          checkedAt: new Date(),
          ...tag,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        return NextResponse.json(
          { error: `สมาชิกเลขที่ ${found.member.membNo} มีคำตอบในแบบประเมินนี้อยู่แล้ว — รายการนี้น่าจะเป็นการตอบซ้ำ` },
          { status: 409 },
        );
      }
      throw e;
    }
    return NextResponse.json({ ok: true });
  }

  if (body.action === "reject") {
    const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 300) : "";
    if (!reason) return NextResponse.json({ error: "ใส่เหตุผลที่ตัดทิ้ง" }, { status: 400 });
    await db.surveyResponse.update({
      where: { id: rid },
      data: {
        status: "rejected",
        // ปล่อยเลขสมาชิกออก — ไม่งั้นแถวที่ตัดทิ้งไปกันคำตอบจริงของคนนั้นไม่ให้เข้าระบบ (unique)
        // เลขเดิมเก็บไว้ในเหตุผล จะได้ตรวจย้อนได้ว่าเคยผูกกับใคร
        membNo: null,
        statusNote: row.membNo ? `${reason} (เดิมผูกกับเลขที่ ${row.membNo})` : reason,
        ...tag,
      },
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "reopen") {
    await db.surveyResponse.update({
      where: { id: rid },
      data: { status: "review", statusNote: "เจ้าหน้าที่ดึงกลับมาตรวจใหม่", ...tag },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "ไม่รู้จักคำสั่งนี้" }, { status: 400 });
}
