import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireWrite } from "@/lib/apiAuth";
import { db } from "@/lib/db";
import { AI_READY, summarizeFeedback } from "@/lib/ai";
import { loadReportData } from "@/lib/surveyReportData";
import { buildReport } from "@/lib/surveyReport";

type Params = { params: Promise<{ id: string }> };

/** ล้างรายการกลุ่มที่เจ้าหน้าที่แก้มา — ข้อความสั้น จำนวนเป็นจำนวนเต็มบวก ไม่เกิน 30 กลุ่ม */
function cleanGroups(input: unknown): { topic: string; count: number }[] {
  if (!Array.isArray(input)) return [];
  return input
    .slice(0, 30)
    .map((g) => {
      const o = (g ?? {}) as Record<string, unknown>;
      return {
        topic: typeof o.topic === "string" ? o.topic.trim().slice(0, 200) : "",
        count: Math.max(0, Math.round(Number(o.count) || 0)),
      };
    })
    .filter((g) => g.topic && g.count > 0)
    .sort((a, b) => b.count - a.count);
}

/**
 * POST = ให้ AI จัดกลุ่มข้อเสนอแนะจากคำตอบที่ตรวจแล้ว (ข้อพิมพ์เอง ที่ไม่ได้ติ๊ก "ไม่นำไปสรุปผล")
 * PUT  = บันทึกกลุ่มที่เจ้าหน้าที่แก้แล้ว — สิ่งที่กรรมการเห็นในลิงก์คือฉบับนี้
 */
export async function POST(_request: Request, { params }: Params) {
  const auth = await requireWrite("surveys");
  if (auth instanceof NextResponse) return auth;
  if (!AI_READY) return NextResponse.json({ error: "ยังไม่ได้ตั้งค่า AI" }, { status: 503 });

  const { id } = await params;
  // ใช้ข้อมูลทั้งหมดที่ตรวจแล้ว ไม่ตัดเที่ยง — สรุปข้อเสนอแนะทำตอนจะส่งกรรมการ อยากได้ล่าสุด
  const data = await loadReportData(id, { live: true });
  if (!data) return NextResponse.json({ error: "ไม่พบแบบประเมินนี้" }, { status: 404 });

  const texts = buildReport(data.items, data.responses)
    .items.filter((i) => i.kind === "text")
    .flatMap((i) => (i.kind === "text" ? i.texts : []));
  if (texts.length === 0) return NextResponse.json({ error: "ยังไม่มีข้อเสนอแนะให้สรุป" }, { status: 400 });

  try {
    const result = await summarizeFeedback(texts);
    const groups = cleanGroups(result.groups);
    await db.survey.update({
      where: { id },
      data: { feedbackSummary: groups as Prisma.InputJsonValue, feedbackSummaryAt: new Date() },
    });
    return NextResponse.json({ groups, from: texts.length });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "AI สรุปไม่สำเร็จ" }, { status: 502 });
  }
}

export async function PUT(request: Request, { params }: Params) {
  const auth = await requireWrite("surveys");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { groups?: unknown };
  const groups = cleanGroups(body.groups);
  await db.survey.update({
    where: { id },
    data: { feedbackSummary: groups as Prisma.InputJsonValue, feedbackSummaryAt: new Date() },
  });
  return NextResponse.json({ groups });
}
