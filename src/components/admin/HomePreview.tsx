"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { Monitor, Smartphone, RotateCw, ExternalLink, Eye, EyeOff, Pencil } from "lucide-react";

/**
 * แถบลัดไปแก้แต่ละส่วนของหน้าแรก + พรีวิวหน้าแรกจริงในกรอบ
 *
 * พรีวิวเป็น iframe ชี้ไปที่ "/" ของโดเมนเดียวกัน (ไม่ใช่เว็บนอก) ตัวหน้าแรกตั้ง force-dynamic
 * อยู่แล้ว กดรีเฟรชแล้วเห็นของที่เพิ่งแก้ทันที
 *
 * ตั้งต้นไม่โหลดพรีวิว ต้องกดเปิดเอง — เข้ามาหน้านี้ส่วนใหญ่เพื่อกดไปแก้ส่วนใดส่วนหนึ่ง
 * ไม่ได้มาดูพรีวิว การโหลดหน้าแรกทั้งหน้าทิ้งไว้ทุกครั้งเปลืองเปล่า ๆ
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
  const [showPreview, setShowPreview] = useState(false);

  const chip =
    "inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-gray-600 shadow-sm ring-1 ring-black/5 transition hover:text-brand-600";

  return (
    <div className="space-y-4">
      {/* แถบเมนูแก้แต่ละส่วน — ขึ้นบรรทัดใหม่เมื่อจอแคบ ไม่ซ่อนรายการไว้นอกจอ */}
      <nav className="rounded-2xl bg-white p-2 shadow-sm ring-1 ring-black/5">
        <ul className="flex flex-wrap gap-1">
          {PARTS.map((part) => (
            <li key={part.href}>
              <Link
                href={part.href}
                className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium text-gray-600 transition hover:bg-brand-50 hover:text-brand-700"
              >
                <Pencil className="h-3.5 w-3.5" /> {part.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* ปุ่มควบคุมพรีวิว */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setShowPreview((v) => !v)}
          className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium shadow transition ${
            showPreview
              ? "bg-white text-gray-600 shadow-sm ring-1 ring-black/5 hover:text-gray-800"
              : "bg-brand-600 text-white hover:bg-brand-700"
          }`}
        >
          {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          {showPreview ? "ซ่อนพรีวิว" : "ดูพรีวิวหน้าแรก"}
        </button>

        {showPreview && (
          <>
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

            <button onClick={() => setNonce((n) => n + 1)} className={chip}>
              <RotateCw className="h-3.5 w-3.5" /> โหลดใหม่
            </button>
          </>
        )}

        <a href="/" target="_blank" rel="noopener noreferrer" className={chip}>
          <ExternalLink className="h-3.5 w-3.5" /> เปิดแท็บใหม่
        </a>
      </div>

      {/* กรอบพรีวิว — โหลด iframe ต่อเมื่อกดเปิดเท่านั้น */}
      <AnimatePresence initial={false}>
        {showPreview && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="overflow-hidden"
          >
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
