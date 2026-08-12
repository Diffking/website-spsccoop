"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Monitor, Smartphone, RotateCw, ExternalLink, Pencil } from "lucide-react";

/**
 * พรีวิวหน้าแรกจริงในกรอบ — ดูของจริงได้เลยโดยไม่ต้องเปิดอีกแท็บ
 *
 * ใช้ iframe ชี้ไปที่ "/" ของโดเมนเดียวกัน (ไม่ใช่เว็บนอก) ตัวหน้าแรกตั้ง force-dynamic
 * อยู่แล้ว กดรีเฟรชแล้วเห็นของที่เพิ่งแก้ทันที
 */

const PARTS: { href: string; label: string }[] = [
  { href: "/admin/home/slides", label: "สไลด์" },
  { href: "/admin/home/rates", label: "อัตราดอกเบี้ย" },
  { href: "/admin/home/ticker", label: "ข่าววิ่ง" },
  { href: "/admin/home/announcements", label: "ประกาศ / จดหมายข่าว" },
  { href: "/admin/home/committees", label: "คณะกรรมการดำเนินการ" },
  { href: "/admin/home/services", label: "บริการ" },
  { href: "/admin/home/member", label: "สำหรับสมาชิก" },
  { href: "/admin/home/calendar", label: "ปฏิทินสหกรณ์" },
  { href: "/admin/home/officers", label: "สำนักงานบริการสมาชิก" },
];

export default function HomePreview() {
  const frame = useRef<HTMLIFrameElement>(null);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [nonce, setNonce] = useState(0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-full bg-gray-100 p-1">
          {(
            [
              ["desktop", "จอคอม", Monitor],
              ["mobile", "มือถือ", Smartphone],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setDevice(key)}
              className={`relative inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                device === key ? "text-white" : "text-gray-600 hover:text-gray-800"
              }`}
            >
              {device === key && (
                <motion.span
                  layoutId="preview-device"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  className="absolute inset-0 rounded-full bg-brand-600"
                />
              )}
              <Icon className="relative h-3.5 w-3.5" />
              <span className="relative">{label}</span>
            </button>
          ))}
        </div>

        <button
          onClick={() => setNonce((n) => n + 1)}
          className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-gray-600 shadow-sm ring-1 ring-black/5 transition hover:text-brand-600"
        >
          <RotateCw className="h-3.5 w-3.5" /> โหลดใหม่
        </button>

        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-gray-600 shadow-sm ring-1 ring-black/5 transition hover:text-brand-600"
        >
          <ExternalLink className="h-3.5 w-3.5" /> เปิดแท็บใหม่
        </a>
      </div>

      {/* กรอบพรีวิว */}
      <div className="overflow-hidden rounded-2xl bg-gray-100 p-3 ring-1 ring-black/5">
        <motion.div
          layout
          transition={{ type: "spring", stiffness: 260, damping: 30 }}
          className={`mx-auto overflow-hidden rounded-xl bg-white shadow-lg ${
            device === "mobile" ? "w-[390px] max-w-full" : "w-full"
          }`}
        >
          <iframe
            ref={frame}
            key={`${device}-${nonce}`}
            src="/"
            title="พรีวิวหน้าแรก"
            className="h-[70vh] w-full border-0"
          />
        </motion.div>
      </div>

      {/* ทางลัดไปแก้แต่ละส่วน */}
      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <h2 className="text-sm font-semibold text-gray-800">แก้แต่ละส่วนของหน้าแรก</h2>
        <p className="mt-0.5 text-xs text-gray-500">เลือกจากเมนูซ้าย หรือกดที่นี่ก็ได้</p>

        <div className="mt-3 flex flex-wrap gap-2">
          {PARTS.map((part) => (
            <Link
              key={part.href}
              href={part.href}
              className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3.5 py-2 text-sm font-medium text-brand-700 transition hover:bg-brand-100"
            >
              <Pencil className="h-3.5 w-3.5" /> {part.label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
