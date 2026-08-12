import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { requireUser } from "@/lib/apiAuth";
import { db } from "@/lib/db";
import { uploadToFtp } from "@/lib/ftp";
import { MAX_EDGE, shrink } from "@/lib/image";

/**
 * อัปโหลดรูปจากหลังบ้าน → public/uploads (mount เป็น volume ไว้แล้ว ไม่หายตอน build ใหม่)
 *
 * ชื่อไฟล์สุ่มใหม่เสมอ ไม่ใช้ชื่อเดิมของผู้ใช้ เพราะ (1) ชื่อไทยทำให้ header Link พัง
 * เหมือนที่เคยเจอ และ (2) กันชื่อซ้ำและกัน path traversal จากชื่อไฟล์ที่ส่งมา
 *
 * รูปถูกย่อให้ด้านยาวสุดไม่เกิน 600px ก่อนเก็บ (ดู src/lib/image.ts)
 * ที่เก็บ = ไฟล์ที่ย่อแล้ว ส่วนต้นฉบับไม่ได้เก็บไว้
 */

const MAX_BYTES = 8 * 1024 * 1024;
const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "ไม่พบไฟล์" }, { status: 400 });
  }

  const extension = EXTENSIONS[file.type];
  if (!extension) {
    return NextResponse.json(
      { error: "รองรับเฉพาะไฟล์ภาพ JPG, PNG, WEBP หรือ GIF" },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "ไฟล์ใหญ่เกิน 8 MB" }, { status: 400 });
  }

  const name = `${randomUUID()}.${extension}`;
  const original = Buffer.from(await file.arrayBuffer());

  let bytes = original;
  let size = { width: 0, height: 0 };
  try {
    const shrunk = await shrink(original, file.type);
    bytes = shrunk.bytes;
    size = { width: shrunk.width, height: shrunk.height };
  } catch (error) {
    // ย่อไม่ได้ (ไฟล์เพี้ยน/รูปแบบแปลก) ก็เก็บต้นฉบับไปก่อน ดีกว่าอัปไม่ขึ้นเลย
    console.error("ย่อรูปไม่สำเร็จ เก็บต้นฉบับแทน:", error);
  }

  // เก็บไว้ในเครื่องเสมอ — กันไว้เผื่อโฮสต์ FTP เปลี่ยน/หมดอายุ ภาพยังอยู่ครบในมือเรา
  const directory = path.join(process.cwd(), "public", "uploads");
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, name), bytes);

  // ตั้งค่า FTP ครบ = ใช้ URL จากโดเมนนั้น ถ้าส่งไม่สำเร็จก็ถอยมาใช้ไฟล์ในเครื่อง
  const remote = await uploadToFtp(bytes, name);
  const url = remote ?? `/uploads/${name}`;
  await db.media.create({
    data: {
      url,
      originalName: file.name,
      mimeType: file.type,
      // ขนาดของไฟล์ที่เก็บจริง ไม่ใช่ต้นฉบับ
      sizeBytes: bytes.byteLength,
      uploadedById: auth.user.id,
    },
  });

  return NextResponse.json(
    {
      url,
      storedOn: remote ? "ftp" : "local",
      width: size.width,
      height: size.height,
      maxEdge: MAX_EDGE,
      originalBytes: original.byteLength,
      storedBytes: bytes.byteLength,
    },
    { status: 201 },
  );
}
