import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { lineReady } from "@/lib/line";
import LoginForm from "@/components/admin/LoginForm";

/**
 * หน้าเข้าสู่ระบบ — แยกออกมาจาก /admin เพื่อให้ที่อยู่บนแถบเบราว์เซอร์อ่านแล้วรู้เรื่อง
 * (เดิมหน้าล็อกอินอยู่ที่ /admin ซึ่งอ่านแล้วเหมือนกำลังอยู่ในหลังบ้านทั้งที่ยังไม่ได้เข้า)
 *
 * เปิดได้เฉพาะโดเมนหลังบ้านเหมือน /admin — ด่านอยู่ที่ src/proxy.ts
 */

export const metadata: Metadata = {
  title: "เข้าสู่ระบบ",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ line?: string }>;
}) {
  // เข้าระบบอยู่แล้วไม่ต้องมาเห็นหน้านี้ — พาเข้าหลังบ้านเลย
  if (await currentUser()) redirect("/admin/");

  // ?line=... คือรหัสเหตุผลที่ callback ส่งกลับมาตอนเข้าด้วย LINE ไม่สำเร็จ
  const { line } = await searchParams;

  return (
    <div className="min-h-screen bg-gray-50">
      <LoginForm lineReady={lineReady()} lineNotice={line} />
    </div>
  );
}
