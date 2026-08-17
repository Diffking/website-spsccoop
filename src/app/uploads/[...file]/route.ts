import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import type { ReadableStream } from "node:stream/web";
import { Readable } from "node:stream";

/**
 * ส่งไฟล์ใน uploads/ ที่ Next ยังไม่รู้จัก
 *
 * Next อ่านรายชื่อไฟล์ในโฟลเดอร์ public/ ตอนสตาร์ตครั้งเดียว ไฟล์ที่อัปเข้ามาหลังจากนั้น
 * จึงเปิดผ่าน URL ไม่ได้จนกว่าจะ deploy ใหม่ — ทางนี้อ่านจากดิสก์สด ๆ ทุกครั้ง
 *
 * ไฟล์ที่มีอยู่ตั้งแต่ตอนสตาร์ตยังถูกเสิร์ฟแบบ static เหมือนเดิม (Next เลือกไฟล์จริงก่อน route)
 * ทางนี้จึงทำงานเฉพาะไฟล์ใหม่เท่านั้น
 */

export const dynamic = "force-dynamic";

const ROOT = path.join(process.cwd(), "public", "uploads");

const TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".pdf": "application/pdf",
};

export async function GET(_request: Request, { params }: { params: Promise<{ file: string[] }> }) {
  const { file } = await params;
  const name = file.join("/");

  // กัน ../ ไต่ออกนอกโฟลเดอร์ — ชื่อไฟล์จริงเป็น uuid อยู่แล้ว ไม่มีทางมีเครื่องหมายพวกนี้
  const target = path.join(ROOT, name);
  if (!target.startsWith(ROOT) || !existsSync(target) || !statSync(target).isFile()) {
    return NextResponse.json({ error: "ไม่พบไฟล์" }, { status: 404 });
  }

  const type = TYPES[path.extname(target).toLowerCase()] ?? "application/octet-stream";
  const stream = Readable.toWeb(createReadStream(target)) as ReadableStream<Uint8Array>;

  return new NextResponse(stream as unknown as BodyInit, {
    headers: {
      "Content-Type": type,
      "Content-Length": String(statSync(target).size),
      "Cache-Control": "public, max-age=3600",
    },
  });
}
