import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireWrite } from "@/lib/apiAuth";
import { db } from "@/lib/db";
import {
  cleanItems,
  lockViolations,
  readItems,
  surveyStatus,
  validateItems,
} from "@/lib/survey";

type Params = { params: Promise<{ id: string }> };

/** วันเวลาจากหน้าจอ (ISO) — null/"" = ไม่กำหนด · undefined = ไม่ได้ส่งมา ไม่แตะค่าเดิม */
function readTime(value: unknown): Date | null | undefined | "bad" {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") return "bad";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "bad" : date;
}

/**
 * บันทึกแบบประเมิน หรือสั่งเปลี่ยนสถานะ
 *
 *   { title, description, opensAt, closesAt, questions }   บันทึกเนื้อหา (ส่งเฉพาะช่องที่เปลี่ยนก็ได้)
 *   { action: "publish" | "unpublish" }                    เผยแพร่ / กลับเป็นร่าง
 *   { action: "close" }                                    ปุ่ม "สิ้นสุดการประเมิน"
 *   { action: "reopen", closesAt }                         เปิดรับต่อ (ขยายเวลา)
 */
export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireWrite("surveys");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const existing = await db.survey.findUnique({
    where: { id },
    include: { _count: { select: { responses: true } } },
  });
  if (!existing) return NextResponse.json({ error: "ไม่พบแบบประเมินนี้" }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const answered = existing._count.responses > 0;

  /*
   * กันแท็บที่เปิดค้างไว้บันทึกทับของใหม่ — หน้าจอส่งเวลาที่ตัวเองโหลดมา ถ้าไม่ตรงกับในฐาน
   * แปลว่ามีคนบันทึกไปก่อนแล้ว (เคยเกิดกับหน้าเนื้อหา 25 ส.ค. 2026 ของหายไปสองรอบ)
   */
  if (typeof body.baseUpdatedAt === "string" && body.baseUpdatedAt !== existing.updatedAt.toISOString()) {
    return NextResponse.json(
      { error: "มีคนบันทึกแบบประเมินนี้ไปก่อนแล้ว — กด F5 เพื่อโหลดของล่าสุด แล้วแก้ใหม่", stale: true },
      { status: 409 },
    );
  }
  const data: Prisma.SurveyUpdateInput = {};

  /* ---------- เนื้อหา ---------- */
  if (body.title !== undefined) {
    const title = String(body.title ?? "").trim().slice(0, 300);
    if (!title) return NextResponse.json({ error: "ชื่อแบบประเมินห้ามว่าง" }, { status: 400 });
    data.title = title;
  }
  if (body.description !== undefined) {
    data.description = String(body.description ?? "").trim().slice(0, 4000);
  }

  const opensAt = readTime(body.opensAt);
  const closesAt = readTime(body.closesAt);
  if (opensAt === "bad" || closesAt === "bad") {
    return NextResponse.json({ error: "วันเวลาไม่ถูกต้อง" }, { status: 400 });
  }
  if (opensAt !== undefined) data.opensAt = opensAt;
  if (closesAt !== undefined) data.closesAt = closesAt;

  const nextOpens = opensAt !== undefined ? opensAt : existing.opensAt;
  const nextCloses = closesAt !== undefined ? closesAt : existing.closesAt;
  if (nextOpens && nextCloses && nextCloses <= nextOpens) {
    return NextResponse.json({ error: "วันสิ้นสุดต้องอยู่หลังวันเริ่ม" }, { status: 400 });
  }

  let questions = readItems(existing.questions);
  if (body.questions !== undefined) {
    const next = cleanItems(body.questions);
    // มีคนตอบแล้ว ห้ามลบ/เปลี่ยนชนิด — คำตอบเดิมจะชี้ไปของที่ไม่มีอยู่แล้ว
    if (answered) {
      const locked = lockViolations(questions, next);
      if (locked.length) return NextResponse.json({ error: locked[0], problems: locked }, { status: 409 });
    }
    questions = next;
    data.questions = next as unknown as Prisma.InputJsonValue;
  }

  /* ---------- สถานะ ---------- */
  const action = body.action;
  const publishedAfter = action === "publish" ? true : action === "unpublish" ? false : existing.published;

  if (action === "publish") data.published = true;
  if (action === "unpublish") {
    // มีคนตอบแล้วกลับเป็นร่างไม่ได้ — ลิงก์ที่แจกไปจะตายกลางทาง ใช้ "สิ้นสุดการประเมิน" แทน
    if (answered) {
      return NextResponse.json(
        { error: "มีคนตอบแล้ว กลับเป็นร่างไม่ได้ — ใช้ปุ่ม \"สิ้นสุดการประเมิน\" แทน" },
        { status: 409 },
      );
    }
    data.published = false;
  }
  if (action === "close") {
    if (!existing.published) return NextResponse.json({ error: "ยังเป็นร่างอยู่" }, { status: 409 });
    data.closedAt = new Date();
  }
  if (action === "reopen") {
    data.closedAt = null;
    // ถึงวันสิ้นสุดไปแล้ว เปิดต่อเฉย ๆ ก็ยังปิดอยู่ดี — ต้องได้วันสิ้นสุดใหม่ หรือเลิกกำหนด
    if (nextCloses && nextCloses.getTime() <= Date.now()) {
      return NextResponse.json(
        { error: "วันสิ้นสุดผ่านไปแล้ว — ตั้งวันสิ้นสุดใหม่ หรือเลือก \"ไม่กำหนด\" ก่อนเปิดรับต่อ" },
        { status: 400 },
      );
    }
  }

  // เผยแพร่อยู่ (หรือกำลังจะเผยแพร่) ต้องพร้อมใช้จริง — ร่างบันทึกครึ่ง ๆ กลาง ๆ ได้
  if (publishedAfter) {
    const problems = validateItems(questions);
    if (problems.length) {
      return NextResponse.json(
        { error: `ยังเผยแพร่ไม่ได้ — ${problems[0]}`, problems },
        { status: 400 },
      );
    }
  }

  const saved = await db.survey.update({ where: { id }, data });
  return NextResponse.json({
    ok: true,
    status: surveyStatus(saved),
    updatedAt: saved.updatedAt.toISOString(),
  });
}

/** ลบแบบประเมิน — ได้เฉพาะที่ยังไม่มีใครตอบ (คำตอบของสมาชิกห้ามหายเพราะกดผิด) */
export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireWrite("surveys");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const existing = await db.survey.findUnique({
    where: { id },
    include: { _count: { select: { responses: true } } },
  });
  if (!existing) return NextResponse.json({ error: "ไม่พบแบบประเมินนี้" }, { status: 404 });
  if (existing._count.responses > 0) {
    return NextResponse.json(
      { error: `มีผู้ตอบแล้ว ${existing._count.responses} คน ลบไม่ได้ — ใช้ "สิ้นสุดการประเมิน" แทน` },
      { status: 409 },
    );
  }

  await db.survey.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
