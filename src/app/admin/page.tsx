import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getBackupStatus } from "@/lib/backups";
import LoginForm from "@/components/admin/LoginForm";
import Dashboard from "@/components/admin/Dashboard";

/**
 * ตัวเลขผู้เข้าชม — ยังไม่ได้ต่อระบบเก็บสถิติจริง ใส่ตัวอย่างไว้ให้เห็นหน้าตาก่อน
 * ในหน้าจอมีป้าย "ข้อมูลตัวอย่าง" กำกับไว้แล้ว จะได้ไม่มีใครเอาไปใช้อ้างอิง
 */
const SAMPLE_VISITORS = [
  { year: 2565, visitors: 42180 },
  { year: 2566, visitors: 58940 },
  { year: 2567, visitors: 76320 },
  { year: 2568, visitors: 98650 },
  { year: 2569, visitors: 124870 },
];

const SAMPLE_POPULAR = [
  { page: "หน้าแรก", views: 18420 },
  { page: "ประกาศสหกรณ์", views: 9860 },
  { page: "ดาวน์โหลดเอกสาร", views: 7310 },
  { page: "คณะกรรมการดำเนินการ", views: 4950 },
  { page: "อัตราดอกเบี้ย", views: 3720 },
];

export default async function AdminPage() {
  const user = await currentUser();
  if (!user) {
    return <LoginForm />;
  }

  const [announcements, tickers, holidays, pages, users, backup] = await Promise.all([
    db.announcement.count(),
    db.newsTicker.count(),
    db.holiday.count(),
    db.page.count(),
    db.user.count(),
    getBackupStatus(),
  ]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <h1 className="mb-5 text-xl font-bold text-gray-800">ภาพรวมระบบ</h1>
      <Dashboard
        counts={{ announcements, tickers, holidays, pages, users }}
        backup={backup}
        visitors={SAMPLE_VISITORS}
        popular={SAMPLE_POPULAR}
      />
    </main>
  );
}
