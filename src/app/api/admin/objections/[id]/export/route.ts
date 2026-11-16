import { NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { canArea, type Actor } from "@/lib/permissions";
import { db } from "@/lib/db";
import { agendaLabel, readAgendas, readItems, thaiDateTime } from "@/lib/objection";

type Params = { params: Promise<{ id: string }> };

/** ใส่เครื่องหมายคำพูดให้ CSV — ขึ้นต้นด้วย = + - @ ใส่ ' นำหน้า กัน Excel ตีเป็นสูตร */
function cell(value: unknown): string {
  let s = String(value ?? "");
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

/**
 * ดาวน์โหลดคำทักท้วงทั้งรอบเป็น CSV (Excel เปิดภาษาไทยได้ — ใส่ BOM)
 * หนึ่งแถว = หนึ่งวาระที่ทักท้วง ดึงได้ตลอด ไม่ต้องรอปิดรับ
 */
export async function GET(_request: Request, { params }: Params) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  if (!canArea(auth.user as Actor, "objections")) {
    return NextResponse.json({ error: "ส่วนนี้ไม่ได้อยู่ในความรับผิดชอบของคุณ" }, { status: 403 });
  }

  const { id } = await params;
  const round = await db.objectionRound.findUnique({ where: { id } });
  if (!round) return NextResponse.json({ error: "ไม่พบรอบนี้" }, { status: 404 });
  const agendas = readAgendas(round.agendas);
  const rows = await db.objection.findMany({ where: { roundId: id }, orderBy: { createdAt: "asc" } });

  const lines = [["ลำดับ", "วันเวลาที่ส่ง", "เลขที่สมาชิก", "ชื่อ-นามสกุล", "ระเบียบวาระ", "รายละเอียดที่ต้องการแก้ไข"].map(cell).join(",")];
  rows.forEach((r, i) => {
    for (const it of readItems(r.items)) {
      const agenda = agendas.find((a) => a.no === it.no) ?? { no: it.no, title: "" };
      lines.push([i + 1, thaiDateTime(r.createdAt), r.membNo, r.name, agendaLabel(agenda), it.detail].map(cell).join(","));
    }
  });

  return new NextResponse(`﻿${lines.join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="objections-${round.year}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
