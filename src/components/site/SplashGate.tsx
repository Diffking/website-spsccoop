"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CRAWLER_UA, getActiveOccasion, type SplashContent } from "@/content/splash";
import { hasEntered } from "@/lib/splashSession";

/**
 * เด้งไปหน้า splash (/splash) ตอน "กลับมาหน้าแรกโดยไม่โหลดหน้าใหม่"
 *
 * การเปิดเว็บครั้งแรกไม่ได้พึ่งตัวนี้แล้ว — สคริปต์ใน splashRedirect.ts เด้งไปตั้งแต่
 * ก่อนหน้าแรกจะวาด (เร็วกว่ามาก) · ตัวนี้เหลือไว้สำหรับทางที่สคริปต์นั้นเอื้อมไม่ถึง
 * คือกดปุ่มย้อนกลับ/กดลิงก์กลับหน้าแรกในเว็บ ซึ่งไม่ได้โหลด HTML ใหม่ สคริปต์จึงไม่ได้รันอีก
 * (มีผลจริงกับโหมด "เด้งทุกครั้งที่กลับมาหน้าแรก" เป็นหลัก)
 *
 * เช็ควันฝั่ง client → พอเลยวันสำคัญไปแล้วก็หยุดเด้งเอง ไม่ต้อง deploy ซ้ำ
 *
 * ที่อยู่ต้องมี / ปิดท้ายเสมอ เว็บนี้ตั้งไว้แบบนั้น — ไม่ใส่จะโดนพาไปที่อยู่ใหม่อีกจังหวะหนึ่ง
 * ซึ่งเวลาอ่านผ่านสำเนาบนโฮสต์แล้วสะดุด กดเข้าเว็บครั้งแรกจะไม่เด้งไปหน้าวันสำคัญ
 */
export default function SplashGate({ content }: { content: SplashContent }) {
  const router = useRouter();
  useEffect(() => {
    // ครอว์เลอร์ห้ามโดนเด้ง ไม่งั้นหน้าแรกจัดทำดัชนีไม่ได้ (ดูคำอธิบายที่ CRAWLER_UA)
    if (CRAWLER_UA.test(navigator.userAgent)) return;
    if (!getActiveOccasion(content)) return;
    if (!hasEntered(content)) router.replace("/splash/");
  }, [router, content]);
  return null;
}
