import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "หลังบ้าน",
  robots: { index: false, follow: false },
};

// หลังบ้านต้องอ่านสถานะล็อกอินสดทุกครั้ง ห้าม cache
export const dynamic = "force-dynamic";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-gray-50">{children}</div>;
}
