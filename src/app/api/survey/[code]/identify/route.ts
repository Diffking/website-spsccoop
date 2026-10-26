import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { lookupMember, maskMembNo, maskName, memberSourceReady, readIdentifier } from "@/lib/memberLookup";
import { NOT_OPEN, publicSurvey } from "@/lib/surveyPublic";
import { allowLookup, recordMiss, visitorIp } from "@/lib/surveyGuard";
import { issueToken } from "@/lib/surveyToken";
import { thaiDateTime } from "@/lib/surveyTime";

type Params = { params: Promise<{ code: string }> };

/**
 * ขั้นยืนยันตัวตน — สมาชิกใส่เบอร์มือถือหรือเลขที่สมาชิก
 *
 * เจอ = คืน "ใครคนนี้" ให้กดยืนยันว่าใช่ตัวเอง + บัตรผ่านไว้แนบตอนส่งคำตอบ
 *   ชื่อปิดบังบางส่วน · เลขที่สมาชิกปิดบังบางส่วน · หน่วยงาน (เจ้าของเว็บเลือก 26 ต.ค. 2569)
 *   หน้าจอโชว์ซ้ำอีกครั้งในหน้าตรวจทานก่อนส่ง
 * ไม่คืนชื่อเต็ม เลขสมาชิกเต็ม หรือเบอร์ออกไปเด็ดขาด — ไม่งั้นช่องนี้กลายเป็นเครื่องค้นชื่อจากเบอร์
 *
 * อยู่นอก /api/admin ตั้งใจ: สมาชิกเรียกผ่าน www.spsccoop.com → ตัวมิเรอร์ส่งต่อมาที่นี่
 */
export async function POST(request: Request, { params }: Params) {
  const { code } = await params;
  const survey = await publicSurvey(code);
  if (!survey) return NextResponse.json({ error: "ไม่พบแบบประเมินนี้" }, { status: 404 });
  if (survey.status !== "open") {
    return NextResponse.json({ error: NOT_OPEN[survey.status as "scheduled" | "closed"] }, { status: 409 });
  }
  if (!memberSourceReady()) {
    return NextResponse.json(
      // offline = ให้หน้าจอเปลี่ยนไปโหมด "ฝากคำตอบ ตรวจทีหลัง" (กรอกเบอร์ + ชื่อเอง)
      { error: "ระบบยืนยันตัวตนยังไม่พร้อมใช้งาน", offline: true },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as { id?: unknown };
  const id = readIdentifier(typeof body.id === "string" ? body.id : "");
  if (!id) {
    return NextResponse.json(
      { error: "กรุณาใส่เบอร์มือถือ 10 หลัก หรือเลขที่สมาชิก (ตัวเลขเท่านั้น)" },
      { status: 400 },
    );
  }

  if (!allowLookup(visitorIp(request), `${id.kind}:${id.value}`)) {
    return NextResponse.json(
      { error: "ค้นหาหลายครั้งเกินไป กรุณารอสัก 15 นาทีแล้วลองใหม่" },
      { status: 429 },
    );
  }

  const found = await lookupMember(id);
  if (!found.ok) {
    if (found.reason === "unavailable") {
      return NextResponse.json(
        { error: "ระบบยืนยันตัวตนขัดข้องชั่วคราว", offline: true },
        { status: 503 },
      );
    }
    recordMiss();
    return NextResponse.json(
      {
        error:
          id.kind === "phone"
            ? "ไม่พบเบอร์มือถือนี้ในทะเบียนสมาชิก — ลองใช้เลขที่สมาชิกแทน หรือติดต่อสหกรณ์เพื่อปรับปรุงเบอร์"
            : "ไม่พบเลขที่สมาชิกนี้ กรุณาตรวจสอบอีกครั้ง",
      },
      { status: 404 },
    );
  }

  const { member } = found;
  const masked = maskName(member.name);
  const who = { membNo: maskMembNo(member.membNo), department: member.department ?? "" };

  const done = await db.surveyResponse.findUnique({
    where: { surveyId_membNo: { surveyId: survey.id, membNo: member.membNo } },
    select: { submittedAt: true },
  });
  if (done) {
    return NextResponse.json({ already: true, name: masked, at: thaiDateTime(done.submittedAt) });
  }

  return NextResponse.json({ name: masked, ...who, token: await issueToken(survey.id, member.membNo) });
}
