import { NextResponse } from "next/server";
import { requireWrite } from "@/lib/apiAuth";
import { db } from "@/lib/db";
import { drawState, pickIndexes, shortHash, withDrawLock } from "@/lib/surveyDraw";
import { requireUser } from "@/lib/apiAuth";
import { canArea } from "@/lib/permissions";

type Params = { params: Promise<{ id: string }> };

/**
 * สถานะล่าสุดให้จอจับรางวัล หลังจับแต่ละครั้ง — คงเหลือแต่ละรางวัล · ลายนิ้วมือชุดใหม่
 * แยกจากการโหลดหน้าใหม่ เพราะหน้าจอตรวจซ้ำกับทะเบียนทั้งชุดตอนเปิด (ทำทุกครั้งที่กดไม่ไหว)
 */
export async function GET(_request: Request, { params }: Params) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  if (!canArea(auth.user, "surveys")) return NextResponse.json({ error: "ส่วนนี้ไม่ได้อยู่ในความรับผิดชอบของคุณ" }, { status: 403 });
  const { id } = await params;
  const state = await drawState(id);
  if (!state) return NextResponse.json({ error: "ไม่พบแบบประเมินนี้" }, { status: 404 });
  return NextResponse.json({
    prizes: state.prizes.map((p) => ({ id: p.id, name: p.name, mode: p.mode, quantity: p.quantity, remaining: p.remaining })),
    poolHash: state.poolHash,
    fingerprint: shortHash(state.poolHash),
    poolSize: state.pool.length,
    blockers: state.blockers,
  });
}

/**
 * กดจับรางวัล — { prizeId, count?, poolHash, pressedBy? }
 *
 * ผลตัดสินที่นี่ทันทีที่กด (สุ่มบนเซิร์ฟเวอร์) แล้วบันทึกลงฐานก่อนตอบกลับ
 * หน้าจอได้ผลไปทำท่าลุ้นเฉย ๆ — รีเฟรช/กดซ้ำไม่ได้สุ่มใหม่ ผลที่บันทึกแล้วคือผลจริง
 *
 * poolHash ต้องตรงกับที่จอโชว์ไว้ — ไม่ตรง = รายชื่อเปลี่ยนระหว่างนั้น (มีคนตรวจ/ตัดรายการ)
 * ปฏิเสธแล้วให้จอโหลดลายนิ้วมือใหม่ กรรมการจะได้เห็นว่าจับจากรายชื่อชุดไหน
 */
export async function POST(request: Request, { params }: Params) {
  const auth = await requireWrite("surveys");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    prizeId?: unknown;
    count?: unknown;
    poolHash?: unknown;
    pressedBy?: unknown;
  };

  const result = await withDrawLock(id, async () => {
    const state = await drawState(id);
    if (!state) return NextResponse.json({ error: "ไม่พบแบบประเมินนี้" }, { status: 404 });
    if (state.blockers.length) {
      return NextResponse.json({ error: `ยังจับรางวัลไม่ได้ — ${state.blockers[0]}`, blockers: state.blockers }, { status: 409 });
    }
    if (body.poolHash !== state.poolHash) {
      return NextResponse.json(
        { error: "รายชื่อผู้มีสิทธิ์เปลี่ยนไปแล้ว — โหลดหน้าใหม่เพื่อดูลายนิ้วมือรายชื่อชุดล่าสุดก่อนจับ", stale: true },
        { status: 409 },
      );
    }
    const prize = state.prizes.find((p) => p.id === body.prizeId);
    if (!prize) return NextResponse.json({ error: "ไม่พบรางวัลนี้" }, { status: 404 });
    if (prize.remaining === 0) return NextResponse.json({ error: `"${prize.name}" จับครบแล้ว` }, { status: 409 });
    if (state.pool.length === 0) return NextResponse.json({ error: "ไม่มีผู้มีสิทธิ์เหลือแล้ว" }, { status: 409 });

    // ทีละคน = 1 · ทั้งชุด = ที่เหลือทั้งหมด (หรือเท่าที่ขอ) · ไม่เกินจำนวนคนที่เหลือ
    const want = prize.mode === "batch" ? Math.max(1, Math.round(Number(body.count) || prize.remaining)) : 1;
    const picks = pickIndexes(state.pool.length, Math.min(want, prize.remaining)).map((i) => state.pool[i]);
    const pressedBy = typeof body.pressedBy === "string" ? body.pressedBy.trim().slice(0, 120) || null : null;
    const now = new Date();

    const created = await db.$transaction(
      picks.map((p) =>
        db.surveyDraw.create({
          data: {
            surveyId: id,
            prizeId: prize.id,
            round: state.round,
            responseId: p.responseId,
            membNo: p.membNo,
            name: p.name,
            phone: p.phone,
            department: p.department,
            poolSize: state.pool.length,
            poolHash: state.poolHash,
            drawnAt: now,
            drawnById: auth.user.id,
            drawnByName: auth.user.name,
            pressedBy,
          },
        }),
      ),
    );

    return NextResponse.json({
      winners: created.map((d) => ({ id: d.id, membNo: d.membNo, name: d.name, phone: d.phone, department: d.department })),
      poolSize: state.pool.length,
    });
  });

  if (result === "busy") return NextResponse.json({ error: "กำลังจับอยู่ — รอสักครู่" }, { status: 409 });
  return result;
}
