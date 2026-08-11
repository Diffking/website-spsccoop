import type { Metadata } from "next";
import SplashView from "@/components/site/SplashView";

// หน้า splash วันสำคัญ — ไม่เก็บ SEO / ไม่ให้ index
export const metadata: Metadata = {
  title: "วันสำคัญ",
  robots: { index: false, follow: false },
};

export default function SplashPage() {
  return <SplashView />;
}
