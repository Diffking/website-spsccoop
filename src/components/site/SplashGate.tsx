"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getActiveOccasion } from "@/content/splash";

/**
 * เด้งไปหน้า splash (/splash) ก่อนเข้าเว็บ — เฉพาะการเข้าครั้งแรกของแต่ละ session
 * และเฉพาะเมื่อวันนี้ตรงกับวันสำคัญที่เปิดไว้ในหลังบ้าน (/admin)
 *
 * เช็ควันฝั่ง client → พอเลยวันสำคัญไปแล้วก็หยุดเด้งเอง ไม่ต้อง deploy ซ้ำ
 * ครอว์เลอร์ไม่รัน JS → หน้า Home ยังถูก index ตามปกติ (SEO ไม่กระทบ)
 */
export default function SplashGate() {
  const router = useRouter();
  useEffect(() => {
    if (!getActiveOccasion()) return;
    try {
      if (!sessionStorage.getItem("spsc_entered")) {
        router.replace("/splash");
      }
    } catch {}
  }, [router]);
  return null;
}
