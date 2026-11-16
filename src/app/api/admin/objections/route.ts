import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireWrite } from "@/lib/apiAuth";
import { db } from "@/lib/db";
import { dayEnd, dayStart, defaultTitle, readAgendas } from "@/lib/objection";

/** เพิ่มรอบรับคำทักท้วงของปีใหม่ — body = { year, opensAt: "YYYY-MM-DD", closesAt: "YYYY-MM-DD" } */
export async function POST(request: Request) {
  const auth = await requireWrite("objections");
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const year = Math.trunc(Number(body.year));
  if (!Number.isInteger(year) || year < 2560 || year > 2700) {
    return NextResponse.json({ error: "ปี พ.ศ. ไม่ถูกต้อง" }, { status: 400 });
  }
  const opensAt = dayStart(String(body.opensAt ?? ""));
  const closesAt = dayEnd(String(body.closesAt ?? ""));
  if (!opensAt || !closesAt) {
    return NextResponse.json({ error: "เลือกวันเริ่มรับและวันปิดรับก่อน" }, { status: 400 });
  }
  if (closesAt <= opensAt) {
    return NextResponse.json({ error: "วันปิดรับต้องอยู่หลังวันเริ่มรับ" }, { status: 400 });
  }

  try {
    const round = await db.objectionRound.create({
      data: {
        year,
        title: defaultTitle(year),
        opensAt,
        closesAt,
        agendas: readAgendas([]) as Prisma.InputJsonValue,
      },
    });
    return NextResponse.json({ id: round.id }, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: `มีรอบของปี ${year} อยู่แล้ว` }, { status: 409 });
    }
    throw e;
  }
}
