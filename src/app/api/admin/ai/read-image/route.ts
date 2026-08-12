import { NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import {
  AI_READY,
  readAnnouncementFromFile,
  readRatesFromImage,
  readSlideFromImage,
} from "@/lib/ai";

/**
 * ให้ AI อ่านภาพที่หลังบ้านอัปมา แล้วคืนค่าที่อ่านได้ไปเติมในฟอร์ม
 * ไม่บันทึกลงฐานเอง — เจ้าหน้าที่ตรวจแล้วกดบันทึกอีกที
 */

const MAX_BYTES = 8 * 1024 * 1024;
// PDF ประกาศสแกนหลายหน้ามักใหญ่กว่ารูป
const MAX_PDF_BYTES = 25 * 1024 * 1024;
const MEDIA_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
] as const;
type MediaType = (typeof MEDIA_TYPES)[number];
const TARGETS = ["slide", "rates", "announcement"] as const;
type Target = (typeof TARGETS)[number];

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  if (!AI_READY) {
    return NextResponse.json(
      { error: "ยังไม่ได้ตั้งค่าคีย์ AI — ใส่ OPENROUTER_API_KEY ใน .env แล้วรีสตาร์ตระบบ" },
      { status: 503 },
    );
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const target = String(form?.get("target") ?? "");

  if (!(file instanceof File)) {
    // เหมือนกับ /api/admin/upload — อ่าน body ไม่ได้มักแปลว่าไฟล์ใหญ่เกิน ไม่ใช่ไม่ได้เลือกไฟล์
    return NextResponse.json(
      { error: "อ่านไฟล์ไม่ได้ — ไฟล์อาจใหญ่เกินไป (PDF ไม่เกิน 25 MB · รูปไม่เกิน 8 MB)" },
      { status: 400 },
    );
  }
  if (!MEDIA_TYPES.includes(file.type as MediaType)) {
    return NextResponse.json(
      { error: "รองรับเฉพาะภาพ JPG, PNG, WEBP, GIF หรือไฟล์ PDF" },
      { status: 400 },
    );
  }
  const limit = file.type === "application/pdf" ? MAX_PDF_BYTES : MAX_BYTES;
  if (file.size > limit) {
    return NextResponse.json(
      { error: `ไฟล์ใหญ่เกิน ${Math.round(limit / 1024 / 1024)} MB` },
      { status: 400 },
    );
  }
  if (!TARGETS.includes(target as Target)) {
    return NextResponse.json({ error: "ไม่รู้จักชนิดข้อมูลที่จะให้อ่าน" }, { status: 400 });
  }

  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  const mediaType = file.type as MediaType;

  try {
    const data =
      target === "slide"
        ? await readSlideFromImage(base64, mediaType)
        : target === "rates"
          ? await readRatesFromImage(base64, mediaType)
          : await readAnnouncementFromFile(base64, mediaType);
    return NextResponse.json({ data });
  } catch (error) {
    console.error("AI อ่านภาพไม่สำเร็จ:", error);
    const message = error instanceof Error ? error.message : "อ่านภาพไม่สำเร็จ";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
