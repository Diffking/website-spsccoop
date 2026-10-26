import { NextResponse } from "next/server";
import { requireWrite } from "@/lib/apiAuth";
import { db } from "@/lib/db";
import { shortHash } from "@/lib/surveyDraw";
import { thaiDateTime } from "@/lib/surveyTime";

type Params = { params: Promise<{ id: string }> };

const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

/**
 * รายชื่อผู้โชคดีเป็น CSV (Excel เปิดไทยได้) — ข้อมูลเต็มสำหรับติดต่อมอบรางวัล
 * รวมรายการที่สละสิทธิ์ด้วย (ระบุสถานะ) ไว้ตรวจย้อน · ใช้ requireWrite เพราะมีข้อมูลส่วนบุคคล
 */
export async function GET(_request: Request, { params }: Params) {
  const auth = await requireWrite("surveys");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const survey = await db.survey.findUnique({ where: { id }, select: { code: true, title: true } });
  if (!survey) return NextResponse.json({ error: "ไม่พบแบบประเมินนี้" }, { status: 404 });

  const draws = await db.surveyDraw.findMany({
    where: { surveyId: id },
    include: { prize: { select: { name: true, sortOrder: true } } },
    orderBy: [{ round: "asc" }, { drawnAt: "asc" }],
  });

  const lines = [
    cell(`ผลจับรางวัล · ${survey.title}`),
    ["รอบ", "รางวัล", "เลขที่สมาชิก", "ชื่อ-สกุล", "เบอร์โทร", "กลุ่มเรียกเก็บ", "เวลาที่จับ", "ผู้กดจับ", "เจ้าหน้าที่", "ผู้มีสิทธิ์ (คน)", "ลายนิ้วมือรายชื่อ", "สถานะ"]
      .map(cell)
      .join(","),
    ...draws.map((d) =>
      [
        d.round,
        d.prize.name,
        d.membNo,
        d.name,
        d.phone,
        d.department,
        thaiDateTime(d.drawnAt),
        d.pressedBy,
        d.drawnByName,
        d.poolSize,
        shortHash(d.poolHash),
        d.voided ? `สละสิทธิ์: ${d.voidReason ?? ""}` : "ได้รับรางวัล",
      ]
        .map(cell)
        .join(","),
    ),
  ];

  return new NextResponse("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="survey-${survey.code}-winners.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
