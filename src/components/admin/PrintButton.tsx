"use client";

import { Printer } from "lucide-react";

/** ปุ่มสั่งพิมพ์หน้านี้ — เลือก "บันทึกเป็น PDF" ในหน้าต่างพิมพ์ได้ */
export default function PrintButton({ label = "พิมพ์ / บันทึกเป็น PDF" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-brand-700"
    >
      <Printer className="h-4 w-4" /> {label}
    </button>
  );
}
