import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { canAnyPage, canArea, hasFullAccess } from "@/lib/permissions";
import { db } from "@/lib/db";
import { getBackupStatus } from "@/lib/backups";
import {
  parseCount,
  popularPages,
  uniqueVisitors,
  visitTotal,
  visitsByYear,
} from "@/lib/analytics";
import { getSiteInfo } from "@/lib/settings";
import Dashboard from "@/components/admin/Dashboard";
import MirrorPanel from "@/components/admin/MirrorPanel";
import { mirrorStatus } from "@/lib/mirror";

export default async function AdminPage() {
  const user = await currentUser();
  // หน้าเข้าสู่ระบบมีที่อยู่ของตัวเองแล้ว — /admin ไว้สำหรับคนที่เข้าระบบแล้วเท่านั้น
  if (!user) redirect("/login/");

  const [announcements, tickers, holidays, pages, users, backup, visits, popular, info, people] =
    await Promise.all([
      db.announcement.count(),
      db.newsTicker.count(),
      db.holiday.count(),
      db.page.count(),
      db.user.count(),
      getBackupStatus(),
      visitsByYear(),
      popularPages(),
      getSiteInfo(),
      uniqueVisitors(),
    ]);

  // ยอดเดียวกับที่สมาชิกเห็นท้ายเว็บ — เจ้าหน้าที่จะได้ไม่งงว่าทำไมสองที่ไม่ตรงกัน
  const carriedOver = parseCount(info.visitorCarriedOver);
  const total = await visitTotal(carriedOver);

  // ถามโฮสต์แยกต่างหาก — โฮสต์ล่มก็ไม่ควรทำให้หน้าภาพรวมทั้งหน้าเปิดไม่ได้
  const mirror = await mirrorStatus();

  // การ์ดตัวเลขเป็นทางลัดไปหน้าที่แก้ของนั้น — โชว์เฉพาะทางลัดที่คนนี้เดินไปได้จริง
  const tiles = (
    [
      canArea(user, "home.announcements") && "announcements",
      canArea(user, "holidays") && "holidays",
      canAnyPage(user) && "pages",
      user.role === "ADMIN" && "users",
    ] as const
  ).filter((key): key is "announcements" | "holidays" | "pages" | "users" => Boolean(key));

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <h1 className="mb-5 text-xl font-bold text-gray-800">ภาพรวมระบบ</h1>
      <Dashboard
        counts={{ announcements, tickers, holidays, pages, users }}
        backup={backup}
        visits={visits}
        popular={popular}
        total={total}
        carriedOver={carriedOver}
        people={people}
        tiles={tiles}
      />
      {/* สั่งล้างสำเนาบนโฮสต์กระทบทั้งเว็บ ไม่ใช่ส่วนใดส่วนหนึ่ง — เฉพาะคนที่ดูแลทั้งเว็บ */}
      {hasFullAccess(user) && (
        <div className="mt-4">
          <MirrorPanel initial={mirror} />
        </div>
      )}
    </main>
  );
}
