import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getBackupStatus } from "@/lib/backups";
import { popularPages, visitorsByYear } from "@/lib/analytics";
import LoginForm from "@/components/admin/LoginForm";
import Dashboard from "@/components/admin/Dashboard";

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

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <h1 className="mb-5 text-xl font-bold text-gray-800">ภาพรวมระบบ</h1>
      <Dashboard
        counts={{ announcements, tickers, holidays, pages, users }}
        backup={backup}
        visitors={visitors}
        popular={popular}
      />
    </main>
  );
}
