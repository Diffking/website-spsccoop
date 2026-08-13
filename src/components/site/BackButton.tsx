"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

/**
 * ปุ่มย้อนกลับหน้าก่อนหน้า — ใช้บนหน้า 404
 *
 * ถ้าเข้ามาตรง ๆ (เปิดจากลิงก์ข้างนอก ไม่มีประวัติในแท็บนี้) การกด back จะพาออกจากเว็บ
 * จึงเช็คก่อนว่ามีประวัติจริงไหม ไม่มีก็พากลับหน้าหลักแทน
 */
export default function BackButton({ className = "" }: { className?: string }) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
      className={className}
    >
      <ArrowLeft className="h-4 w-4" />
      ย้อนกลับหน้าก่อนหน้า
    </button>
  );
}
