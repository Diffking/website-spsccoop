import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { requireUser } from "@/lib/apiAuth";
import { db } from "@/lib/db";
import { DEFAULT_FOLDER, isFolder, uploadToFtp } from "@/lib/ftp";
import { MAX_EDGE, shrink } from "@/lib/image";
import { compressPdf } from "@/lib/pdf";

/**
 * อัปโหลดรูปจากหลังบ้าน → public/uploads (mount เป็น volume ไว้แล้ว ไม่หายตอน build ใหม่)
 *
 * ชื่อไฟล์สุ่มใหม่เสมอ ไม่ใช้ชื่อเดิมของผู้ใช้ เพราะ (1) ชื่อไทยทำให้ header Link พัง
 * เหมือนที่เคยเจอ และ (2) กันชื่อซ้ำและกัน path traversal จากชื่อไฟล์ที่ส่งมา
 *
 * รูปถูกย่อให้ด้านยาวสุดไม่เกิน 600px ก่อนเก็บ (ดู src/lib/image.ts)
 * PDF ที่หนักเกินเกณฑ์ถูกบีบด้วย Ghostscript ก่อนเก็บ (ดู src/lib/pdf.ts)
 * ที่เก็บ = ไฟล์ที่ย่อ/บีบแล้ว ส่วนต้นฉบับไม่ได้เก็บไว้
 */

const MAX_BYTES = 8 * 1024 * 1024;
// รับ PDF ก้อนใหญ่ได้ แล้วค่อยบีบให้เล็กลงเอง — ไม่ปฏิเสธไฟล์ที่เจ้าหน้าที่อุตส่าห์สแกนมา
const MAX_PDF_BYTES = 60 * 1024 * 1024;
// ขนาดที่อยากได้หลังบีบ เกินจากนี้ก็ยังเก็บให้ แค่บีบเท่าที่บีบได้
const PDF_TARGET_BYTES = 6 * 1024 * 1024;
const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
};

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  // โฟลเดอร์ปลายทางฝั่ง FTP — ส่งค่าแปลกมาก็ตกไปที่โฟลเดอร์เริ่มต้น
  const folderInput = form?.get("folder");
  const folder = isFolder(folderInput) ? folderInput : DEFAULT_FOLDER;

  if (!(file instanceof File)) {
    // อ่าน body ไม่ได้มักแปลว่าไฟล์ใหญ่เกินเพดานที่ตั้งไว้ ไม่ใช่ว่าไม่ได้เลือกไฟล์
    // (ดู middlewareClientMaxBodySize ใน next.config.ts) บอกให้ตรงเหตุจะได้ไม่งงว่าเลือกแล้วทำไมไม่เจอ
    return NextResponse.json(
      { error: "อ่านไฟล์ไม่ได้ — ไฟล์อาจใหญ่เกินไป (PDF ไม่เกิน 60 MB · รูปไม่เกิน 8 MB)" },
      { status: 400 },
    );
  }

  const extension = EXTENSIONS[file.type];
  if (!extension) {
    return NextResponse.json(
      { error: "รองรับเฉพาะไฟล์ภาพ JPG, PNG, WEBP, GIF หรือไฟล์ PDF" },
      { status: 400 },
    );
  }

  const isPdf = file.type === "application/pdf";
  /*
   * ขนาดที่ย่อ — ฝั่งหน้าเว็บส่งมาได้ว่าจะเอาเท่าไหร่ (รูปทั่วไป 600 · รูปบุคคล 1 นิ้ว 400)
   * ไม่ส่งมาก็ใช้ค่าตามโฟลเดอร์เหมือนเดิม
   */
  const asked = Math.trunc(Number(form?.get("maxEdge") ?? 0));
  const maxEdge =
    Number.isFinite(asked) && asked >= 200 && asked <= 2000
      ? asked
      : folder === "page_images"
        ? 1200
        : MAX_EDGE;
  const limit = isPdf ? MAX_PDF_BYTES : MAX_BYTES;
  if (file.size > limit) {
    return NextResponse.json(
      { error: `ไฟล์ใหญ่เกิน ${Math.round(limit / 1024 / 1024)} MB` },
      { status: 400 },
    );
  }

  const name = `${randomUUID()}.${extension}`;
  const original = Buffer.from(await file.arrayBuffer());

  let bytes = original;
  let size = { width: 0, height: 0 };
  let note = "";

  if (isPdf) {
    try {
      const squeezed = await compressPdf(original, PDF_TARGET_BYTES);
      bytes = squeezed.bytes;
      if (squeezed.compressed) note = `บีบไฟล์ที่ ${squeezed.level}`;
    } catch (error) {
      // บีบไม่สำเร็จก็เก็บต้นฉบับ ดีกว่าอัปไม่ขึ้นเลย
      console.error("บีบ PDF ไม่สำเร็จ เก็บต้นฉบับแทน:", error);
    }
  } else {
    try {
      const shrunk = await shrink(original, file.type, maxEdge);
      bytes = shrunk.bytes;
      size = { width: shrunk.width, height: shrunk.height };
    } catch (error) {
      // ย่อไม่ได้ (ไฟล์เพี้ยน/รูปแบบแปลก) ก็เก็บต้นฉบับไปก่อน ดีกว่าอัปไม่ขึ้นเลย
      console.error("ย่อรูปไม่สำเร็จ เก็บต้นฉบับแทน:", error);
    }
  }

  // เก็บไว้ในเครื่องเสมอ — กันไว้เผื่อโฮสต์ FTP เปลี่ยน/หมดอายุ ภาพยังอยู่ครบในมือเรา
  const directory = path.join(process.cwd(), "public", "uploads");
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, name), bytes);

  // ตั้งค่า FTP ครบ = ใช้ URL จากโดเมนนั้น ถ้าส่งไม่สำเร็จก็ถอยมาใช้ไฟล์ในเครื่อง
  const remote = await uploadToFtp(bytes, name, folder);
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
      maxEdge,
      originalBytes: original.byteLength,
      storedBytes: bytes.byteLength,
      note,
    },
    { status: 201 },
  );
}
