import { NextResponse } from "next/server";
import { requireWrite } from "@/lib/apiAuth";
import { saveSetting } from "@/lib/settings";
import {
  CHECKUP_IMAGES_KEY,
  CHECKUP_INTRO_KEY,
  CHECKUP_LOGO_KEY,
  CHECKUP_QUESTIONS_KEY,
  INTEREST_RATES_HIDDEN_KEY,
  fillIntro,
} from "@/lib/programPages";
import { readHiddenRates } from "@/lib/interestCalc";
import { fillQuestions } from "@/lib/financialCheckup";
import { purgeEverySite } from "@/lib/mirrorPurge";
import { getSetting } from "@/lib/settings";

/** คำถามชุดที่ใช้อยู่ตอนนี้ — ใช้กรองว่ารหัสภาพที่ส่งมาตรงกับข้อที่มีจริง */
const currentQuestions = () => getSetting<unknown>(CHECKUP_QUESTIONS_KEY, null);

/**
 * ตั้งค่าของ "หน้าโปรแกรม" — ตอนนี้มีอย่างเดียวคือภาพประกอบคำถามของโปรแกรมตรวจสุขภาพการเงิน
 *
 * เก็บเป็น { รหัสคำถาม: ที่อยู่รูป } ใน Setting["checkupImages"]
 * ⚠️ **รับเฉพาะรหัสคำถามที่มีอยู่จริง** ไม่งั้นยิงค่ามั่ว ๆ เข้ามาก็สะสมขยะในฐานได้ไม่จำกัด
 * ⚠️ **รับเฉพาะที่อยู่รูปในเว็บนี้** (`/uploads/…`) กันคนฝังที่อยู่รูปจากเว็บอื่นมาโผล่ในหน้าเรา
 */
export async function PUT(request: Request) {
  const auth = await requireWrite("programs");
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json().catch(() => ({}))) as {
    checkupImages?: Record<string, unknown>;
    checkupQuestions?: unknown;
    checkupLogo?: unknown;
    checkupIntro?: unknown;
    interestRatesHidden?: unknown;
  };

  /*
    อัตราดอกเบี้ยเงินกู้ที่ "ไม่ต้องขึ้น" เป็นปุ่มลัดในโปรแกรมคำนวณดอกเบี้ย
    ⚠️ ผ่าน readHiddenRates ก่อนเสมอ — มันตัดค่าว่าง ตัดตัวซ้ำ และรับเฉพาะรายการข้อความ
    ส่งลิสต์ว่างมา = ให้ขึ้นทุกประเภท (ไม่ได้แปลว่า "ไม่เปลี่ยนอะไร")
  */
  if (body.interestRatesHidden !== undefined) {
    await saveSetting(INTEREST_RATES_HIDDEN_KEY, readHiddenRates(body.interestRatesHidden));
  }

  // ข้อความหน้าแรก — ผ่าน fillIntro ก่อนเสมอ ช่องไหนว่างจะถอยกลับไปใช้ของตั้งต้นให้เอง
  if (body.checkupIntro !== undefined) {
    await saveSetting(CHECKUP_INTRO_KEY, fillIntro(body.checkupIntro));
  }

  /*
    โลโก้ — รับเฉพาะที่อยู่รูปในเว็บนี้ (`/uploads/…`) กันคนฝังที่อยู่รูปจากเว็บอื่นมาโผล่ในหน้าเรา
    ส่งค่าว่างมา = เอาโลโก้ออก กลับไปใช้ไอคอนเดิม
  */
  if (body.checkupLogo !== undefined) {
    const logo = String(body.checkupLogo ?? "").trim();
    await saveSetting(CHECKUP_LOGO_KEY, logo.startsWith("/uploads/") ? logo : "");
  }

  /*
    คำถามกับภาพส่งมาด้วยกันก็ได้ ส่งมาอย่างเดียวก็ได้
    ⚠️ ผ่าน fillQuestions ก่อนเสมอ — มันทิ้งข้อที่ไม่มีรหัส/คำถาม และกันรหัสซ้ำ
    ซึ่งจะทำให้คำตอบของสองข้อทับกันเองตอนคิดเงิน
  */
  if (body.checkupQuestions !== undefined) {
    const questions = fillQuestions(body.checkupQuestions);
    await saveSetting(CHECKUP_QUESTIONS_KEY, questions);
  }

  if (body.checkupImages === undefined) {
    purgeEverySite();
    return NextResponse.json({ ok: true });
  }
  if (!body.checkupImages || typeof body.checkupImages !== "object") {
    return NextResponse.json({ error: "ไม่ได้ส่งข้อมูลมา" }, { status: 400 });
  }

  const current = fillQuestions(
    body.checkupQuestions !== undefined ? body.checkupQuestions : await currentQuestions(),
  );
  const known = new Set(current.map((q) => q.id));
  const clean: Record<string, string> = {};
  for (const [id, url] of Object.entries(body.checkupImages)) {
    if (!known.has(id)) continue;
    const value = String(url ?? "").trim();
    // ค่าว่าง = เอาภาพออก จึงไม่เก็บลงไป
    if (value.startsWith("/uploads/")) clean[id] = value;
  }

  await saveSetting(CHECKUP_IMAGES_KEY, clean);
  // สมาชิกจะได้เห็นภาพใหม่ทันที ไม่ต้องรอสำเนาบนโฮสต์หมดอายุ
  purgeEverySite();
  return NextResponse.json({ ok: true, count: Object.keys(clean).length });
}
