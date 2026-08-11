"use client";

import { motion } from "motion/react";
import Link from "next/link";
import {
  Megaphone,
  FileStack,
  Users,
  CalendarOff,
  DatabaseBackup,
  CheckCircle2,
  AlertTriangle,
  HardDrive,
  ChevronRight,
} from "lucide-react";
import { VisitorsChart, PopularPagesChart, type YearPoint, type PagePoint } from "./StatsCharts";
import type { BackupStatus } from "@/lib/backups";

const rise = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
};

const thaiDateTime = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Bangkok",
});

const mb = (bytes: number) =>
  bytes >= 1_048_576
    ? `${(bytes / 1_048_576).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

export type Counts = {
  announcements: number;
  tickers: number;
  holidays: number;
  pages: number;
  users: number;
};

const TILES: { key: keyof Counts; label: string; unit: string; href: string; icon: typeof Users }[] = [
  { key: "announcements", label: "ประกาศสหกรณ์", unit: "เรื่อง", href: "/admin/home", icon: Megaphone },
  { key: "holidays", label: "วันหยุดทำการ", unit: "วัน", href: "/admin/holidays", icon: CalendarOff },
  { key: "pages", label: "หน้าเนื้อหา", unit: "หน้า", href: "/admin/pages", icon: FileStack },
  { key: "users", label: "ผู้ใช้งานระบบ", unit: "คน", href: "/admin/users", icon: Users },
];

export default function Dashboard({
  counts,
  backup,
  visitors,
  popular,
}: {
  counts: Counts;
  backup: BackupStatus;
  visitors: YearPoint[];
  popular: PagePoint[];
}) {
  const latestYear = visitors[visitors.length - 1];
  const prevYear = visitors[visitors.length - 2];
  const growth =
    prevYear && prevYear.visitors > 0
      ? Math.round(((latestYear.visitors - prevYear.visitors) / prevYear.visitors) * 100)
      : null;

  return (
    <div className="space-y-5">
      {/* ตัวเลขนำ */}
      <motion.section
        {...rise}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 to-brand-400 p-5 text-white shadow-sm"
      >
        <p className="text-sm text-brand-50/80">ผู้เข้าชมเว็บไซต์ปีบัญชี {latestYear.year}</p>
        <p className="mt-1 text-5xl font-bold tabular-nums leading-none">
          {latestYear.visitors.toLocaleString("th-TH")}
        </p>
        <p className="mt-2 text-sm text-brand-50/90">
          คน
          {growth !== null && (
            <span className="ml-2 rounded-full bg-white/20 px-2 py-0.5 text-xs font-medium">
              {growth >= 0 ? "▲" : "▼"} {Math.abs(growth)}% จากปี {prevYear.year}
            </span>
          )}
        </p>
      </motion.section>

      {/* การ์ดตัวเลข */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {TILES.map((tile, i) => (
          <motion.div
            key={tile.key}
            {...rise}
            transition={{ duration: 0.4, delay: 0.05 + i * 0.06, ease: "easeOut" }}
          >
            <Link
              href={tile.href}
              className="flex h-full items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 transition hover:shadow-md active:scale-[0.99]"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
                <tile.icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-2xl font-bold tabular-nums leading-none text-gray-800">
                  {counts[tile.key].toLocaleString("th-TH")}
                  <span className="ml-1 text-xs font-normal text-gray-400">{tile.unit}</span>
                </span>
                <span className="mt-1 block truncate text-xs text-gray-500">{tile.label}</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
            </Link>
          </motion.div>
        ))}
      </div>

      {/* กราฟ */}
      <div className="grid gap-4 lg:grid-cols-2">
        <motion.div {...rise} transition={{ duration: 0.45, delay: 0.2, ease: "easeOut" }}>
          <VisitorsChart data={visitors} />
        </motion.div>
        <motion.div {...rise} transition={{ duration: 0.45, delay: 0.28, ease: "easeOut" }}>
          <PopularPagesChart data={popular} />
        </motion.div>
      </div>

      {/* การสำรองข้อมูล — ของจริง อ่านจากโฟลเดอร์ backups */}
      <motion.section
        {...rise}
        transition={{ duration: 0.45, delay: 0.34, ease: "easeOut" }}
        className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
              <DatabaseBackup className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-semibold text-gray-800">การสำรองข้อมูล</h2>
              <p className="mt-0.5 text-xs text-gray-500">
                ระบบสำรองฐานข้อมูลอัตโนมัติวันละครั้ง เก็บย้อนหลัง 14 วัน
              </p>
            </div>
          </div>

          {backup.latestAt && !backup.stale ? (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
              <CheckCircle2 className="h-3.5 w-3.5" /> ปกติ
            </span>
          ) : (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
              <AlertTriangle className="h-3.5 w-3.5" /> ต้องตรวจสอบ
            </span>
          )}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-gray-50 p-3">
            <p className="text-xs text-gray-500">สำรองล่าสุด</p>
            <p className="mt-1 text-sm font-medium text-gray-800">
              {backup.latestAt ? thaiDateTime.format(new Date(backup.latestAt)) : "ยังไม่มีไฟล์สำรอง"}
            </p>
          </div>
          <div className="rounded-xl bg-gray-50 p-3">
            <p className="text-xs text-gray-500">ไฟล์ที่เก็บไว้</p>
            <p className="mt-1 text-sm font-medium tabular-nums text-gray-800">
              {backup.total.toLocaleString("th-TH")} ไฟล์
            </p>
          </div>
          <div className="rounded-xl bg-gray-50 p-3">
            <p className="text-xs text-gray-500">พื้นที่ที่ใช้</p>
            <p className="mt-1 flex items-center gap-1.5 text-sm font-medium tabular-nums text-gray-800">
              <HardDrive className="h-4 w-4 text-gray-400" /> {mb(backup.totalSize)}
            </p>
          </div>
        </div>

        {backup.files.length > 0 && (
          <ul className="mt-3 divide-y divide-gray-50 text-sm">
            {backup.files.map((f) => (
              <li key={f.name} className="flex items-center justify-between gap-3 py-2">
                <span className="truncate text-gray-600">{f.name}</span>
                <span className="shrink-0 tabular-nums text-xs text-gray-400">{mb(f.size)}</span>
              </li>
            ))}
          </ul>
        )}

        {backup.stale && (
          <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
            ไฟล์สำรองล่าสุดเก่ากว่า 2 วัน — ตรวจสอบว่าบริการสำรองข้อมูลยังทำงานอยู่หรือไม่
            ด้วยคำสั่ง <code className="font-mono">docker compose logs db-backup</code>
          </p>
        )}
      </motion.section>
    </div>
  );
}
