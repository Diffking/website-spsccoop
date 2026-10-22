import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireWrite } from "@/lib/apiAuth";
import { db } from "@/lib/db";
import { cloneItem, newSurveyCode, readItems, type SurveyItem } from "@/lib/survey";
import { buildTemplate } from "@/lib/surveyTemplates";

/**
 * สร้างแบบประเมินใหม่ — ได้เป็น "ร่าง" เสมอ ยังไม่มีใครเห็นจนกว่าจะกดเผยแพร่
 *
 *   { }                         แบบประเมินเปล่า
 *   { template: "satisfaction-2569" }   จากแม่แบบ
 *   { copyFrom: "<id>" }        ทำสำเนาจากแบบประเมินเดิม (เช่น ครั้งที่ 3 ต่อจากครั้งที่ 2)
 */
export async function POST(request: Request) {
  const auth = await requireWrite("surveys");
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json().catch(() => ({}))) as {
    template?: string;
    copyFrom?: string;
  };

  let title = "แบบประเมินใหม่";
  let description = "";
  let questions: SurveyItem[] = [];

  if (body.template) {
    const built = buildTemplate(body.template);
    if (!built) return NextResponse.json({ error: "ไม่พบแม่แบบนี้" }, { status: 400 });
    ({ title, description, questions } = built);
  } else if (body.copyFrom) {
    const source = await db.survey.findUnique({ where: { id: body.copyFrom } });
    if (!source) return NextResponse.json({ error: "ไม่พบแบบประเมินต้นฉบับ" }, { status: 404 });
    title = `${source.title} (สำเนา)`;
    description = source.description;
    // รหัสใหม่ทุกข้อ — ชุดใหม่ไม่มีคำตอบผูกอยู่ และกันสับสนเวลาเทียบผลข้ามชุดในอนาคต
    questions = readItems(source.questions).map(cloneItem);
  }

  // รหัสลิงก์ชนกันได้ (แม้โอกาสน้อยมาก) — ลองใหม่สองสามรอบ
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const survey = await db.survey.create({
        data: {
          code: newSurveyCode(),
          title,
          description,
          questions: questions as unknown as Prisma.InputJsonValue,
          createdById: auth.user.id,
        },
        select: { id: true },
      });
      return NextResponse.json({ id: survey.id }, { status: 201 });
    } catch (error) {
      const clash = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
      if (!clash) throw error;
    }
  }
  return NextResponse.json({ error: "สร้างรหัสลิงก์ไม่สำเร็จ ลองใหม่อีกครั้ง" }, { status: 500 });
}
