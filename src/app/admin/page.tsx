import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getBackupStatus } from "@/lib/backups";
import { popularPages, visitorsByYear } from "@/lib/analytics";
import LoginForm from "@/components/admin/LoginForm";
import Dashboard from "@/components/admin/Dashboard";
import MirrorPanel from "@/components/admin/MirrorPanel";
import { mirrorStatus } from "@/lib/mirror";

export default async function AdminPage() {
  const user = await currentUser();
  if (!user) {
    return <LoginForm />;
  }

  const [announcements, tickers, holidays, pages, users, backup, visitors, popular] =
    await Promise.all([
      db.announcement.count(),
      db.newsTicker.count(),
      db.holiday.count(),
      db.page.count(),
      db.user.count(),
      getBackupStatus(),
      visitorsByYear(),
      popularPages(),
    ]);

  // ถามโฮสต์แยกต่างหาก — โฮสต์ล่มก็ไม่ควรทำให้หน้าภาพรวมทั้งหน้าเปิดไม่ได้
  const mirror = await mirrorStatus();

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <h1 className="mb-5 text-xl font-bold text-gray-800">ภาพรวมระบบ</h1>
      <Dashboard
        counts={{ announcements, tickers, holidays, pages, users }}
        backup={backup}
        visitors={visitors}
        popular={popular}
      />
      <div className="mt-4">
        <MirrorPanel initial={mirror} />
      </div>
    </main>
  );
}
