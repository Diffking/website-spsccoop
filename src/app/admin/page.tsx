import Link from "next/link";
import { Users, Megaphone, FileStack, ChevronRight } from "lucide-react";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import LoginForm from "@/components/admin/LoginForm";
import LogoutButton from "@/components/admin/LogoutButton";

const MENU = [
  {
    href: "/admin/home",
    icon: Megaphone,
    title: "หน้าแรก",
    desc: "ข่าววิ่ง ประกาศ ดอกเบี้ย ข้อมูลสหกรณ์",
  },
  {
    href: "/admin/pages",
    icon: FileStack,
    title: "หน้าเนื้อหา",
    desc: "ประวัติความเป็นมา วิสัยทัศน์ ฯลฯ",
  },
];

export default async function AdminPage() {
  const user = await currentUser();
  if (!user) {
    return <LoginForm />;
  }

  const [announcements, tickers, pages, users] = await Promise.all([
    db.announcement.count(),
    db.newsTicker.count(),
    db.page.count(),
    db.user.count(),
  ]);
  const counts: Record<string, number> = {
    "/admin/home": announcements + tickers,
    "/admin/pages": pages,
    "/admin/users": users,
  };

  // จัดการผู้ใช้ให้เห็นเฉพาะผู้ดูแลระบบ
  const menu =
    user.role === "ADMIN"
      ? [...MENU, { href: "/admin/users", icon: Users, title: "ผู้ใช้งาน", desc: "เพิ่ม/แก้ไขคนที่เข้าหลังบ้านได้" }]
      : MENU;

  return (
    <>
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate font-semibold text-gray-800">หลังบ้านเว็บไซต์</p>
            <p className="truncate text-xs text-gray-500">
              {user.name} · {user.username}
            </p>
          </div>
          <LogoutButton />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        <div className="grid gap-3">
          {menu.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 transition hover:shadow-md active:scale-[0.99]"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
                <item.icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-gray-800">{item.title}</span>
                <span className="block truncate text-sm text-gray-500">{item.desc}</span>
              </span>
              <span className="shrink-0 text-sm text-gray-400">{counts[item.href] ?? 0} รายการ</span>
              <ChevronRight className="h-5 w-5 shrink-0 text-gray-300" />
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}
