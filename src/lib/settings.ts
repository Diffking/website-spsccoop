import { db } from "@/lib/db";
import { DEFAULT_COMMITTEE_PHOTO_SCALE } from "@/lib/committee";
import type { Kind } from "@/lib/announcementKinds";
import {
  fillHomeSections,
  fillHomeTones,
  fillHomeOrder,
  DEFAULT_HOME_SECTIONS,
  DEFAULT_HOME_TONES,
  DEFAULT_HOME_ORDER,
  type HomeSections,
  type HomeTones,
  type HomeOrder,
} from "@/lib/homeSections";
import {
  DEFAULT_OFFICE_HOURS,
  fillOfficeHours,
  type OfficeHours,
} from "@/lib/officeHours";
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
  /** เลิกใช้แล้ว — เวลาทำการย้ายไปตั้งเป็นวัน/เวลาจริงที่ Setting["officeHours"] (ดู src/lib/officeHours.ts) */
  officeHours: string;
  memberCount: string;
  /** ลิงก์เพจเฟซบุ๊ก — เว้นว่าง = ไม่แสดงปุ่มที่ท้ายเว็บ */
  facebook?: string;
};

export type InterestRates = {
  deposit: { label: string; rate: string }[];
  loan: { label: string; rate: string }[];
  /** การ์ดหน้าแรกแสดงทีละกี่รายการ — เกินกว่านี้ตัดเป็นหน้าถัดไป */
  perPage?: number;
  /** วินาทีต่อหนึ่งหน้าก่อนเลื่อนเอง · 0 = ไม่เลื่อนเอง */
  autoSeconds?: number;
};

/** ข่าววิ่งใต้แบนเนอร์ — ปกติดึงประกาศล่าสุดมาเองไม่ต้องมาพิมพ์ซ้ำ */
export type TickerSettings = {
  /** ดึงประกาศ/จดหมายข่าว/รายงานผลดำเนินงาน ล่าสุดมาวิ่งอัตโนมัติ */
  auto: boolean;
  /**
   * ดึงมากี่เรื่อง "ต่อหมวด" — ประกาศ / จดหมายข่าว / รายงานกิจการ นับแยกกัน
   * (เดิมดึงรวมกันทั้งหมด หมวดที่ออกไม่บ่อยจึงถูกประกาศเบียดตกจนไม่ได้วิ่งเลย)
   */
  perKind: number;
  /** คำบนป้าย เช่น New · ใหม่ · ด่วน — เว้นว่าง = ไม่ติดป้าย */
  badgeText: string;
  /**
   * ติดป้ายให้กี่รายการแรก "ของแต่ละหมวด" · 0 = หมวดนั้นไม่ติดป้าย
   * แยกตามหมวดเพราะประกาศออกถี่กว่าจดหมายข่าว/รายงานกิจการมาก
   * ถ้านับรวมกันทั้งหมด ป้ายจะไปกองอยู่ที่ประกาศหมดจนอีกสองหมวดไม่เคยได้ป้ายเลย
   */
  badgeCounts: Record<Kind, number>;
  /** ให้ป้ายกระพริบ */
  badgeBlink: boolean;
  /**
   * ความเร็วข่าววิ่ง — วินาทีต่อหนึ่งรายการ (ยิ่งมากยิ่งช้า)
   * คิดต่อรายการ ไม่ใช่ต่อรอบ ไม่งั้นวันไหนมีประกาศเยอะข้อความจะวิ่งเร็วขึ้นเองจนอ่านไม่ทัน
   */
  secondsPerItem: number;
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
  perPage: 5,
  autoSeconds: 5,
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
  perKind: 5,
  badgeText: "New",
  badgeCounts: { ANNOUNCEMENT: 3, NEWSLETTER: 1, REPORT: 1 },
  badgeBlink: true,
  secondsPerItem: 9,
};

/** ชุดคณะกรรมการดำเนินการที่กำลังทำหน้าที่อยู่ — ใช้ทั้งหัวการ์ดหน้าแรกและชื่อโฟลเดอร์รูป */
export const DEFAULT_COMMITTEE_SET = 45;
export const getCommitteeSet = () => getSetting<number>("committeeSet", DEFAULT_COMMITTEE_SET);

/** ส่วนไหนของหน้าแรกเปิดอยู่บ้าง — เติมคีย์ที่ขาดจากค่าตั้งต้นเสมอ */
export async function getHomeSections(): Promise<HomeSections> {
  const saved = await getSetting<Partial<HomeSections>>("homeSections", DEFAULT_HOME_SECTIONS);
  return fillHomeSections(saved);
}

/** ลำดับส่วนต่าง ๆ บนหน้าแรก — ค่าที่บันทึกอาจเก่ากว่าลิสต์ปัจจุบัน fill ให้ครบเสมอ */
export async function getHomeOrder(): Promise<HomeOrder> {
  const saved = await getSetting<unknown>("homeOrder", DEFAULT_HOME_ORDER);
  return fillHomeOrder(saved);
}

/** วันและเวลาทำการ — เติมค่าตั้งต้นให้ครบเสมอ เผื่อค่าที่บันทึกไว้เก่ากว่ารูปแบบปัจจุบัน */
export async function getOfficeHours(): Promise<OfficeHours> {
  const saved = await getSetting<Partial<OfficeHours>>("officeHours", DEFAULT_OFFICE_HOURS);
  return fillOfficeHours(saved);
}

/** สีพื้นหลังของแต่ละส่วนบนหน้าแรก */
export async function getHomeTones(): Promise<HomeTones> {
  const saved = await getSetting<Partial<HomeTones>>("homeTones", DEFAULT_HOME_TONES);
  return fillHomeTones(saved);
}

/** ขนาดรูปกรรมการบนการ์ดหน้าแรก (%) — ค่าคงที่อยู่ที่ src/lib/committee.ts เพราะฝั่ง client ก็ใช้ */
export const getCommitteePhotoScale = () =>
  getSetting<number>("committeePhotoScale", DEFAULT_COMMITTEE_PHOTO_SCALE);

export const getSiteInfo = () => getSetting<SiteInfo>("siteInfo", DEFAULT_SITE_INFO);
export const getRates = () => getSetting<InterestRates>("interestRates", DEFAULT_RATES);

/** ค่าที่บันทึกไว้อาจเก่ากว่าโครงปัจจุบัน เติมค่าที่ขาดจากค่าตั้งต้นให้เสมอ */
export async function getTickerSettings(): Promise<TickerSettings> {
  const saved = await getSetting<Partial<TickerSettings>>("ticker", DEFAULT_TICKER);
  return {
    ...DEFAULT_TICKER,
    ...saved,
    // merge ตื้น ๆ ไม่พอ — ค่าที่บันทึกไว้ก่อนแยกป้ายตามหมวดยังไม่มีคีย์นี้เลย
    badgeCounts: { ...DEFAULT_TICKER.badgeCounts, ...(saved?.badgeCounts ?? {}) },
  };
}

/**
 * หน้า splash วันสำคัญ — ค่าตั้งต้นคือ src/content/splash.json ที่ติดมากับโค้ด
 * พอบันทึกจากหลังบ้านครั้งแรกจะมีแถวในฐานแล้วใช้ของในฐานแทนตลอด
 */
export const getSplash = () => getSetting<SplashContent>("splash", DEFAULT_SPLASH);
export type { SplashContent };
