import { NextResponse } from "next/server";
import { record } from "@/lib/analytics";

/**
 * รับแจ้งการเข้าชมจากหน้าเว็บ (เรียกด้วย JavaScript หลังหน้าโหลดเสร็จ)
 *
 * ที่ไม่นับฝั่งเซิร์ฟเวอร์ตอน render เพราะบอทกับตัวไต่เว็บของ Google จะถูกนับไปด้วย
 * ทำให้ตัวเลขสูงเกินจริง — วิธีนี้นับเฉพาะเบราว์เซอร์ที่รัน JavaScript จริง
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { path?: string };
  const path = String(body.path ?? "");
  if (!path.startsWith("/")) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // ผ่าน Cloudflare Tunnel มา IP จริงอยู่ใน cf-connecting-ip
  const ip =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    "unknown";

  await record(path, ip, request.headers.get("user-agent") ?? "unknown");
  return NextResponse.json({ ok: true });
}
