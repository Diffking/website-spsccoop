import { NextResponse } from "next/server";
import { requireUser, requireWrite } from "@/lib/apiAuth";
import { mirrorStatus, runWarm } from "@/lib/mirror";

export const dynamic = "force-dynamic";

/** สถานะสำเนาหน้าเว็บบนโฮสต์ */
export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  return NextResponse.json(await mirrorStatus());
}

/** สั่งอุ่นสำเนาเดี๋ยวนี้ — ส่ง { force: true } เพื่อดึงใหม่ทุกไฟล์แม้ยังไม่หมดอายุ */
export async function POST(request: Request) {
  const auth = await requireWrite();
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json().catch(() => ({}))) as { force?: boolean };
  const result = await runWarm(Boolean(body.force));

  return NextResponse.json({ ...result, status: await mirrorStatus() });
}
