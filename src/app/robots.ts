import type { MetadataRoute } from "next";
import { getSeo } from "@/lib/seo";

// อ่านค่าจากหลังบ้านทุกครั้ง — prerender ตอน build ไม่ได้ (ยังไม่มี DATABASE_URL)
export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const seo = await getSeo();

  // สวิตช์ใหญ่ปิด = ห้ามเก็บทั้งเว็บ
  if (!seo.enabled) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  /*
   * โหมดเข้มสุด — อนุญาตเฉพาะ / ตัวเดียว ที่เหลือห้ามเข้าอ่านหมด
   * "/$" คือรูปแบบที่บอทเข้าใจว่า "ตรงกับที่อยู่นี้เป๊ะ ๆ" ไม่ใช่ทุกอย่างที่ขึ้นต้นด้วย /
   */
  if ((seo.scope ?? "all") === "home-strict") {
    return {
      rules: { userAgent: "*", allow: "/$", disallow: "/" },
      sitemap: `${seo.siteUrl.replace(/\/$/, "")}/sitemap.xml`,
    };
  }

  // หน้าที่ปิดการเก็บไว้รายหน้า + หลังบ้าน
  const disallow = ["/admin", ...seo.pages.filter((p) => !p.indexed).map((p) => p.path)];

  return {
    rules: { userAgent: "*", allow: "/", disallow },
    sitemap: `${seo.siteUrl.replace(/\/$/, "")}/sitemap.xml`,
  };
}
