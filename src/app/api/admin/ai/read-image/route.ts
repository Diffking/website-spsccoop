import { NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { db } from "@/lib/db";
import {
  AI_READY,
  readAnnouncementFromFile,
  readRatesFromImage,
  readSlideFromImage,
} from "@/lib/ai";
import { firstPages } from "@/lib/pdf";

/**
 * ให้ AI อ่านไฟล์ที่หลังบ้านอัปมา แล้วคืนค่าที่อ่านได้ไปเติมในฟอร์ม
 * ไม่บันทึกลงฐานเอง — เจ้าหน้าที่ตรวจแล้วกดบันทึกอีกที
 *
 * รับได้สองแบบ:
 *   file = ส่งไฟล์มาตรง ๆ (ใช้ตอนยังไม่ได้อัปเก็บ เช่นภาพประกาศดอกเบี้ย)
 *   url  = ไฟล์ที่เพิ่งอัปเก็บไปแล้ว ให้เซิร์ฟเวอร์ไปดึงเอง
 *          — เบราว์เซอร์จะได้ไม่ต้องส่งไฟล์เดิมซ้ำรอบสอง (รายงานกิจการ 40 MB ส่งสองรอบคือรอสองเท่า)
 *          รับเฉพาะ URL ที่อยู่ในตาราง Media ของเราเอง กันคนใช้เซิร์ฟเวอร์ไปดึงเว็บอื่น
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
/** จำนวนหน้าแรกของ PDF ที่ส่งให้ AI อ่าน — หัวเรื่องอยู่หน้าแรก เผื่อไว้ถึงหน้า 3 */
const AI_PAGES = 3;
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
  const url = String(form?.get("url") ?? "").trim();

  if (!TARGETS.includes(target as Target)) {
    return NextResponse.json({ error: "ไม่รู้จักชนิดข้อมูลที่จะให้อ่าน" }, { status: 400 });
  }

  // แบบที่หนึ่ง: บอก URL ของไฟล์ที่อัปเก็บไว้แล้ว
  if (url) {
    const media = await db.media.findUnique({ where: { url }, select: { mimeType: true } });
    if (!media || !MEDIA_TYPES.includes(media.mimeType as MediaType)) {
      return NextResponse.json({ error: "ไม่รู้จักไฟล์นี้" }, { status: 400 });
    }
    const fetched = await fetch(url.startsWith("/") ? new URL(url, request.url) : url, {
      cache: "no-store",
    }).catch(() => null);
    if (!fetched?.ok) {
      return NextResponse.json({ error: "ดึงไฟล์ที่อัปไว้ไม่ได้" }, { status: 502 });
    }
    return await read(
      Buffer.from(await fetched.arrayBuffer()),
      media.mimeType as MediaType,
      target as Target,
    );
  }

  if (!(file instanceof File)) {
    // เหมือนกับ /api/admin/upload — อ่าน body ไม่ได้มักแปลว่าไฟล์ใหญ่เกิน ไม่ใช่ไม่ได้เลือกไฟล์
    return NextResponse.json(
      { error: "อ่านไฟล์ไม่ได้ — ไฟล์อาจใหญ่เกินไป" },
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
  return await read(Buffer.from(await file.arrayBuffer()), file.type as MediaType, target as Target);
}

async function read(raw: Buffer, mediaType: MediaType, target: Target) {
  // หัวเรื่อง/เลขที่/วันที่ อยู่หน้าแรกเสมอ — รายงานกิจการเป็นร้อยหน้า
  // ถ้าส่งทั้งเล่มไปให้ AI อ่านจะรอนานมากและเปลืองค่าเรียกใช้เปล่า ๆ
  const trimmed =
    mediaType === "application/pdf" ? await firstPages(raw as Buffer<ArrayBuffer>, AI_PAGES) : raw;
  const base64 = trimmed.toString("base64");

  try {
    const data =
      target === "slide"
        ? await readSlideFromImage(base64, mediaType)
        : target === "rates"
          ? await readRatesFromImage(base64, mediaType)
          : await readAnnouncementFromFile(base64, mediaType);
    return NextResponse.json({ data });
  } catch (error) {
    console.error("AI อ่านไฟล์ไม่สำเร็จ:", error);
    const message = error instanceof Error ? error.message : "อ่านไฟล์ไม่สำเร็จ";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
