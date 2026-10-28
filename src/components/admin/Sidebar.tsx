"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Calculator,
  ClipboardCheck,
  LayoutDashboard,
  Megaphone,
  PanelTop,
  PanelBottom,
  Crown,
  CalendarOff,
  FileStack,
  Sparkles,
  Users,
  Search,
  Share2,
  ShieldCheck,
  KeyRound,
  Menu,
  X,
  ExternalLink,
} from "lucide-react";
import LogoutButton from "@/components/admin/LogoutButton";
import CommandPalette, { type PaletteEntry } from "@/components/admin/CommandPalette";
import {
  canAnyPage,
  canArea,
  type Actor,
  type AreaKey,
} from "@/lib/permissions";

export type MenuKey =
  | "dashboard"
  | "home"
  | "header"
  | "footer"
  | "splash"
  | "holidays"
  | "pages"
  | "designed"
  | "programs"
  | "surveys"
  | "seo"
  | "bridge"
  | "security"
  | "users";

const ITEMS: {
  key: MenuKey;
  href: string;
  icon: typeof LayoutDashboard;
  label: string;
  /** คำอธิบาย — โชว์ตอนชี้เมาส์และในช่องค้นหา (เดิมโชว์เป็นบรรทัดที่สอง เมนูเลยยาวเกินจอ) */
  desc: string;
  /** หัวกลุ่มบนเมนู — เรียงตาม GROUPS ไม่ใช่ตามลำดับในอาร์เรย์ */
  group?: string;
  /** พื้นที่ที่ต้องดูแลถึงจะเห็นเมนูนี้ — ไม่ระบุ = ทุกคนเห็น (ภาพรวม) */
  area?: AreaKey;
  /** ส่วนย่อยของหน้านั้น — โผล่ใต้เมนูแม่เมื่อกำลังอยู่ในหมวดนี้ */
  children?: { href: string; label: string; area: AreaKey }[];
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
    group: "เนื้อหาเว็บ",
    href: "/admin/home",
    icon: Megaphone,
    label: "หน้าแรก",
    desc: "ดูหน้าแรกและแก้ทีละส่วน",
    area: "home.layout",
    // เรียงตามลำดับที่ปรากฏจริงบนหน้าแรก เลื่อนหน้าเว็บลงไปเจออะไรก่อน เมนูก็อยู่ก่อน
    children: [
      { href: "/admin/home/slides", label: "สไลด์", area: "home.slides" },
      { href: "/admin/home/rates", label: "อัตราดอกเบี้ย", area: "home.rates" },
      { href: "/admin/home/ticker", label: "ข่าววิ่ง", area: "home.ticker" },
      { href: "/admin/home/announcements", label: "ประกาศ / จดหมายข่าว", area: "home.announcements" },
      { href: "/admin/home/committees", label: "คณะกรรมการดำเนินการ", area: "home.committees" },
      { href: "/admin/home/services", label: "บริการ", area: "home.services" },
      { href: "/admin/home/member", label: "สำหรับสมาชิก", area: "home.member" },
      { href: "/admin/home/calendar", label: "ปฏิทินสหกรณ์", area: "home.calendar" },
      { href: "/admin/home/officers", label: "สำนักงานบริการสมาชิก", area: "home.officers" },
    ],
  },
  {
    key: "header",
    group: "ส่วนประกอบเว็บ",
    area: "header",
    href: "/admin/header",
    icon: PanelTop,
    label: "ส่วนหัวเว็บ",
    desc: "ชื่อ โลโก้ และเมนูนำทางที่ขึ้นทุกหน้า",
  },
  {
    key: "footer",
    group: "ส่วนประกอบเว็บ",
    area: "footer",
    href: "/admin/footer",
    icon: PanelBottom,
    label: "ส่วนท้ายเว็บ",
    desc: "ข้อมูลติดต่อและลิงก์หน่วยงาน",
  },
  {
    key: "splash",
    group: "ส่วนประกอบเว็บ",
    area: "splash",
    href: "/admin/splash",
    icon: Crown,
    label: "วันสำคัญ",
    desc: "พระราชพิธี วันเฉลิมพระชนมพรรษา และวันสำคัญของชาติ",
  },
  {
    key: "holidays",
    group: "ส่วนประกอบเว็บ",
    area: "holidays",
    href: "/admin/holidays",
    icon: CalendarOff,
    label: "วันหยุด",
    desc: "วันหยุดทำการของสหกรณ์",
  },
  {
    key: "pages",
    group: "เนื้อหาเว็บ",
    area: "pages",
    href: "/admin/pages",
    icon: FileStack,
    label: "หน้าเนื้อหา",
    desc: "ประวัติความเป็นมา วิสัยทัศน์ ระเบียบข้อบังคับ",
  },
  {
    key: "designed",
    group: "เนื้อหาเว็บ",
    area: "designed",
    href: "/admin/designed",
    icon: Sparkles,
    label: "หน้าออกแบบอัตโนมัติ",
    desc: "หน้าที่ระบบจัดหน้าให้เอง เช่น ติดต่อเรา",
  },
  {
    key: "programs",
    group: "บริการสมาชิก",
    area: "programs",
    href: "/admin/programs",
    icon: Calculator,
    label: "หน้าโปรแกรม",
    desc: "เครื่องมือที่สมาชิกกดใช้ เช่น ตรวจสุขภาพการเงิน",
  },
  {
    key: "surveys",
    group: "บริการสมาชิก",
    area: "surveys",
    href: "/admin/surveys",
    icon: ClipboardCheck,
    label: "แบบประเมิน",
    desc: "ตั้งคำถามความพึงพอใจ ส่งลิงก์ให้สมาชิกตอบ",
  },
  {
    key: "seo",
    group: "ตั้งค่าระบบ",
    area: "seo",
    href: "/admin/seo",
    icon: Search,
    label: "SEO",
    desc: "กำหนดหน้าที่ให้เครื่องมือค้นหาเก็บ",
  },
  {
    key: "bridge",
    group: "ตั้งค่าระบบ",
    area: "bridge",
    href: "/admin/bridge",
    icon: Share2,
    label: "เชื่อมต่อระบบ",
    desc: "ข้อมูลที่แบ่งปันให้ระบบอื่นในสำนักงานอ่าน",
  },
  {
    key: "security",
    group: "ตั้งค่าระบบ",
    href: "/admin/security",
    icon: ShieldCheck,
    label: "ความปลอดภัย",
    desc: "การเข้าสู่ระบบ บัญชีผู้ใช้ เวอร์ชัน และระบบเชื่อมต่อ (ผู้ดูแลระบบ)",
  },
  {
    key: "users",
    group: "ตั้งค่าระบบ",
    href: "/admin/users",
    icon: Users,
    label: "ผู้ใช้งาน",
    desc: "ผู้มีสิทธิ์เข้าใช้งานระบบหลังบ้าน",
  },
];

/**
 * เมนูที่คนนี้เปิดได้ — ตัดทั้งเมนูแม่และเมนูย่อยที่ไม่ได้อยู่ในความรับผิดชอบทิ้ง
 *
 * เมนูแม่ "หน้าแรก" ยังโผล่ถ้ามีเมนูย่อยเหลืออยู่ แม้จะแก้การจัดวางหน้าแรกไม่ได้ —
 * แต่ให้กดแล้วไปหน้าย่อยหน้าแรกแทน จะได้ไม่พาไปหน้าที่เปิดไม่ได้
 */
/**
 * ลำดับหัวกลุ่มบนเมนู (เจ้าของเว็บขอ 27 ต.ค. 2569: หลังบ้านใช้ยาก เมนู 13 อันเรียงยาวไม่มีกลุ่ม)
 * เพิ่มเมนูใหม่ต้องใส่ `group` ด้วย ไม่งั้นไปกองอยู่บนสุดกับ "ภาพรวม"
 */
const GROUPS = ["", "เนื้อหาเว็บ", "ส่วนประกอบเว็บ", "บริการสมาชิก", "ตั้งค่าระบบ"];

function visibleItems(user: Actor) {
  return ITEMS.flatMap((item) => {
    if (item.key === "users" || item.key === "security") return user.role === "ADMIN" ? [item] : [];
    if (item.key === "pages") return canAnyPage(user) ? [item] : [];

    const children = item.children?.filter((child) => canArea(user, child.area));
    if (item.children) {
      if (!children?.length && !canArea(user, item.area!)) return [];
      const href = canArea(user, item.area!) ? item.href : children![0].href;
      return [{ ...item, href, children }];
    }

    return !item.area || canArea(user, item.area) ? [item] : [];
  }).sort((a, b) => GROUPS.indexOf(a.group ?? "") - GROUPS.indexOf(b.group ?? ""));
}

/** รายการให้ช่องค้นหาด่วน — เมนูกับเมนูย่อยที่คนนี้เปิดได้ */
function menuEntries(user: Actor): PaletteEntry[] {
  return visibleItems(user).flatMap((item) => [
    { label: item.label, sub: item.desc, href: item.href, kind: "menu" as const },
    ...(item.children ?? []).map((c) => ({ label: c.label, sub: `${item.label} › ${c.label}`, href: c.href, kind: "menu" as const })),
  ]);
}

function Nav({ user, onNavigate, onSearch }: { user: Actor; onNavigate?: () => void; onSearch: () => void }) {
  const pathname = usePathname();
  const items = visibleItems(user);

  return (
    <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
      <button
        type="button"
        onClick={onSearch}
        className="mb-2 flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-left text-sm text-brand-50/80 ring-1 ring-white/10 transition hover:bg-white/15 hover:text-white"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate">ค้นหาเมนู / หน้า</span>
        <kbd className="hidden shrink-0 rounded bg-white/10 px-1.5 py-0.5 font-sans text-[10px] md:inline">Ctrl K</kbd>
      </button>
      {items.map((item, index) => {
        // หัวกลุ่ม — ขึ้นเมื่อกลุ่มเปลี่ยนจากเมนูก่อนหน้า
        const heading = item.group && item.group !== items[index - 1]?.group ? item.group : null;
        // เทียบจากที่อยู่ของหมวด ไม่ใช่ item.href เพราะเมนูแม่อาจถูกชี้ไปหน้าย่อยแทน
        const root = ITEMS.find((i) => i.key === item.key)!.href;
        // /admin ต้องเทียบแบบเป๊ะ ไม่งั้นจะค้างสว่างตลอดเพราะทุกหน้าขึ้นต้นด้วย /admin
        const inSection =
          root === "/admin"
            ? pathname === "/admin" || pathname === "/admin/"
            : pathname.startsWith(root);
        // เมนูแม่ที่มีลูกจะสว่างเฉพาะตอนอยู่ที่หน้าตัวเอง ไม่ใช่ตอนอยู่หน้าลูก
        const active = item.children
          ? pathname === root || pathname === `${root}/`
          : inSection;

        return (
          <div key={item.key}>
            {heading && (
              <p className="px-3 pb-1 pt-3 text-[11px] font-medium tracking-wide text-brand-100/50">{heading}</p>
            )}
            <Link
              href={item.href}
              onClick={onNavigate}
              title={item.desc}
              className={`relative flex items-center gap-3 rounded-xl px-3 py-2 transition ${
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
              <item.icon className="relative h-5 w-5 shrink-0" />
              <span className="relative min-w-0 truncate text-sm font-medium">{item.label}</span>
            </Link>

            {/* ส่วนย่อย — คลี่ออกเมื่อกำลังอยู่ในหมวดนี้ */}
            <AnimatePresence initial={false}>
              {item.children && inSection && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                  className="overflow-hidden"
                >
                  <div className="ml-5 mt-1 space-y-0.5 border-l border-white/15 pl-3">
                    {item.children.map((child) => {
                      const childActive = pathname.startsWith(child.href);
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          onClick={onNavigate}
                          className={`block rounded-lg px-2.5 py-1.5 text-[13px] transition ${
                            childActive
                              ? "bg-white/15 font-medium text-white"
                              : "text-brand-100/70 hover:bg-white/10 hover:text-white"
                          }`}
                        >
                          {child.label}
                        </Link>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </nav>
  );
}

export default function Sidebar({
  role,
  areas,
  userName,
  userCode,
  siteUrl,
  pages,
}: {
  role: "ADMIN" | "EDITOR";
  areas: string[];
  userName: string;
  userCode: string;
  /** ที่อยู่เว็บสาธารณะ — คนละโดเมนกับหลังบ้าน ต้องส่งมาเต็ม ๆ ไม่ใช่ "/" */
  siteUrl: string;
  /** หน้าเนื้อหาที่คนนี้ดูแล (กรองสิทธิ์แล้วใน layout) — ให้ช่องค้นหาด่วนพาไปหน้าแก้ไขได้ตรง ๆ */
  pages: PaletteEntry[];
}) {
  const user: Actor = { role, areas };
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const entries = useMemo(() => [...menuEntries({ role, areas }), ...pages], [role, areas, pages]);

  // Ctrl+K / ⌘K เปิดค้นหาได้จากทุกหน้าในหลังบ้าน
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearching((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
      {/* ตั้งรหัสผ่านของตัวเอง — ทุกคนเข้าได้ ไม่เกี่ยวกับพื้นที่รับผิดชอบ */}
      <Link
        href="/admin/account/"
        className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-brand-50/80 transition hover:bg-white/10 hover:text-white"
      >
        <KeyRound className="h-4 w-4" /> บัญชีของฉัน
      </Link>
      <a
        href={siteUrl}
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
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3 md:hidden print:hidden">
        <button
          onClick={() => setOpen(true)}
          aria-label="เปิดเมนู"
          className="rounded-lg p-1.5 text-gray-600 transition hover:bg-gray-100"
        >
          <Menu className="h-5 w-5" />
        </button>
        <p className="min-w-0 flex-1 truncate font-semibold text-gray-800">หลังบ้านเว็บไซต์</p>
        <button
          onClick={() => setSearching(true)}
          aria-label="ค้นหาเมนูหรือหน้า"
          className="rounded-lg p-1.5 text-gray-600 transition hover:bg-gray-100"
        >
          <Search className="h-5 w-5" />
        </button>
      </div>

      <CommandPalette entries={entries} open={searching} onClose={() => setSearching(false)} />

      {/* เมนูค้างซ้ายบนจอใหญ่ */}
      {/* ตอนสั่งพิมพ์ (เช่น โปสเตอร์ QR แบบประเมิน) ไม่เอาเมนูติดไปบนกระดาษ */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-brand-800 md:flex print:hidden">
        {brand}
        <Nav user={user} onSearch={() => setSearching(true)} />
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
              <Nav user={user} onNavigate={() => setOpen(false)} onSearch={() => { setOpen(false); setSearching(true); }} />
              {footer}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
