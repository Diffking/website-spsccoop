"use client";

import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

/**
 * ปุ่ม "เข้าสู่เว็บไซต์" บนหน้า splash — จำว่าเข้าแล้ว (ไม่เด้ง splash ซ้ำใน session)
 *
 * กระพริบช้า ๆ เพื่อบอกว่ากดได้ เพราะหน้านี้มีแต่ภาพกับปุ่มเดียว
 * บางคนนั่งดูภาพแล้วไม่รู้ว่าต้องกดตรงไหนถึงจะเข้าเว็บ
 * (คลาส splash-button อยู่ใน globals.css · เครื่องที่ลดการเคลื่อนไหวจะนิ่ง)
 */
export default function EnterSiteButton({
  label = "เข้าสู่เว็บไซต์",
  light = false,
}: {
  label?: string;
  /** พื้นหลังสว่าง = ต้องใช้ตัวหนังสือเข้ม */
  light?: boolean;
}) {
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
      className={`splash-button group inline-flex items-center gap-2 rounded-full border px-8 py-3 text-base font-medium backdrop-blur transition duration-300 ${
        light
          ? "border-amber-700/30 bg-black/5 text-amber-900 hover:border-amber-700/60 hover:bg-black/10"
          : "border-amber-200/40 bg-white/5 text-amber-50/90 hover:border-amber-200/70 hover:bg-white/10 hover:text-amber-50"
      }`}
    >
      {label}{" "}
      <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
    </button>
  );
}
