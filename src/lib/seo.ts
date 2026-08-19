import { headers } from "next/headers";
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

/**
 * ให้เครื่องมือค้นหาทำอะไรกับเว็บได้บ้าง
 *
 * ต้องแยก "เข้าอ่าน" กับ "เอาไปแสดงในผลค้นหา" ออกจากกัน คนมักคิดว่าเป็นเรื่องเดียวกัน
 * แต่ถ้าห้ามเข้าอ่าน กูเกิลจะอ่านป้าย "ห้ามเก็บ" ในหน้านั้นไม่เจอ แล้วยังโชว์ที่อยู่หน้านั้น
 * ค้างไว้ในผลค้นหาต่อไปอีกนาน — กลับตาลปัตรกับที่ตั้งใจ
 */
export type SeoScope =
  /** ทุกหน้า (ยกเว้นหลังบ้านกับหน้าที่ปิดไว้รายหน้า) */
  | "all"
  /**
   * ผลค้นหาโชว์เฉพาะหน้าแรก — หน้าอื่นยังให้เข้าอ่านได้ แต่ติดป้ายห้ามเก็บไว้
   * เป็นวิธีที่ทำให้หน้าอื่นหลุดออกจากผลค้นหาได้จริง
   */
  | "home"
  /**
   * ห้ามเข้าอ่านหน้าอื่นเลย (robots.txt) — เข้มที่สุดในแง่ปริมาณการเข้าอ่าน
   * แต่หน้าที่กูเกิลเคยเก็บไว้แล้วอาจค้างอยู่ในผลค้นหาแบบไม่มีคำอธิบายอีกพักใหญ่
   */
  | "home-strict";

export type SeoSettings = {
  /** สวิตช์ใหญ่ — ปิดแล้วทั้งเว็บไม่ให้เก็บ ใช้ตอนเว็บยังไม่พร้อมเปิดจริง */
  enabled: boolean;
  /** ไม่ระบุ = "all" (พฤติกรรมเดิมก่อนมีตัวเลือกนี้) */
  scope?: SeoScope;
  siteUrl: string;
  siteName: string;
  defaultTitle: string;
  defaultDescription: string;
  keywords: string[];
  pages: SeoPage[];
};

export const DEFAULT_SEO: SeoSettings = {
  enabled: true,
  scope: "all",
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


/**
 * โดเมนที่คนกำลังเปิดอยู่ ตรงกับโดเมนหลักที่ตั้งไว้ไหม
 *
 * เว็บเดียวกันเปิดได้สองโดเมน (www.spsccoop.com สำหรับสมาชิก · coopsmile.org เป็นสำรอง
 * และเป็นทางเข้าหลังบ้าน) ถ้าปล่อยให้กูเกิลเก็บทั้งสองโดเมน เนื้อหาจะซ้ำกันทั้งเว็บ
 * กูเกิลต้องมานั่งเดาว่าอันไหนตัวจริง แล้วอันดับของทั้งคู่แย่ลงทั้งคู่
 *
 * ตัวมิเรอร์บนโฮสต์ดึงหน้าไปจาก coopsmile.org แต่เอาไปเสิร์ฟในนาม www.spsccoop.com
 * จึงต้องส่งหัว x-public-host มาบอกว่า "ที่จริงคนกำลังเปิดโดเมนนี้อยู่นะ"
 * ไม่งั้นหน้าที่ถูกเก็บสำเนาไปจะติดป้ายห้ามเก็บไปด้วยทั้งเว็บ
 */
export async function onCanonicalHost(seo: SeoSettings): Promise<boolean> {
  try {
    const head = await headers();
    const raw = head.get("x-public-host") ?? head.get("host") ?? "";
    const host = raw.split(":")[0].trim().toLowerCase();
    if (!host) return true;

    // ตอนพัฒนาในเครื่องไม่ต้องมากั้น
    if (host === "localhost" || host === "127.0.0.1") return true;

    const canonical = new URL(seo.siteUrl).hostname.toLowerCase();
    return host === canonical || host === canonical.replace(/^www\./, "");
  } catch {
    return true;
  }
}

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
  /*
   * สวิตช์ใหญ่ปิด = ไม่ให้เก็บทั้งเว็บ ไม่ว่ารายหน้าจะตั้งไว้ยังไง
   * โหมด "เฉพาะหน้าแรก" = หน้าอื่นติดป้ายห้ามเก็บไว้ในตัวหน้าด้วย ไม่ได้กันแค่ใน robots.txt
   * (บอทบางตัวไม่อ่าน robots.txt · และหน้าที่เคยถูกเก็บไว้ก่อนหน้านี้จะได้หลุดออกจากผลค้นหา)
   */
  const scope = seo.scope ?? "all";
  const homeOnly = (scope === "home" || scope === "home-strict") && path !== "/";
  // โดเมนสำรองห้ามให้เก็บทุกหน้า ไม่งั้นเนื้อหาซ้ำกับโดเมนหลักทั้งเว็บ
  const index = seo.enabled && page.indexed && !homeOnly && (await onCanonicalHost(seo));

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
