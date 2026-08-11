"use client";

import { useEffect, useState } from "react";
import EnterSiteButton from "@/components/site/EnterSiteButton";
import {
  getActiveOccasion,
  splashContent,
  type SplashOccasion,
} from "@/content/splash";

/**
 * เนื้อหาหน้า splash — เลือกวันสำคัญฝั่ง client เท่านั้น
 * (เว็บเป็น static export ถ้าเลือกตอน build วันที่จะแช่เป็นวันที่ build ตลอดไป)
 *
 * ?preview=<id> = บังคับดูวันสำคัญที่ระบุ ไม่สนวันที่ — ใช้จากปุ่มดูตัวอย่างในหลังบ้าน
 */
export default function SplashView() {
  // undefined = ยังไม่ได้เช็ค (จอดำเปล่าๆ กันภาพผิดกระพริบ) | null = วันนี้ไม่มีวันสำคัญ
  const [occasion, setOccasion] = useState<SplashOccasion | null | undefined>(undefined);

  useEffect(() => {
    let previewId: string | null = null;
    try {
      previewId = new URLSearchParams(window.location.search).get("preview");
    } catch {}

    if (previewId) {
      setOccasion(splashContent.occasions.find((o) => o.id === previewId) ?? null);
      return;
    }
    setOccasion(getActiveOccasion());
  }, []);

  if (occasion === undefined) {
    return <main className="min-h-screen bg-black" />;
  }

  // เข้ามาเองทั้งที่ไม่ใช่วันสำคัญ — ไม่ปล่อยให้เจอจอดำเปล่า
  if (occasion === null) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-black px-4 py-10 text-center">
        <p className="text-white/60">ขณะนี้ไม่มีหน้าวันสำคัญที่กำลังแสดง</p>
        <EnterSiteButton label={splashContent.buttonText} />
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-black px-4 py-10 text-center">
      {/* ใช้ <img> ธรรมดาเพราะรูปเปลี่ยนได้จากหลังบ้าน ไม่รู้ขนาดล่วงหน้า */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={occasion.image}
        alt={occasion.alt}
        className="h-auto w-full max-w-[560px] rounded-lg shadow-2xl ring-1 ring-white/10"
      />

      {(occasion.headline || occasion.subtext) && (
        <div className="max-w-xl space-y-2">
          {occasion.headline && (
            <h1 className="text-xl font-medium text-amber-50/90 sm:text-2xl">
              {occasion.headline}
            </h1>
          )}
          {occasion.subtext && (
            <p className="text-sm leading-relaxed text-white/60">{occasion.subtext}</p>
          )}
        </div>
      )}

      <EnterSiteButton label={splashContent.buttonText} />
    </main>
  );
}
