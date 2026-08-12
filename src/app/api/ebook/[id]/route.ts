import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * ส่งไฟล์ PDF ของเอกสารผ่านโดเมนเดียวกับเว็บ
 *
 * ไฟล์จริงอยู่บนโดเมนที่เก็บ assets ซึ่งคนละโดเมนกับเว็บ — pdf.js อ่านข้ามโดเมนไม่ได้
 * ถ้าโฮสต์ปลายทางไม่ได้เปิด CORS ไว้ จึงต้องให้เว็บเราเป็นตัวกลางส่งต่อ
 *
 * ส่งหัว Range ต่อไปให้ปลายทางด้วย pdf.js จะได้ดึงมาทีละช่วง ไม่ต้องรอทั้งเล่มก่อนเปิดอ่าน
 */

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;

  const item = await db.announcement.findUnique({
    where: { id },
    select: { fileUrl: true, published: true },
  });
  if (!item || !item.published || !item.fileUrl) {
    return NextResponse.json({ error: "ไม่พบเอกสาร" }, { status: 404 });
  }

  const target = item.fileUrl.startsWith("/")
    ? new URL(item.fileUrl, request.url).toString()
    : item.fileUrl;

  const range = request.headers.get("range");
  const upstream = await fetch(target, {
    headers: range ? { Range: range } : undefined,
    cache: "no-store",
  }).catch(() => null);

  if (!upstream || !upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "เปิดไฟล์เอกสารไม่ได้" }, { status: 502 });
  }

  const headers = new Headers();
  headers.set("Content-Type", "application/pdf");
  headers.set("Accept-Ranges", "bytes");
  // เอกสารที่เผยแพร่แล้วแทบไม่เปลี่ยน ให้เบราว์เซอร์เก็บไว้ เปิดซ้ำจะได้ไม่ต้องโหลดใหม่
  headers.set("Cache-Control", "public, max-age=3600");
  for (const name of ["content-length", "content-range", "etag", "last-modified"]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }

  return new NextResponse(upstream.body, { status: upstream.status, headers });
}
