"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { SPLASH_GRACE_MS, getActiveOccasion, type SplashContent } from "@/content/splash";

/**
 * เด้งไปหน้า splash (/splash) ก่อนเข้าเว็บ — เฉพาะการเข้าครั้งแรกของแต่ละ session
 * และเฉพาะเมื่อวันนี้ตรงกับวันสำคัญที่เปิดไว้ในหลังบ้าน (/admin)
 *
 * เช็ควันฝั่ง client → พอเลยวันสำคัญไปแล้วก็หยุดเด้งเอง ไม่ต้อง deploy ซ้ำ
 *
 * ที่อยู่ต้องมี / ปิดท้ายเสมอ เว็บนี้ตั้งไว้แบบนั้น — ไม่ใส่จะโดนพาไปที่อยู่ใหม่อีกจังหวะหนึ่ง
 * ซึ่งเวลาอ่านผ่านสำเนาบนโฮสต์แล้วสะดุด กดเข้าเว็บครั้งแรกจะไม่เด้งไปหน้าวันสำคัญ
 * ครอว์เลอร์ไม่รัน JS → หน้า Home ยังถูก index ตามปกติ (SEO ไม่กระทบ)
 */
export default function SplashGate({ content }: { content: SplashContent }) {
  const router = useRouter();
  useEffect(() => {
    if (!getActiveOccasion(content)) return;
    try {
      const entered = Number(sessionStorage.getItem("spsc_entered"));

      /*
       * โหมด "ทุกครั้ง" — เด้งอีกได้เมื่อพ้นช่วงผ่อนผันหลังกดเข้าเว็บ
       * ไม่มีช่วงผ่อนผัน = กดเข้าเว็บแล้วเด้งกลับทันที วนจนเข้าเว็บไม่ได้
       */
      const done =
        content.repeat === "always"
          ? Number.isFinite(entered) && entered > 0 && Date.now() - entered < SPLASH_GRACE_MS
          : sessionStorage.getItem("spsc_entered") !== null;

      if (!done) router.replace("/splash/");
    } catch {}
  }, [router, content]);
  return null;
}
