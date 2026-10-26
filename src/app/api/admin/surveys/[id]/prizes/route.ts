import { NextResponse } from "next/server";
import { requireWrite } from "@/lib/apiAuth";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

/**
 * บันทึกรายการของรางวัลทั้งชุด — { prizes: [{ id?, name, quantity, mode }] } เรียงตามลำดับที่จะจับ
 *
 * จับไปแล้วห้าม: ลบรางวัลนั้น · ลดจำนวนต่ำกว่าที่จับไปแล้ว (ผลจับต้องอ้างถึงรางวัลได้เสมอ)
 */
export async function PUT(request: Request, { params }: Params) {
  const auth = await requireWrite("surveys");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { prizes?: unknown };
  if (!Array.isArray(body.prizes)) return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });

  const input = body.prizes.slice(0, 100).map((raw, i) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    return {
      id: typeof o.id === "string" ? o.id : null,
      name: typeof o.name === "string" ? o.name.trim().slice(0, 200) : "",
      quantity: Math.round(Number(o.quantity)),
      mode: o.mode === "batch" ? "batch" : "one",
      sortOrder: i,
    };
  });
  for (const p of input) {
    if (!p.name) return NextResponse.json({ error: "ชื่อรางวัลห้ามว่าง" }, { status: 400 });
    if (!Number.isInteger(p.quantity) || p.quantity < 1 || p.quantity > 10000) {
      return NextResponse.json({ error: `จำนวน "${p.name}" ต้องเป็น 1 ขึ้นไป` }, { status: 400 });
    }
  }

  const existing = await db.surveyPrize.findMany({
    where: { surveyId: id },
    include: { draws: { where: { voided: false }, select: { id: true } }, _count: { select: { draws: true } } },
  });
  const keep = new Set(input.map((p) => p.id).filter(Boolean));
  for (const old of existing) {
    if (!keep.has(old.id) && old._count.draws > 0) {
      return NextResponse.json({ error: `"${old.name}" จับไปแล้ว ลบไม่ได้` }, { status: 409 });
    }
    const next = input.find((p) => p.id === old.id);
    if (next && next.quantity < old.draws.length) {
      return NextResponse.json(
        { error: `"${old.name}" จับไปแล้ว ${old.draws.length} รางวัล ลดจำนวนต่ำกว่านั้นไม่ได้` },
        { status: 409 },
      );
    }
  }

  await db.$transaction([
    db.surveyPrize.deleteMany({ where: { surveyId: id, id: { notIn: [...keep] as string[] } } }),
    ...input.map((p) =>
      p.id && existing.some((e) => e.id === p.id)
        ? db.surveyPrize.update({ where: { id: p.id }, data: { name: p.name, quantity: p.quantity, mode: p.mode, sortOrder: p.sortOrder } })
        : db.surveyPrize.create({ data: { surveyId: id, name: p.name, quantity: p.quantity, mode: p.mode, sortOrder: p.sortOrder } }),
    ),
  ]);
  return NextResponse.json({ ok: true });
}
