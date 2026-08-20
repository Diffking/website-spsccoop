"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Loader2, X } from "lucide-react";

/**
 * แถบเตือนตอน ADMIN กำลังดูหลังบ้านในมุมมองของเจ้าหน้าที่คนอื่น
 *
 * อยู่นอกส่วนที่ถูกปิดไว้ ปุ่ม "ออกจากมุมมอง" จึงกดได้เสมอ ไม่ติดกับดักตัวเอง
 */
export default function ViewAsBar({
  name,
  code,
  realName,
}: {
  name: string;
  code: string;
  realName: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function leave() {
    setBusy(true);
    await fetch("/api/admin/view-as/", { method: "DELETE" });
    // ทั้งเมนูและเนื้อหาถูกวาดจากฝั่ง server ตามตัวตนที่สวมอยู่ ต้องให้วาดใหม่ทั้งหน้า
    router.replace("/admin/users/");
    router.refresh();
  }

  return (
    <div className="sticky top-0 z-20 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-amber-300 bg-amber-100 px-4 py-2.5 text-sm text-amber-900">
      <Eye className="h-4 w-4 shrink-0" />
      <p className="min-w-0 flex-1">
        กำลังดูในมุมมองของ <span className="font-semibold">{name}</span>{" "}
        <span className="font-mono text-xs">({code})</span> — ดูได้อย่างเดียว แก้ไขไม่ได้
        <span className="block text-xs text-amber-700">คุณล็อกอินอยู่ในชื่อ {realName}</span>
      </p>
      <button
        onClick={leave}
        disabled={busy}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-amber-800 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-amber-900 disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
        ออกจากมุมมอง
      </button>
    </div>
  );
}
