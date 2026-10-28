import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  checkMember,
  maskMembNo,
  maskName,
  memberSourceReady,
  normalizePhone,
  phoneHash,
  readMembNo,
} from "@/lib/memberLookup";
import { NOT_OPEN, publicSurvey } from "@/lib/surveyPublic";
import { allowLookup, recordMiss, visitorIp } from "@/lib/surveyGuard";
import { issueToken } from "@/lib/surveyToken";
import { thaiDateTime } from "@/lib/surveyTime";
import { logSecurity } from "@/lib/securityLog";

type Params = { params: Promise<{ code: string }> };

/**
 * ขั้นยืนยันตัวตน — สมาชิกใส่ **เลขที่สมาชิกคู่กับเบอร์มือถือ** (สเปก sync-agent ข้อ 6)
 *
 * ตรงทั้งคู่ = คืนชื่อปิดบัง · เลขสมาชิกปิดบัง · กลุ่มเรียกเก็บ ให้กดยืนยัน + บัตรผ่านไว้แนบตอนส่ง
 * ไม่ตรง = ตอบข้อความเดียวกันทุกกรณี **ห้ามบอกว่าผิดช่องไหน** ไม่งั้นใช้ไล่หาว่าเลขไหนมีจริงได้
 * ⚠️ ห้ามมีทางที่ใส่เลขสมาชิกอย่างเดียวแล้วเห็นชื่อ — คนนอกจะไล่ 00001–99999 ดูทั้งทะเบียน
 */
const MISMATCH = "เลขที่สมาชิกหรือเบอร์มือถือไม่ตรงกับทะเบียนสมาชิก กรุณาตรวจสอบอีกครั้ง";

export async function POST(request: Request, { params }: Params) {
  const { code } = await params;
  const survey = await publicSurvey(code);
  if (!survey) return NextResponse.json({ error: "ไม่พบแบบประเมินนี้" }, { status: 404 });
  if (survey.status !== "open") {
    return NextResponse.json({ error: NOT_OPEN[survey.status as "scheduled" | "closed"] }, { status: 409 });
  }
  if (!(await memberSourceReady())) {
    return NextResponse.json(
      // offline = ให้หน้าจอเปลี่ยนไปโหมด "ฝากคำตอบ ตรวจทีหลัง"
      { error: "ระบบยืนยันตัวตนยังไม่พร้อมใช้งาน", offline: true },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as { membNo?: unknown; phone?: unknown };
  const membNo = readMembNo(body.membNo);
  const phone = normalizePhone(body.phone);
  if (!membNo || !phone) {
    return NextResponse.json(
      { error: "กรุณาใส่เลขที่สมาชิก (ตัวเลข) และเบอร์มือถือ 10 หลัก ให้ครบทั้งสองช่อง" },
      { status: 400 },
    );
  }

  const ip = visitorIp(request);
  if (!allowLookup(ip, membNo.replace(/^0+/, ""))) {
    await logSecurity("survey_blocked", { username: membNo, ip, note: code });
    return NextResponse.json({ error: "ลองหลายครั้งเกินไป กรุณารอสัก 15 นาทีแล้วลองใหม่" }, { status: 429 });
  }

  const found = await checkMember(membNo, phoneHash(phone) ?? "");
  if (!found.ok) {
    if (found.reason === "unavailable") {
      return NextResponse.json({ error: "ระบบยืนยันตัวตนขัดข้องชั่วคราว", offline: true }, { status: 503 });
    }
    recordMiss(ip);
    return NextResponse.json({ error: MISMATCH }, { status: 404 });
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
