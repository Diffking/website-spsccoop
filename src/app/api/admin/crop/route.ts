import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { requireWrite } from "@/lib/apiAuth";
import { db } from "@/lib/db";
import { MAX_EDGE } from "@/lib/image";

/**
 * ครอบตัดรูปที่อัปไว้แล้ว → ได้ไฟล์ใหม่ (ไม่ทับของเดิม)
 *
 * ทำไมต้องมี: รูปบุคลากรที่ได้มามัก **มีแถบชื่อกับตำแหน่งพิมพ์ติดอยู่ในรูป**
 * ซึ่งซ้ำกับชื่อที่หน้าเว็บพิมพ์ให้อยู่แล้วใต้รูป ดูรกและแถบของแต่ละคนสูงไม่เท่ากัน
 * รูปเลยดูเบี้ยวทั้งแถว · เจ้าของเว็บขอเครื่องมือตัดเอง 25 ส.ค. 2026
 *
 * ⚠️ **ได้ไฟล์ใหม่เสมอ ไม่เคยเขียนทับไฟล์เดิม** เพราะ
 *   1. รูปเดิมอาจถูกใช้ในหน้าอื่นอยู่ ทับแล้วหน้านั้นเปลี่ยนตามโดยไม่มีใครรู้
 *   2. ตัดพลาดแล้วยังกลับไปเอาของเดิมได้ (ต้นฉบับก่อนย่อไม่ได้เก็บไว้ ดู src/lib/image.ts)
 *   3. สำเนาบนโฮสต์ผูกกับ URL — ชื่อไฟล์ใหม่จึงไม่ไปชนสำเนาเก่าที่ยังไม่หมดอายุ
 *
 * ⚠️ **อ่านไฟล์จากดิสก์ตรง ๆ ห้ามวนกลับไปขอตัวเองผ่าน HTTP** — เคยพลาดแบบนั้น
 * ที่ AI อ่านภาพแล้วตอบ 502 ทุกครั้งเพราะในคอนเทนเนอร์ต่อ localhost ไม่ได้ (ดู AGENTS.md)
 */

/** ชื่อไฟล์ที่ระบบสร้างเองเท่านั้น — กัน ../ และกันไปอ่านไฟล์อื่นในเครื่อง */
const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*\.[A-Za-z0-9]+$/;

/** เล็กกว่านี้ถือว่ากดพลาด ไม่ใช่ตั้งใจตัด */
const MIN_EDGE = 24;

const fraction = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : NaN;
};

export async function POST(request: Request) {
  const auth = await requireWrite();
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => null);
  const url = typeof body?.url === "string" ? body.url : "";
  if (!url.startsWith("/uploads/")) {
    return NextResponse.json({ error: "ครอบตัดได้เฉพาะรูปที่อัปไว้ในเว็บนี้" }, { status: 400 });
  }

  const name = url.slice("/uploads/".length);
  if (!SAFE_NAME.test(name)) {
    return NextResponse.json({ error: "ชื่อไฟล์ไม่ถูกต้อง" }, { status: 400 });
  }
  if (/\.(svg|gif)$/i.test(name)) {
    // SVG เป็นเวกเตอร์ ตัดแล้วเสียความหมาย · GIF ตัดแล้วภาพเคลื่อนไหวพัง
    return NextResponse.json({ error: "ไฟล์ SVG กับ GIF ครอบตัดไม่ได้" }, { status: 400 });
  }

  /*
    รับเป็นสัดส่วน 0-1 ของรูป ไม่ใช่พิกเซล — ฝั่งหน้าจอแสดงรูปย่อขนาดตามจอ
    ถ้าส่งพิกเซลของสิ่งที่เห็นบนจอมา จอเล็กจอใหญ่จะตัดได้ไม่เท่ากัน
  */
  const left = fraction(body?.left);
  const top = fraction(body?.top);
  const width = fraction(body?.width);
  const height = fraction(body?.height);
  if ([left, top, width, height].some(Number.isNaN) || width <= 0 || height <= 0) {
    return NextResponse.json({ error: "ขอบเขตที่จะตัดไม่ถูกต้อง" }, { status: 400 });
  }

  const directory = path.join(process.cwd(), "public", "uploads");
  const source = await readFile(path.join(directory, name)).catch(() => null);
  if (!source) {
    return NextResponse.json({ error: "หาไฟล์รูปไม่เจอ" }, { status: 404 });
  }

  const meta = await sharp(source).metadata().catch(() => null);
  if (!meta?.width || !meta.height) {
    return NextResponse.json({ error: "อ่านรูปไม่ได้ ไฟล์อาจเสียหาย" }, { status: 400 });
  }

  // ปัดเข้าในกรอบรูปเสมอ — sharp จะ throw ทันทีถ้ากรอบล้นออกไปแม้แต่พิกเซลเดียว
  const x = Math.min(Math.round(left * meta.width), meta.width - MIN_EDGE);
  const y = Math.min(Math.round(top * meta.height), meta.height - MIN_EDGE);
  const w = Math.max(MIN_EDGE, Math.min(Math.round(width * meta.width), meta.width - x));
  const h = Math.max(MIN_EDGE, Math.min(Math.round(height * meta.height), meta.height - y));

  let bytes: Buffer;
  let size: { width: number; height: number };
  try {
    const result = await sharp(source)
      // ไม่ต้อง .rotate() — ไฟล์ที่เก็บถูกหมุนตาม EXIF ตั้งแต่ตอนอัปแล้ว
      // ใส่ซ้ำจะกลายเป็นหมุนสองรอบ แล้วกรอบที่ผู้ใช้ลากไว้จะไปคนละที่กับที่เห็น
      .extract({ left: Math.max(0, x), top: Math.max(0, y), width: w, height: h })
      /*
        ⚠️ **ย่อให้ไม่เกินเพดานเดิมของทั้งเว็บเสมอ** — เจ้าของเว็บสั่งไว้ว่าอะไรที่เกี่ยวกับ
        รูป/ไฟล์ต้องไม่ใหญ่เกินจำเป็น (ย้ำอีกครั้ง 26 ส.ค. 2026)

        ปกติรูปที่อัปผ่านหลังบ้านถูกย่อเหลือ 600px ตั้งแต่ตอนเก็บอยู่แล้ว ตัดแล้วจึงเล็กลง
        เสมอ — แต่รูปเก่าที่มีมาก่อนมีตัวย่อ หรือไฟล์ที่วันหลังใครเอาเข้า uploads/ ตรง ๆ
        อาจใหญ่กว่านั้น ถ้าไม่กันไว้ตรงนี้ ไฟล์ที่ตัดออกมาจะใหญ่ตามต้นฉบับโดยไม่มีใครรู้
      */
      .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    bytes = result.data;
    size = { width: result.info.width, height: result.info.height };
  } catch (error) {
    console.error("ครอบตัดรูปไม่สำเร็จ:", error);
    return NextResponse.json({ error: "ครอบตัดรูปไม่สำเร็จ" }, { status: 500 });
  }

  const output = `${randomUUID()}.webp`;
  await writeFile(path.join(directory, output), bytes);

  const cropped = `/uploads/${output}`;
  await db.media.create({
    data: {
      url: cropped,
      originalName: `ครอบตัดจาก ${name}`,
      mimeType: "image/webp",
      sizeBytes: bytes.byteLength,
      uploadedById: auth.user.id,
    },
  });

  return NextResponse.json({ url: cropped, ...size }, { status: 201 });
}
