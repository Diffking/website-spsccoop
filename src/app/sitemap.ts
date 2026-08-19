import type { MetadataRoute } from "next";
import { getSeo } from "@/lib/seo";
import { publicPaths } from "@/lib/publicPaths";

// อ่านค่าจากหลังบ้านทุกครั้ง — prerender ตอน build ไม่ได้ (ยังไม่มี DATABASE_URL)
export const dynamic = "force-dynamic";

/**
 * บอกกูเกิลว่าเว็บนี้มีหน้าอะไรบ้าง
 *
 * เดิมลิสต์เฉพาะหน้าที่เจ้าหน้าที่ไปเพิ่มเองในเมนูตั้งค่า SEO ซึ่งมีอยู่รายการเดียวคือหน้าแรก
 * กูเกิลจึงไม่รู้จักอีก 20 กว่าหน้าเลย ตอนนี้ไล่จากหน้าจริงทั้งหมด แล้วใช้ค่าในเมนูตั้งค่า
 * เป็นตัว "ปิด" เฉพาะหน้าที่ไม่อยากให้เก็บเท่านั้น
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const seo = await getSeo();
  if (!seo.enabled) return [];

  const base = seo.siteUrl.replace(/\/$/, "");
  const blocked = new Set(
    seo.pages.filter((page) => !page.indexed).map((page) => page.path.replace(/\/$/, "")),
  );

  const paths = await publicPaths();

  return paths
    .filter((path) => !blocked.has(path.replace(/\/$/, "")))
    .map((path) => ({
      url: path === "/" ? base : `${base}${path}`,
      lastModified: new Date(),
      changeFrequency: path === "/" ? ("daily" as const) : ("monthly" as const),
      priority: path === "/" ? 1 : 0.7,
    }));
}
