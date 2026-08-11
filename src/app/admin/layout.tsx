import type { Metadata } from "next";
import { currentUser } from "@/lib/auth";
import Sidebar from "@/components/admin/Sidebar";

export const metadata: Metadata = {
  title: "หลังบ้าน",
  robots: { index: false, follow: false },
};

// หลังบ้านต้องอ่านสถานะล็อกอินสดทุกครั้ง ห้าม cache
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();

  // ยังไม่ล็อกอิน = มีแต่หน้าเข้าสู่ระบบ ไม่ต้องมีเมนู
  if (!user) {
    return <div className="min-h-screen bg-gray-50">{children}</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar isAdmin={user.role === "ADMIN"} userName={user.name} userCode={user.username} />
      <div className="md:pl-64">{children}</div>
    </div>
  );
}
