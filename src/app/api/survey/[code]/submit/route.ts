import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { lookupMember } from "@/lib/memberLookup";
import { NOT_OPEN, publicSurvey } from "@/lib/surveyPublic";
import { readToken } from "@/lib/surveyToken";
import { checkAnswers } from "@/lib/surveyAnswers";

type Params = { params: Promise<{ code: string }> };

/**
 * ส่งคำตอบ — ต้องมีบัตรผ่านจากขั้นยืนยันตัวตนเสมอ
 *
 * ค้นสมาชิกซ้ำอีกรอบจากเลขในบัตร เพื่อเอาชื่อ · เบอร์ · หน่วยงานล่าสุดมาเก็บคู่กับคำตอบ
 * (ข้อมูลชุดนี้ใช้ตอนจับรางวัลและแยกผลตามหน่วยงาน ไม่เคยส่งกลับไปให้หน้าจอ)
 *
 * ตอบซ้ำไม่ได้ — ฐานกันไว้ที่ unique(surveyId, membNo) ต่อให้กดส่งพร้อมกันสองแท็บก็ตาม
 */
export async function POST(request: Request, { params }: Params) {
  const { code } = await params;
  const survey = await publicSurvey(code);
  if (!survey) return NextResponse.json({ error: "ไม่พบแบบประเมินนี้" }, { status: 404 });
  if (survey.status !== "open") {
    return NextResponse.json({ error: NOT_OPEN[survey.status as "scheduled" | "closed"] }, { status: 409 });
  }

  const body = (await request.json().catch(() => ({}))) as { token?: unknown; answers?: unknown };
  const membNo = await readToken(body.token, survey.id);
  if (!membNo) {
    return NextResponse.json(
      { error: "หมดเวลายืนยันตัวตนแล้ว กรุณาเริ่มใหม่อีกครั้ง", restart: true },
      { status: 401 },
    );
  }

  const { answers, missing } = checkAnswers(survey.items, body.answers);
  if (missing.length) {
    return NextResponse.json(
      { error: `ยังตอบไม่ครบ ${missing.length} ข้อ`, missing },
      { status: 400 },
    );
  }

  const found = await lookupMember({ kind: "membNo", value: membNo });
  if (!found.ok) {
    return NextResponse.json(
      { error: "ระบบยืนยันตัวตนขัดข้องชั่วคราว คำตอบยังไม่ถูกบันทึก", offline: true },
      { status: 503 },
    );
  }
  const { member } = found;

  try {
    await db.surveyResponse.create({
      data: {
        surveyId: survey.id,
        membNo: member.membNo,
        name: member.name,
        phone: member.phone,
        department: member.department,
        profile: member.profile as Prisma.InputJsonValue,
        answers: answers as Prisma.InputJsonValue,
        // ยืนยันตัวตนสดกับฐานแล้วทั้งตอนกรอกเบอร์และตอนส่ง — ตรวจแล้วตั้งแต่ต้น
        status: "verified",
        checkedAt: new Date(),
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "ท่านตอบแบบประเมินนี้ไปแล้ว", already: true }, { status: 409 });
    }
    throw error;
  }

  return NextResponse.json({ ok: true });
}
