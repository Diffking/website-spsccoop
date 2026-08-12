import { db } from "@/lib/db";
import { splashContent as DEFAULT_SPLASH, type SplashContent } from "@/content/splash";

/**
 * ค่าของหน้าแรกที่ไม่ใช่รายการ — เก็บใน Setting เป็น key -> JSON
 * ถ้ายังไม่เคยบันทึก จะใช้ค่าตั้งต้นด้านล่าง (ตรงกับที่แสดงบนเว็บตอนนี้)
 */

export type SiteInfo = {
  address: string;
  phone: string;
  fax: string;
  email: string;
  officeHours: string;
  memberCount: string;
  /** ลิงก์เพจเฟซบุ๊ก — เว้นว่าง = ไม่แสดงปุ่มที่ท้ายเว็บ */
  facebook?: string;
};

export type InterestRates = {
  deposit: { label: string; rate: string }[];
  loan: { label: string; rate: string }[];
};

/** ข่าววิ่งใต้แบนเนอร์ — ปกติดึงประกาศล่าสุดมาเองไม่ต้องมาพิมพ์ซ้ำ */
export type TickerSettings = {
  /** ดึงประกาศ/จดหมายข่าว/รายงานผลดำเนินงาน ล่าสุดมาวิ่งอัตโนมัติ */
  auto: boolean;
  /** ดึงมากี่รายการ */
  limit: number;
  /** คำบนป้าย เช่น New · ใหม่ · ด่วน — เว้นว่าง = ไม่ติดป้าย */
  badgeText: string;
  /** ติดป้ายให้กี่รายการแรก · 0 = ไม่ติดเลย */
  badgeCount: number;
  /** ให้ป้ายกระพริบ */
  badgeBlink: boolean;
};

// ค่าตั้งต้น = ค่าที่ใช้จริงตอนนี้ เผื่อฐานยังไม่มีแถวนี้หรือฐานล่ม จะได้แสดงของถูก
export const DEFAULT_SITE_INFO: SiteInfo = {
  address: "229 หมู่ 6 ถนน ลพบุรีราเมศวร์ ตำบลน้ำน้อย อำเภอหาดใหญ่ สงขลา 90110",
  phone: "074-313-229,074-300-662-3",
  fax: "074-311-759",
  email: "spsccoop229@gmail.com",
  officeHours: "จันทร์ – ศุกร์ 08:30 – 16:30 น.",
  memberCount: "220,031",
  facebook: "",
};

export const DEFAULT_RATES: InterestRates = {
  deposit: [
    { label: "ออมทรัพย์", rate: "1.5" },
    { label: "ออมทรัพย์พิเศษ", rate: "1.70" },
    { label: "เกษียณมั่นคง", rate: "3.50" },
  ],
  loan: [
    { label: "เงินกู้สามัญ", rate: "5.75" },
    { label: "เงินกู้ฉุกเฉิน", rate: "5.75" },
    { label: "เงินกู้พิเศษ", rate: "5.50" },
  ],
};

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  // หน้าบ้านทุกหน้าเรียกผ่านนี้ — ถ้าฐานล่มต้องได้ค่าตั้งต้นไปแสดงแทนที่จะพังทั้งหน้า
  // (รันเครื่องเดียว ฐานล่ม = เว็บล่มไปด้วยไม่ได้)
  try {
    const row = await db.setting.findUnique({ where: { key } });
    return row ? (row.value as T) : fallback;
  } catch (error) {
    console.error(`อ่าน Setting "${key}" ไม่ได้ ใช้ค่าตั้งต้นแทน:`, error);
    return fallback;
  }
}

export async function saveSetting(key: string, value: unknown): Promise<void> {
  await db.setting.upsert({
    where: { key },
    create: { key, value: value as never },
    update: { value: value as never },
  });
}

export const DEFAULT_TICKER: TickerSettings = {
  auto: true,
  limit: 10,
  badgeText: "New",
  badgeCount: 3,
  badgeBlink: true,
};

export const getSiteInfo = () => getSetting<SiteInfo>("siteInfo", DEFAULT_SITE_INFO);
export const getRates = () => getSetting<InterestRates>("interestRates", DEFAULT_RATES);

/** ค่าที่บันทึกไว้อาจเก่ากว่าโครงปัจจุบัน เติมค่าที่ขาดจากค่าตั้งต้นให้เสมอ */
export async function getTickerSettings(): Promise<TickerSettings> {
  const saved = await getSetting<Partial<TickerSettings>>("ticker", DEFAULT_TICKER);
  return { ...DEFAULT_TICKER, ...saved };
}

/**
 * หน้า splash วันสำคัญ — ค่าตั้งต้นคือ src/content/splash.json ที่ติดมากับโค้ด
 * พอบันทึกจากหลังบ้านครั้งแรกจะมีแถวในฐานแล้วใช้ของในฐานแทนตลอด
 */
export const getSplash = () => getSetting<SplashContent>("splash", DEFAULT_SPLASH);
export type { SplashContent };
