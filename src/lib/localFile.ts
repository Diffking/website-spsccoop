import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import path from "node:path";

/**
 * ส่งไฟล์ใน uploads/ ออกไปตรง ๆ จากดิสก์ — ไม่ต้องวนออกไปเรียกเว็บตัวเองผ่านอินเทอร์เน็ต
 *
 * ตัวส่งต่อ PDF เดิม fetch มาที่ URL ของเว็บตัวเอง (https://coopsmile.org/uploads/...)
 * บนเครื่องพัฒนาเรียก localhost จึงผ่าน แต่บนเว็บจริงคำขอต้องวิ่งออกไปที่ Cloudflare
 * แล้ววิ่งกลับเข้ามาทางอุโมงค์ ซึ่งจากในคอนเทนเนอร์ทำไม่ได้ — ผลคือ 502 ทุกไฟล์
 * (ตรวจบนโดเมนจริงแล้ว: /uploads/x.pdf = 200 แต่ /api/pdf?src=/uploads/x.pdf = 502)
 *
 * อ่านจากดิสก์ตรง ๆ จึงทั้งเร็วกว่าและไม่พึ่งเครือข่ายภายนอกเลย
 * รองรับ Range ด้วย เพราะ pdf.js ขอไฟล์ทีละช่วง ไม่ได้โหลดทั้งเล่มก่อนเปิด
 */

const UPLOADS = path.join(process.cwd(), "public", "uploads");

/** ชื่อไฟล์ใน uploads/ จากที่อยู่ — ไม่ใช่ไฟล์ในเครื่องหรือมีการไต่โฟลเดอร์ คืน null */
function uploadName(url: string): string | null {
  const clean = url.split("?")[0];
  if (!clean.startsWith("/uploads/")) return null;

  const rest = clean.slice("/uploads/".length);
  const name = path.basename(rest);
  return rest === name && name && !name.includes("..") ? name : null;
}

/**
 * คืน Response ของไฟล์ในเครื่อง — ไม่ใช่ไฟล์ที่ส่งเองได้ (อยู่บนโดเมนอื่น/ไม่มีไฟล์) คืน null
 * ให้คนเรียกไปลองทางอื่นต่อ
 */
export async function localFileResponse(
  url: string,
  range: string | null,
  contentType = "application/pdf",
): Promise<Response | null> {
  const name = uploadName(url);
  if (!name) return null;

  const file = path.join(UPLOADS, name);
  const info = await stat(file).catch(() => null);
  if (!info?.isFile()) return null;

  const headers = new Headers({
    "Content-Type": contentType,
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=3600",
    "Last-Modified": info.mtime.toUTCString(),
  });

  // pdf.js ขอทีละช่วง — ตอบ 206 พร้อมบอกว่าให้ช่วงไหนมา ไม่งั้นมันจะโหลดซ้ำทั้งเล่ม
  const asked = /bytes=(\d*)-(\d*)/.exec(range ?? "");
  if (asked) {
    const start = asked[1] ? Number(asked[1]) : 0;
    const end = asked[2] ? Math.min(Number(asked[2]), info.size - 1) : info.size - 1;

    if (start >= info.size || start > end) {
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${info.size}` },
      });
    }

    headers.set("Content-Range", `bytes ${start}-${end}/${info.size}`);
    headers.set("Content-Length", String(end - start + 1));
    const stream = Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream;
    return new Response(stream, { status: 206, headers });
  }

  headers.set("Content-Length", String(info.size));
  return new Response(Readable.toWeb(createReadStream(file)) as ReadableStream, {
    status: 200,
    headers,
  });
}
