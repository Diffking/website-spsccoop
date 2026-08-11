import SplashView from "@/components/site/SplashView";
import { getSplash } from "@/lib/settings";
import { pageMetadata } from "@/lib/seo";

// ตั้งค่า SEO ของหน้านี้ที่ /admin/seo (ค่าตั้งต้น: ไม่ให้เก็บ)
export const generateMetadata = () => pageMetadata("/splash");

// เนื้อหามาจากฐาน (แก้ที่ /admin/splash) — prerender ตอน build ไม่ได้
export const dynamic = "force-dynamic";

export default async function SplashPage() {
  const content = await getSplash();
  return <SplashView content={content} />;
}
