"use client";

import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

/** ปุ่ม "เข้าสู่เว็บไซต์" บนหน้า splash — จำว่าเข้าแล้ว (ไม่เด้ง splash ซ้ำใน session) */
export default function EnterSiteButton({ label = "เข้าสู่เว็บไซต์" }: { label?: string }) {
  const router = useRouter();
  const enter = () => {
    try {
      sessionStorage.setItem("spsc_entered", "1");
    } catch {}
    router.push("/");
  };
  return (
    <button
      onClick={enter}
      className="inline-flex items-center gap-2 rounded-full border border-amber-200/40 bg-white/5 px-8 py-3 text-base font-medium text-amber-50/90 backdrop-blur transition hover:border-amber-200/70 hover:bg-white/10 hover:text-amber-50"
    >
      {label} <ArrowRight className="h-4 w-4" />
    </button>
  );
}
