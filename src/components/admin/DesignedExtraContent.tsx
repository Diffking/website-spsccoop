"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, PencilLine, Plus } from "lucide-react";

/**
 * ปุ่ม "ข้อความท้ายหน้า" ของหน้าออกแบบอัตโนมัติ
 *
 * ข้อความเพิ่มเติมเก็บเป็นหน้าเนื้อหาที่ slug เดียวกับหน้าที่ออกแบบไว้ ยังไม่มีก็สร้างให้ตรงนี้
 * (สร้างจากเมนูหน้าเนื้อหาก็ได้ แต่ต้องรู้ว่าต้องตั้ง slug ให้ตรงเป๊ะ ไม่งั้นข้อความไม่ขึ้น)
 */
export default function DesignedExtraContent({
  slug,
  title,
  pageId,
  published,
}: {
  slug: string;
  title: string;
  pageId?: string;
  published?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function create() {
    setBusy(true);
    setError("");

    const response = await fetch("/api/admin/pages/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, slug }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(data.error ?? "สร้างไม่สำเร็จ");
      setBusy(false);
      return;
    }
    router.push(`/admin/pages/${data.page.id}/`);
  }

  if (pageId) {
    return (
      <Link
        href={`/admin/pages/${pageId}/`}
        className="flex items-start gap-2 rounded-xl bg-gray-50 p-3 ring-1 ring-gray-200 transition hover:bg-gray-100"
      >
        <PencilLine className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
        <span className="min-w-0">
          <span className="block text-sm font-medium text-gray-800">แก้ข้อความท้ายหน้า</span>
          <span className="block text-xs text-gray-500">
            ข้อความที่พิมพ์จะไปต่อท้ายส่วนที่ระบบจัดให้ ·{" "}
            {published ? "เผยแพร่อยู่" : "ยังเป็นฉบับร่าง จึงยังไม่ขึ้นเว็บ"}
          </span>
        </span>
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={create}
      disabled={busy}
      className="flex items-start gap-2 rounded-xl bg-gray-50 p-3 text-left ring-1 ring-gray-200 transition hover:bg-gray-100 disabled:opacity-60"
    >
      {busy ? (
        <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-brand-600" />
      ) : (
        <Plus className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
      )}
      <span className="min-w-0">
        <span className="block text-sm font-medium text-gray-800">เพิ่มข้อความท้ายหน้า</span>
        <span className="block text-xs text-gray-500">
          {error || "อยากเขียนอธิบายเพิ่มใต้แผนที่ กดสร้างแล้วพิมพ์ได้เลย"}
        </span>
      </span>
    </button>
  );
}
