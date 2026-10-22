import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { readIdentifier } from "@/lib/memberLookup";
import { publicSurvey, NOT_OPEN } from "@/lib/surveyPublic";
import { surveyStatus } from "@/lib/survey";
import { checkAnswers } from "@/lib/surveyAnswers";
import { allowQueue, visitorIp } from "@/lib/surveyGuard";
import { fromHost, openSealed } from "@/lib/surveyQueue";
import { verifyResponses } from "@/lib/surveyVerify";

type Params = { params: Promise<{ code: string }> };

/**
 * รับคำตอบแบบ "ฝากไว้ ตรวจทีหลัง" — ใช้เมื่อยืนยันตัวตนสดไม่ได้
 *
 * มาได้สองทาง:
 *   1. เบราว์เซอร์ตรง ๆ — เครื่องนี้เปิดอยู่ แต่ฐานสมาชิกยังไม่พร้อม · body = { phone, name, answers }
 *   2. กล่องพักบนโฮสต์ — เครื่องนี้ปิดตอนสมาชิกส่ง โฮสต์เก็บไว้แล้วส่งตามมา
 *      หัว x-queue-token · x-queue-id · x-queued-at · body = { sealed } (ล็อกด้วยกุญแจของเรา)
 *
 * ทุกรายการเข้ามาเป็น "รอตรวจ" แล้วลองตรวจกับฐานทันที — ฐานไม่พร้อมก็ค้างรอตัวตรวจอัตโนมัติ
 *
 * รหัสตอบกลับมีความหมายกับโฮสต์: 2xx = ลบออกจากกล่อง · 4xx = รายการเสีย ไม่ต้องส่งซ้ำ
 * · 5xx = ลองใหม่รอบหน้า — **ห้ามตอบ 5xx กับของที่ส่งซ้ำแล้วก็ไม่มีวันผ่าน** ไม่งั้นโฮสต์ส่งวนไม่จบ
 */
export async function POST(request: Request, { params }: Params) {
  const { code } = await params;
  const host = await fromHost(request);

  if (!host && !allowQueue(visitorIp(request))) {
    return NextResponse.json({ error: "ส่งหลายครั้งเกินไป กรุณารอสัก 15 นาทีแล้วลองใหม่" }, { status: 429 });
  }

  const survey = await publicSurvey(code);
  if (!survey) return NextResponse.json({ error: "ไม่พบแบบประเมินนี้" }, { status: 404 });

  const raw = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  let body = raw;
  if (host && raw.sealed) {
    const plain = await openSealed(raw.sealed);
    try {
      body = JSON.parse(plain ?? "") as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "ไขรายการไม่ได้" }, { status: 422 });
    }
  }

  /*
   * เวลาที่ส่งจริง — เชื่อเวลาของโฮสต์เฉพาะรายการที่มีโทเคนถูกต้อง
   * (คนทั่วไปส่งหัวนี้มาเองได้ ถ้าเชื่อก็ส่งคำตอบย้อนหลังเข้าแบบประเมินที่ปิดไปแล้วได้)
   */
  const queuedAt = Number(request.headers.get("x-queued-at"));
  const submittedAt =
    host && Number.isFinite(queuedAt) && queuedAt > 0 && queuedAt * 1000 <= Date.now() + 60_000
      ? new Date(queuedAt * 1000)
      : new Date();

  const statusThen = surveyStatus(
    { published: true, opensAt: survey.opensAt, closesAt: survey.closesAt, closedAt: survey.closedAt },
    submittedAt.getTime(),
  );
  if (statusThen !== "open") {
    return NextResponse.json({ error: NOT_OPEN[statusThen as "scheduled" | "closed"] }, { status: 409 });
  }

  const phone = typeof body.phone === "string" ? body.phone : "";
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 200) : "";
  const id = readIdentifier(phone);
  if (!id || !name) {
    return NextResponse.json({ error: "กรุณากรอกเบอร์มือถือ (หรือเลขที่สมาชิก) และชื่อ-สกุล" }, { status: 400 });
  }

  const { answers, missing } = checkAnswers(survey.items, body.answers);
  if (missing.length) {
    return NextResponse.json({ error: `ยังตอบไม่ครบ ${missing.length} ข้อ`, missing }, { status: 400 });
  }

  const queueId = host ? (request.headers.get("x-queue-id") ?? "").slice(0, 64) || null : null;
  try {
    await db.surveyResponse.create({
      data: {
        surveyId: survey.id,
        answers: answers as Prisma.InputJsonValue,
        submittedAt,
        source: "queued",
        queueId,
        claimedPhone: id.value,
        claimedName: name,
        status: "pending",
      },
    });
  } catch (e) {
    // โฮสต์ส่งรายการเดิมซ้ำ (ครั้งก่อนบันทึกแล้วแต่คำตอบหายกลางทาง) — ถือว่าสำเร็จ ให้ลบออกจากกล่องได้
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    throw e;
  }

  // ลองตรวจทันที — ฐานไม่พร้อมก็แค่ค้างไว้ ไม่ทำให้การรับคำตอบล้ม
  await verifyResponses({ surveyId: survey.id }).catch((e) => console.error("ตรวจคำตอบไม่สำเร็จ:", e));

  return NextResponse.json({ ok: true, queued: true });
}
