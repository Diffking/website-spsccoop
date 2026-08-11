import { NextResponse } from "next/server";
import { currentUser, type SessionUser } from "@/lib/auth";

/**
 * ตัวช่วยสำหรับ API หลังบ้าน — เรียกต้นฟังก์ชันทุก route
 *
 * ใช้แบบนี้:
 *   const auth = await requireUser();
 *   if (auth instanceof NextResponse) return auth;   // ยังไม่ล็อกอิน
 *   // ใช้ auth.user ต่อได้เลย
 */
export async function requireUser(): Promise<{ user: SessionUser } | NextResponse> {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }
  return { user };
}

/** แปลงข้อความให้เป็น slug ที่ใช้ใน URL ได้ — รองรับภาษาไทย */
export function toSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^\p{L}\p{N}/-]+/gu, "")
    .replace(/-{2,}/g, "-")
    .replace(/^[-/]+|[-/]+$/g, "");
}
