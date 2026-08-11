import { NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { testFtp } from "@/lib/ftp";

/** ทดสอบว่าค่าที่ตั้งใน .env ต่อ FTP ได้จริงไหม — ไม่อัปไฟล์อะไรขึ้นไป */
export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  return NextResponse.json(await testFtp());
}
