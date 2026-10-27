import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  ExternalLink,
  FileStack,
  Images,
  Megaphone,
  Newspaper,
} from "lucide-react";

/**
 * ส่วนบนสุดของหน้าภาพรวม — "วันนี้จะทำอะไร" มาก่อนตัวเลขสถิติ (เจ้าของเว็บขอ 27 ต.ค. 2569: หลังบ้านใช้ยาก)
 *
 *   ทางลัด  = งานที่ทำบ่อย กดทีเดียวไปถึง · โชว์เฉพาะที่คนนี้มีสิทธิ์ (หน้าเรียก canArea มาให้แล้ว)
 *   งานค้าง = ของที่ควรมีคนไปดู คำนวณฝั่งเซิร์ฟเวอร์ · ไม่มีอะไรค้างก็บอกว่าเรียบร้อย
 *
 * ไม่ได้เพิ่มหน้าใหม่ — ทุกลิงก์ชี้หน้าเดิมที่มีอยู่แล้ว
 */

export type Shortcut = "announcement" | "slide" | "ticker" | "pages" | "surveys";

const SHORTCUTS: Record<Shortcut, { href: string; label: string; hint: string; icon: typeof Megaphone }> = {
  announcement: { href: "/admin/home/announcements/", label: "ลงประกาศ / จดหมายข่าว", hint: "หน้าแรก", icon: Megaphone },
  slide: { href: "/admin/home/slides/", label: "อัปสไลด์แบนเนอร์", hint: "หน้าแรก", icon: Images },
  ticker: { href: "/admin/home/ticker/", label: "แก้ข่าววิ่ง", hint: "หน้าแรก", icon: Newspaper },
  pages: { href: "/admin/pages/", label: "แก้หน้าเนื้อหา", hint: "ระเบียบ · เอกสาร · ประวัติ", icon: FileStack },
  surveys: { href: "/admin/surveys/", label: "แบบประเมิน", hint: "สร้าง · ดูผล · จับรางวัล", icon: ClipboardCheck },
};

export type PendingTask = { label: string; href: string; tone: "warn" | "info" };

export default function HomeTasks({
  shortcuts,
  tasks,
  siteUrl,
}: {
  shortcuts: Shortcut[];
  tasks: PendingTask[];
  siteUrl: string;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <h2 className="text-sm font-semibold text-gray-800">ทางลัด</h2>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {shortcuts.map((key) => {
            const s = SHORTCUTS[key];
            return (
              <Link
                key={key}
                href={s.href}
                className="flex min-w-0 items-center gap-3 rounded-xl p-2.5 ring-1 ring-gray-100 transition hover:bg-brand-50 hover:ring-brand-200"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600">
                  <s.icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-gray-800">{s.label}</span>
                  <span className="block truncate text-xs text-gray-500">{s.hint}</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
              </Link>
            );
          })}
          <a
            href={siteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-w-0 items-center gap-3 rounded-xl p-2.5 ring-1 ring-gray-100 transition hover:bg-brand-50 hover:ring-brand-200"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gray-50 text-gray-500">
              <ExternalLink className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-gray-800">เปิดหน้าเว็บไซต์</span>
              <span className="block truncate text-xs text-gray-500">ดูผลที่แก้ไป (แท็บใหม่)</span>
            </span>
          </a>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <h2 className="text-sm font-semibold text-gray-800">งานค้าง</h2>
        {tasks.length === 0 ? (
          <p className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-3 text-sm text-emerald-700">
            <CheckCircle2 className="h-4 w-4 shrink-0" /> ไม่มีงานค้าง เรียบร้อยดี
          </p>
        ) : (
          <ul className="mt-3 grid grid-cols-1 gap-2">
            {tasks.map((t) => (
              <li key={t.label} className="min-w-0">
                <Link
                  href={t.href}
                  className={`flex min-w-0 items-center gap-2 rounded-xl px-3 py-2.5 text-sm transition ${
                    t.tone === "warn"
                      ? "bg-amber-50 text-amber-800 hover:bg-amber-100"
                      : "bg-sky-50 text-sky-800 hover:bg-sky-100"
                  }`}
                >
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{t.label}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 opacity-50" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
