import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { requireWrite } from "@/lib/apiAuth";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

/**
 * ลิงก์ให้กรรมการดูผลสรุป /r/<token>/ (ผ่าน Cloudflare Worker โดเมนเดียวกับลิงก์แบบประเมิน)
 *
 *   POST   { expiresAt? }  สร้างลิงก์ใหม่ (ลิงก์เดิมตายทันที) · ตั้ง/เปลี่ยนวันหมดอายุ
 *   DELETE                 ยกเลิกลิงก์
 *
 * ⚠️ หน้านั้นถูกเก็บสำเนาบนโฮสต์ (ttl 120 วินาที) — ยกเลิกแล้วสำเนาเดิมยังเปิดได้อีกไม่เกิน 2 นาที
 *    ถ้าเครื่องสำนักงานปิดอยู่ตอนนั้น สำเนาเก่าเปิดได้จนกว่าเครื่องจะเปิด (หน้าจอบอกเจ้าหน้าที่ไว้แล้ว)
 */
export async function POST(request: Request, { params }: Params) {
  const auth = await requireWrite("surveys");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { expiresAt?: unknown; keep?: boolean };
  let expiresAt: Date | null = null;
  if (typeof body.expiresAt === "string" && body.expiresAt) {
    expiresAt = new Date(body.expiresAt);
    if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
      return NextResponse.json({ error: "วันหมดอายุต้องเป็นวันในอนาคต" }, { status: 400 });
    }
  }

  const existing = await db.survey.findUnique({ where: { id }, select: { shareToken: true } });
  if (!existing) return NextResponse.json({ error: "ไม่พบแบบประเมินนี้" }, { status: 404 });

  // keep = แค่เปลี่ยนวันหมดอายุ ไม่ออกลิงก์ใหม่ (ลิงก์ที่ส่งกรรมการไปแล้วยังใช้ได้)
  const token = body.keep && existing.shareToken ? existing.shareToken : randomBytes(18).toString("base64url");
  await db.survey.update({ where: { id }, data: { shareToken: token, shareExpiresAt: expiresAt } });
  return NextResponse.json({ token, expiresAt: expiresAt?.toISOString() ?? null });
}

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireWrite("surveys");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  await db.survey.update({ where: { id }, data: { shareToken: null, shareExpiresAt: null } });
  return NextResponse.json({ ok: true });
}
