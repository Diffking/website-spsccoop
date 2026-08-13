import { NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { formatPageHtml } from "@/lib/ai";
import { cleanPageHtml } from "@/lib/pageHtml";

/**
 * ให้ AI จัดรูปแบบเนื้อหาหน้าเว็บ — จัดโครงอย่างเดียว ไม่แก้เนื้อความ
 *
 * ผลที่ได้ผ่านตัวกรองแท็กก่อนเสมอ ไม่ว่าจะเชื่อ AI แค่ไหน — สิ่งที่ตอบกลับมา
 * ถูกเอาไปใส่หน้าเว็บจริงด้วย dangerouslySetInnerHTML ถ้ามี <script> ปนมาคือจบ
 */
export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json().catch(() => ({}))) as { html?: string; title?: string };
  const html = String(body.html ?? "").trim();
  if (!html) return NextResponse.json({ error: "ยังไม่มีเนื้อหาให้จัดรูปแบบ" }, { status: 400 });

  try {
    const result = await formatPageHtml(html, String(body.title ?? "").trim());
    const cleaned = cleanPageHtml(result.html);

    // AI ตอบมาแต่กรองแล้วเหลือว่าง = ผลใช้ไม่ได้ อย่าเอาไปทับของเดิม
    if (!cleaned.trim()) {
      return NextResponse.json({ error: "จัดรูปแบบไม่สำเร็จ ลองใหม่อีกครั้ง" }, { status: 502 });
    }
    return NextResponse.json({ html: cleaned });
  } catch (error) {
    const message = error instanceof Error ? error.message : "จัดรูปแบบไม่สำเร็จ";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
