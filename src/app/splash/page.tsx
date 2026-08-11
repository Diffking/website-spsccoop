import type { Metadata } from "next";
import SplashView from "@/components/site/SplashView";
import { getSplash } from "@/lib/settings";

// หน้า splash วันสำคัญ — ไม่เก็บ SEO / ไม่ให้ index
export const metadata: Metadata = {
  title: "วันสำคัญ",
  robots: { index: false, follow: false },
};

// เนื้อหามาจากฐาน (แก้ที่ /admin/splash) — prerender ตอน build ไม่ได้
export const dynamic = "force-dynamic";

export default async function SplashPage() {
  const content = await getSplash();
  return <SplashView content={content} />;
}
