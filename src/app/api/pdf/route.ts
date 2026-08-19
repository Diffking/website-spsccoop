import { NextResponse } from "next/server";
import { isAllowedAssetUrl } from "@/lib/assetUrl";
import { assetCandidates } from "@/lib/assetFallback";

/**
 * ส่งไฟล์ PDF ที่แนบในหน้าเนื้อหา ผ่านโดเมนเดียวกับเว็บ
 *
 * เหตุผลเดียวกับ /api/ebook/[id] — ไฟล์จริงอยู่บนโดเมนเก็บ assets คนละโดเมนกับเว็บ
 * pdf.js อ่านข้ามโดเมนไม่ได้ถ้าปลายทางไม่ได้เปิด CORS
 *
 * ต่างกันตรงที่อันนั้นอ้างด้วย id ในฐาน ส่วนอันนี้รับ URL มาตรง ๆ จากเนื้อหาที่พิมพ์ไว้
 * จึงต้องตรวจให้แน่ว่าเป็นที่อยู่ของเราเองเท่านั้น ไม่งั้นกลายเป็นตัวกลางให้คนอื่นยิงไฟล์อะไรก็ได้
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const src = new URL(request.url).searchParams.get("src") ?? "";
  if (!isAllowedAssetUrl(src)) {
    return NextResponse.json({ error: "ที่อยู่ไฟล์ไม่ถูกต้อง" }, { status: 400 });
  }

  const range = request.headers.get("range");

  /*
   * ลองสำเนาในเครื่องก่อน แล้วค่อยตกไปที่โดเมน assets
   * โดเมนนั้นล่มเมื่อไหร่ (เกิดมาแล้วกับ beta.spsccoop.com) ถ้าไม่ลองในเครื่องก่อน
   * จะขึ้น "เปิดเอกสารไม่สำเร็จ" ทั้งที่ไฟล์ยังอยู่ครบในเครื่อง
   */
  let upstream: Response | null = null;
  for (const target of assetCandidates(src, request.url)) {
    const tried = await fetch(target, {
      headers: range ? { Range: range } : undefined,
      cache: "no-store",
    }).catch(() => null);
    if (tried?.ok && tried.body) {
      upstream = tried;
      break;
    }
  }

  if (!upstream || !upstream.body) {
    return NextResponse.json({ error: "เปิดไฟล์เอกสารไม่ได้" }, { status: 502 });
  }

  const headers = new Headers();
  headers.set("Content-Type", "application/pdf");
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "public, max-age=3600");
  for (const name of ["content-length", "content-range", "etag", "last-modified"]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }

  return new NextResponse(upstream.body, { status: upstream.status, headers });
}
