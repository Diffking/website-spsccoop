import type { MetadataRoute } from "next";
import { getSeo } from "@/lib/seo";

// อ่านค่าจากหลังบ้านทุกครั้ง — prerender ตอน build ไม่ได้ (ยังไม่มี DATABASE_URL)
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const seo = await getSeo();
  if (!seo.enabled) return [];

  const base = seo.siteUrl.replace(/\/$/, "");

  // เฉพาะหน้าที่เปิดให้เก็บ — หน้าที่ปิดไว้ไม่ควรโผล่ใน sitemap
  return seo.pages
    .filter((page) => page.indexed)
    .map((page) => ({
      url: page.path === "/" ? base : `${base}${page.path}`,
      lastModified: new Date(),
      changeFrequency: page.path === "/" ? ("daily" as const) : ("monthly" as const),
      priority: page.path === "/" ? 1 : 0.7,
    }));
}
