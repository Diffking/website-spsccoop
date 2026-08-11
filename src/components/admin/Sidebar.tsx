"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  LayoutDashboard,
  Megaphone,
  Crown,
  CalendarOff,
  FileStack,
  Users,
  Menu,
  X,
  ExternalLink,
} from "lucide-react";
import LogoutButton from "@/components/admin/LogoutButton";

export type MenuKey = "dashboard" | "home" | "splash" | "holidays" | "pages" | "users";

const ITEMS: {
  key: MenuKey;
  href: string;
  icon: typeof LayoutDashboard;
  label: string;
  desc: string;
}[] = [
  {
    key: "dashboard",
    href: "/admin",
    icon: LayoutDashboard,
    label: "ภาพรวม",
    desc: "สถิติและสถานะของระบบ",
  },
  {
    key: "home",
    href: "/admin/home",
    icon: Megaphone,
    label: "หน้าแรก",
    desc: "ข่าววิ่ง ประกาศ อัตราดอกเบี้ย และข้อมูลสหกรณ์",
  },
  {
    key: "splash",
    href: "/admin/splash",
    icon: Crown,
    label: "วันสำคัญ",
    desc: "พระราชพิธี วันเฉลิมพระชนมพรรษา และวันสำคัญของชาติ",
  },
  {
    key: "holidays",
    href: "/admin/holidays",
    icon: CalendarOff,
    label: "วันหยุด",
    desc: "วันหยุดทำการของสหกรณ์",
  },
  {
    key: "pages",
    href: "/admin/pages",
    icon: FileStack,
    label: "หน้าเนื้อหา",
    desc: "ประวัติความเป็นมา วิสัยทัศน์ ระเบียบข้อบังคับ",
  },
  {
    key: "users",
    href: "/admin/users",
    icon: Users,
    label: "ผู้ใช้งาน",
    desc: "ผู้มีสิทธิ์เข้าใช้งานระบบหลังบ้าน",
  },
];

function Nav({ isAdmin, onNavigate }: { isAdmin: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const items = isAdmin ? ITEMS : ITEMS.filter((i) => i.key !== "users");

  return (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
      {items.map((item) => {
        // /admin ต้องเทียบแบบเป๊ะ ไม่งั้นจะค้างสว่างตลอดเพราะทุกหน้าขึ้นต้นด้วย /admin
        const active =
          item.href === "/admin"
            ? pathname === "/admin" || pathname === "/admin/"
            : pathname.startsWith(item.href);

        return (
          <Link
            key={item.key}
            href={item.href}
            onClick={onNavigate}
            title={item.desc}
            className={`relative flex items-start gap-3 rounded-xl px-3 py-2.5 transition ${
              active ? "text-white" : "text-brand-50/80 hover:bg-white/10 hover:text-white"
            }`}
          >
            {active && (
              <motion.span
                layoutId="admin-nav-active"
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
                className="absolute inset-0 rounded-xl bg-white/15 ring-1 ring-white/20"
              />
            )}
            <item.icon className="relative mt-0.5 h-5 w-5 shrink-0" />
            <span className="relative min-w-0">
              <span className="block text-sm font-medium leading-tight">{item.label}</span>
              <span className="mt-0.5 block text-[11px] leading-snug text-brand-100/70">
                {item.desc}
              </span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

export default function Sidebar({
  isAdmin,
  userName,
  userCode,
}: {
  isAdmin: boolean;
  userName: string;
  userCode: string;
}) {
  const [open, setOpen] = useState(false);

  const brand = (
    <div className="flex items-center gap-2.5 border-b border-white/10 px-4 py-4">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/15 text-white">
        <LayoutDashboard className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-white">หลังบ้านเว็บไซต์</span>
        <span className="block truncate text-[11px] text-brand-100/70">
          {userName} · {userCode}
        </span>
      </span>
    </div>
  );

  const footer = (
    <div className="space-y-1 border-t border-white/10 p-3">
      <a
        href="/"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-brand-50/80 transition hover:bg-white/10 hover:text-white"
      >
        <ExternalLink className="h-4 w-4" /> เปิดหน้าเว็บไซต์
      </a>
      <LogoutButton className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-brand-50/80 transition hover:bg-white/10 hover:text-white" />
    </div>
  );

  return (
    <>
      {/* แถบบนสำหรับจอเล็ก — ปุ่มเปิดเมนู */}
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3 md:hidden">
        <button
          onClick={() => setOpen(true)}
          aria-label="เปิดเมนู"
          className="rounded-lg p-1.5 text-gray-600 transition hover:bg-gray-100"
        >
          <Menu className="h-5 w-5" />
        </button>
        <p className="truncate font-semibold text-gray-800">หลังบ้านเว็บไซต์</p>
      </div>

      {/* เมนูค้างซ้ายบนจอใหญ่ */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-brand-800 md:flex">
        {brand}
        <Nav isAdmin={isAdmin} />
        {footer}
      </aside>

      {/* ลิ้นชักเมนูบนจอเล็ก */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 bg-black/40 md:hidden"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
              className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-brand-800 md:hidden"
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">{brand}</div>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="ปิดเมนู"
                  className="m-3 rounded-lg p-1.5 text-white/70 transition hover:bg-white/10"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <Nav isAdmin={isAdmin} onNavigate={() => setOpen(false)} />
              {footer}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
