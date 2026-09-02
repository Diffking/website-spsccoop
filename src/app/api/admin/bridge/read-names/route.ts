import path from "node:path";
import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { requireWrite } from "@/lib/apiAuth";
import { db } from "@/lib/db";
import { AI_READY, readPersonFromImage, type MediaType } from "@/lib/ai";

/**
 * ให้ AI อ่านชื่อ-ตำแหน่งจากรูปบุคลากรทีละกลุ่ม แล้วส่งกลับไปเติมในช่องให้เจ้าหน้าที่ตรวจ
 *
 * ⚠️ **ไม่บันทึกลงฐานเอง** — คืนค่าไปให้หน้าจอเติมในช่อง คนกดบันทึกอีกทีเสมอ
 * (หลักเดียวกับ AI อ่านภาพสไลด์) ชื่อคนสะกดผิดแล้วส่งต่อไปเข้าทะเบียนบุคลากร
 * ของอีกระบบ เป็นความผิดพลาดที่ตามแก้ยากกว่าคำโปรยบนแบนเนอร์มาก
 *
 * ⚠️ อ่านไฟล์จากดิสก์ตรง ๆ ห้ามวนกลับไปขอตัวเองผ่าน HTTP — คอนเทนเนอร์ต่อ
 * `localhost:8030` ไม่ได้ (บทเรียน 21 ส.ค. 2026 ที่ทำให้ AI ไม่เคยได้อ่านภาพเลย)
 */

/** กันยิงรัวทีเดียวเป็นร้อยรูป — ทำเนียบที่ใหญ่สุดตอนนี้ 17 คน */
const MAX_PER_CALL = 25;

/** ยิงพร้อมกันทีละกี่รูป — มากกว่านี้เสี่ยงโดน 429 จาก OpenRouter */
const BATCH = 4;

const EXT_TYPE: Record<string, MediaType> = {
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
};

export async function POST(request: Request) {
  const auth = await requireWrite("bridge");
  if (auth instanceof NextResponse) return auth;

  if (!AI_READY) {
    return NextResponse.json({ error: "ยังไม่ได้ตั้งค่าคีย์ AI" }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as { photos?: unknown } | null;
  const photos = Array.isArray(body?.photos)
    ? body.photos.filter((p): p is string => typeof p === "string" && p.startsWith("/uploads/"))
    : [];

  if (photos.length === 0) {
    return NextResponse.json({ error: "ไม่ได้บอกว่าจะให้อ่านรูปไหน" }, { status: 400 });
  }
  if (photos.length > MAX_PER_CALL) {
    return NextResponse.json(
      { error: `อ่านได้ครั้งละไม่เกิน ${MAX_PER_CALL} รูป` },
      { status: 400 },
    );
  }

  /*
    เช็คกับตาราง Media ก่อนว่าเป็นไฟล์ของเว็บนี้จริง แล้วค่อยอ่านจากดิสก์
    (path.basename อีกชั้นกันชื่อไฟล์ไต่ออกนอกโฟลเดอร์ ถึงจะกรองด้วยฐานแล้วก็ตาม)
  */
  const known = new Set(
    (await db.media.findMany({ where: { url: { in: photos } }, select: { url: true } })).map(
      (m) => m.url,
    ),
  );

  type Result = { photo: string; name: string; role: string; readable: boolean; error?: string };
  const results: Result[] = [];

  for (let i = 0; i < photos.length; i += BATCH) {
    const slice = photos.slice(i, i + BATCH);
    const part = await Promise.all(
      slice.map(async (photo): Promise<Result> => {
        const blank = { photo, name: "", role: "", readable: false };
        if (!known.has(photo)) return { ...blank, error: "ไม่รู้จักไฟล์นี้" };

        const name = path.basename(photo);
        const type = EXT_TYPE[path.extname(name).toLowerCase()];
        if (!type) return { ...blank, error: "ไฟล์ชนิดนี้ให้ AI อ่านไม่ได้" };

        const bytes = await readFile(
          path.join(process.cwd(), "public", "uploads", name),
        ).catch(() => null);
        if (!bytes) return { ...blank, error: "เปิดไฟล์รูปไม่ได้" };

        try {
          const draft = await readPersonFromImage(bytes.toString("base64"), type);
          return { photo, name: draft.name, role: draft.role, readable: draft.readable };
        } catch (error) {
          // พังทีละรูป ไม่ล้มทั้งกลุ่ม — รูปที่อ่านได้ต้องได้ใช้
          return { ...blank, error: error instanceof Error ? error.message : "อ่านไม่สำเร็จ" };
        }
      }),
    );
    results.push(...part);
  }

  return NextResponse.json({
    results,
    read: results.filter((r) => r.readable && r.name).length,
    failed: results.filter((r) => r.error).length,
  });
}
