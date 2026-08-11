import type { Metadata } from "next";
import { getSetting } from "@/lib/settings";

/**
 * ตั้งค่า SEO ทั้งเว็บจากที่เดียว (หลังบ้าน → SEO)
 *
 * แนวคิด: หน้าเว็บแต่ละหน้าไม่ต้องเขียน metadata ของตัวเอง แค่บอกว่า "ฉันคือ path ไหน"
 * แล้วดึงค่าจากที่นี่ — จะเปิด/ปิดการเก็บของ Google รายหน้าได้โดยไม่ต้องแก้โค้ดหน้านั้น
 */

export type SeoPage = {
  /** เส้นทางของหน้า เช่น "/" หรือ "/about/directory/board" */
  path: string;
  /** ชื่อที่แสดงในหลังบ้าน */
  label: string;
  /** ให้เครื่องมือค้นหาเก็บหน้านี้ไหม */
  indexed: boolean;
  /** เว้นว่าง = ใช้ค่ากลาง */
  title: string;
  description: string;
};

export type SeoSettings = {
  /** สวิตช์ใหญ่ — ปิดแล้วทั้งเว็บไม่ให้เก็บ ใช้ตอนเว็บยังไม่พร้อมเปิดจริง */
  enabled: boolean;
  siteUrl: string;
  siteName: string;
  defaultTitle: string;
  defaultDescription: string;
  keywords: string[];
  pages: SeoPage[];
};

export const DEFAULT_SEO: SeoSettings = {
  enabled: true,
  siteUrl: "https://beta.spsccoop.com",
  siteName: "สหกรณ์ออมทรัพย์สาธารณสุขสงขลา จำกัด",
  defaultTitle: "สหกรณ์ออมทรัพย์สาธารณสุขสงขลา จำกัด | เงินฝาก เงินกู้ สวัสดิการสมาชิก",
  defaultDescription:
    "เว็บไซต์ทางการของสหกรณ์ออมทรัพย์สาธารณสุขสงขลา จำกัด ให้บริการเงินรับฝาก เงินให้กู้ สวัสดิการสมาชิก ข่าวประกาศ อัตราดอกเบี้ย และบริการออนไลน์สำหรับสมาชิก",
  keywords: [
    "สหกรณ์ออมทรัพย์สาธารณสุขสงขลา",
    "สหกรณ์ออมทรัพย์",
    "เงินฝากสหกรณ์",
    "เงินกู้สหกรณ์",
    "อัตราดอกเบี้ยสหกรณ์",
    "สวัสดิการสมาชิก",
    "spsccoop",
  ],
  pages: [
    {
      path: "/",
      label: "หน้าแรก",
      indexed: true,
      title: "",
      description: "",
    },
    {
      path: "/about/directory/board",
      label: "คณะกรรมการดำเนินการ",
      indexed: true,
      title: "คณะกรรมการดำเนินการ ชุดที่ 45",
      description:
        "ทำเนียบคณะกรรมการดำเนินการ ชุดที่ 45 ของสหกรณ์ออมทรัพย์สาธารณสุขสงขลา จำกัด",
    },
    {
      path: "/splash",
      label: "หน้าวันสำคัญ",
      indexed: false,
      title: "วันสำคัญ",
      description: "",
    },
  ],
};

export const getSeo = () => getSetting<SeoSettings>("seo", DEFAULT_SEO);

/** หาค่าของหน้านั้น — ไม่เจอถือว่าไม่ให้เก็บ (หน้าใหม่ต้องมาเปิดเองในหลังบ้าน) */
export function findPage(seo: SeoSettings, path: string): SeoPage {
  return (
    seo.pages.find((p) => p.path === path) ?? {
      path,
      label: path,
      indexed: false,
      title: "",
      description: "",
    }
  );
}

/**
 * สร้าง metadata ของหน้าจากค่าที่ตั้งไว้ในหลังบ้าน
 * ใช้ในหน้าเว็บแบบ: export const generateMetadata = () => pageMetadata("/");
 */
export async function pageMetadata(path: string): Promise<Metadata> {
  const seo = await getSeo();
  const page = findPage(seo, path);

  const title = page.title.trim() || seo.defaultTitle;
  const description = page.description.trim() || seo.defaultDescription;
  // สวิตช์ใหญ่ปิด = ไม่ให้เก็บทั้งเว็บ ไม่ว่ารายหน้าจะตั้งไว้ยังไง
  const index = seo.enabled && page.indexed;

  return {
    metadataBase: new URL(seo.siteUrl),
    title,
    description,
    keywords: seo.keywords,
    alternates: { canonical: path },
    robots: { index, follow: index },
    openGraph: {
      type: "website",
      locale: "th_TH",
      url: path,
      siteName: seo.siteName,
      title,
      description,
    },
    twitter: { card: "summary_large_image", title, description },
  };
}
