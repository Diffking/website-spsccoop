import { redirect } from "next/navigation";
import { Server } from "lucide-react";
import { currentUser } from "@/lib/auth";
import { canAnyPage, canArea, filterPages, hasFullAccess } from "@/lib/permissions";
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
import { publicSiteUrl } from "@/lib/siteUrl";
import { syncStatus } from "@/lib/memberSync";
import Dashboard, { BackupPanel } from "@/components/admin/Dashboard";
import HomeTasks, { type PendingTask, type Shortcut } from "@/components/admin/HomeTasks";
import MirrorPanel from "@/components/admin/MirrorPanel";
import { mirrorStatus } from "@/lib/mirror";

export default async function AdminPage() {
  const user = await currentUser();
  // หน้าเข้าสู่ระบบมีที่อยู่ของตัวเองแล้ว — /admin ไว้สำหรับคนที่เข้าระบบแล้วเท่านั้น
  if (!user) redirect("/login/");

  const full = hasFullAccess(user);
  const now = new Date();

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

  /*
   * ถามโฮสต์เฉพาะคนที่จะเห็นกล่องสำเนา (ดูแลทั้งเว็บ) — เดิมถามทุกคนที่เปิดหน้านี้
   * ทั้งที่คนอื่นไม่ได้เห็นผล · ยังจำผลไว้ 6 ชม. ใน mirrorStatus() เหมือนเดิม
   */
  const mirror = full ? await mirrorStatus() : null;

  // การ์ดตัวเลขเป็นทางลัดไปหน้าที่แก้ของนั้น — โชว์เฉพาะทางลัดที่คนนี้เดินไปได้จริง
  const tiles = (
    [
      canArea(user, "home.announcements") && "announcements",
      canArea(user, "holidays") && "holidays",
      canAnyPage(user) && "pages",
      user.role === "ADMIN" && "users",
    ] as const
  ).filter((key): key is "announcements" | "holidays" | "pages" | "users" => Boolean(key));

  const shortcuts = (
    [
      canArea(user, "home.announcements") && "announcement",
      canArea(user, "home.slides") && "slide",
      canArea(user, "home.ticker") && "ticker",
      canAnyPage(user) && "pages",
      canArea(user, "surveys") && "surveys",
    ] as const
  ).filter((key): key is Shortcut => Boolean(key));

  // งานค้าง — เฉพาะเรื่องที่คนนี้ดูแล · อ่านฐานอย่างเดียว ไม่แตะเครือข่าย
  const tasks: PendingTask[] = [];
  if (canArea(user, "home.slides")) {
    const expired = await db.slide.count({ where: { endsAt: { lt: now } } });
    if (expired) tasks.push({ label: `สไลด์หมดเวลาเผยแพร่แล้ว ${expired} ใบ — ลบทิ้งได้`, href: "/admin/home/slides/", tone: "info" });
  }
  if (canAnyPage(user)) {
    const drafts = filterPages(
      user,
      await db.page.findMany({ where: { published: false }, select: { slug: true, category: true } }),
    ).length;
    if (drafts) tasks.push({ label: `หน้าเนื้อหายังไม่เผยแพร่ ${drafts} หน้า`, href: "/admin/pages/", tone: "info" });
  }
  if (canArea(user, "surveys")) {
    const [review, pending, sync] = await Promise.all([
      db.surveyResponse.count({ where: { status: "review" } }),
      db.surveyResponse.count({ where: { status: "pending" } }),
      syncStatus(),
    ]);
    if (review) tasks.push({ label: `คำตอบแบบประเมินรอเจ้าหน้าที่ตรวจ ${review} รายการ`, href: "/admin/surveys/", tone: "warn" });
    if (pending) tasks.push({ label: `คำตอบแบบประเมินรอตรวจกับทะเบียน ${pending} รายการ`, href: "/admin/surveys/", tone: "info" });
    if (sync.configured && sync.count > 0 && sync.stale) {
      tasks.push({ label: "ทะเบียนสมาชิกไม่ได้อัปเดตเกิน 3 วัน", href: "/admin/surveys/", tone: "warn" });
    }
  }
  if (full && (!backup.latestAt || backup.stale)) {
    tasks.push({ label: "ไฟล์สำรองข้อมูลเก่ากว่า 2 วัน — ดูสถานะระบบด้านล่าง", href: "#system", tone: "warn" });
  }

  // กล่องสถานะระบบเปิดค้างไว้เองเมื่อมีปัญหา — ปกติพับไว้ ไม่ให้ข้อมูลเทคนิคบังงานประจำ
  const systemTrouble = !backup.latestAt || backup.stale || (mirror ? mirror.configured && !mirror.reachable : false);

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <h1 className="mb-5 text-xl font-bold text-gray-800">ภาพรวมระบบ</h1>
      <div className="mb-5">
        <HomeTasks shortcuts={shortcuts} tasks={tasks} siteUrl={publicSiteUrl()} />
      </div>
      <Dashboard
        counts={{ announcements, tickers, holidays, pages, users }}
        visits={visits}
        popular={popular}
        total={total}
        carriedOver={carriedOver}
        people={people}
        tiles={tiles}
      />
      {/* ข้อมูลเทคนิค — เฉพาะคนที่ดูแลทั้งเว็บ (สั่งอุ่น/ล้างสำเนาบนโฮสต์กระทบทั้งเว็บ) · โค้ดข้างในเหมือนเดิม แค่ย้ายมาพับไว้ */}
      {full && (
        <details id="system" open={systemTrouble} className="group mt-5 scroll-mt-6 rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
          <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gray-100 text-gray-600">
              <Server className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-gray-800">สถานะระบบ</span>
              <span className="block text-xs text-gray-500">การสำรองข้อมูล · สำเนาหน้าเว็บบนโฮสต์</span>
            </span>
            <span
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${
                systemTrouble ? "bg-amber-50 text-amber-700 ring-amber-200" : "bg-emerald-50 text-emerald-700 ring-emerald-200"
              }`}
            >
              {systemTrouble ? "ต้องตรวจสอบ" : "ปกติ"}
            </span>
            <span className="shrink-0 text-xs text-brand-600 group-open:hidden">ดูรายละเอียด</span>
            <span className="hidden shrink-0 text-xs text-brand-600 group-open:inline">ซ่อน</span>
          </summary>
          <div className="space-y-4 border-t border-gray-100 p-4">
            <BackupPanel backup={backup} />
            {mirror && <MirrorPanel initial={mirror} />}
          </div>
        </details>
      )}
    </main>
  );
}
