import { db } from "@/lib/db";

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
};

export type InterestRates = {
  deposit: { label: string; rate: string }[];
  loan: { label: string; rate: string }[];
};

export const DEFAULT_SITE_INFO: SiteInfo = {
  address: "เลขที่ 229 ม.6 ต.น้ำน้อย อ.หาดใหญ่ จ.สงขลา 90110",
  phone: "074-XXXXXX",
  fax: "",
  email: "info@spsccoop.com",
  officeHours: "จันทร์ – ศุกร์ 08:30 – 16:30 น.",
  memberCount: "220,031",
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
  const row = await db.setting.findUnique({ where: { key } });
  return row ? (row.value as T) : fallback;
}

export async function saveSetting(key: string, value: unknown): Promise<void> {
  await db.setting.upsert({
    where: { key },
    create: { key, value: value as never },
    update: { value: value as never },
  });
}

export const getSiteInfo = () => getSetting<SiteInfo>("siteInfo", DEFAULT_SITE_INFO);
export const getRates = () => getSetting<InterestRates>("interestRates", DEFAULT_RATES);
