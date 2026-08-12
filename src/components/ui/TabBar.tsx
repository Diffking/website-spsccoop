"use client";

import { motion } from "motion/react";

/**
 * แถบแท็บแบบขีดเส้นใต้ — ใช้ทั้งการ์ดหน้าแรกและหลังบ้าน จะได้หน้าตาเหมือนกัน
 *
 * เส้นใต้เลื่อนตามด้วย layoutId ของ motion จึงต้องส่ง layoutId ที่ไม่ซ้ำกับแท็บชุดอื่นในหน้าเดียวกัน
 * จอแคบเลื่อนแนวนอนได้ ไม่ตัดแท็บทิ้ง
 */

export type TabItem<T extends string> = {
  value: T;
  label: string;
  /** ตัวเลขข้างชื่อ เช่น จำนวนรายการในหมวดนั้น — ไม่ใส่ = ไม่แสดง */
  count?: number;
};

export default function TabBar<T extends string>({
  items,
  value,
  onChange,
  layoutId,
  className = "",
}: {
  items: readonly TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  layoutId: string;
  className?: string;
}) {
  return (
    <div className={`border-b border-gray-200 ${className}`}>
      <nav aria-label="เลือกหมวด" className="-mb-px flex gap-6 overflow-x-auto">
        {items.map((item) => {
          const active = item.value === value;
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => onChange(item.value)}
              aria-current={active ? "page" : undefined}
              className={`relative shrink-0 whitespace-nowrap border-b-2 px-1 pb-3 pt-2 text-sm font-medium transition ${
                active
                  ? "border-transparent text-brand-700"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              {item.label}
              {item.count !== undefined && (
                <span
                  className={`ml-2 rounded-full px-2 py-0.5 text-xs tabular-nums ${
                    active ? "bg-brand-50 text-brand-700" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {item.count}
                </span>
              )}
              {active && (
                <motion.span
                  layoutId={layoutId}
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-brand-600"
                />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
