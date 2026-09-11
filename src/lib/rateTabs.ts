/**
 * ลำดับแท็บบนการ์ดอัตราหน้าแรก — สวัสดิการ · เงินรับฝาก · เงินให้กู้
 * ตั้งได้ที่หลังบ้าน → อัตราดอกเบี้ย เก็บใน Setting["interestRates"].tabOrder
 *
 * แยกไฟล์ไว้ (ไม่อยู่ใน settings.ts) เพราะการ์ดบนหน้าแรกเป็น client component
 * ถ้าไป import จาก settings.ts จะลาก prisma ติดเข้า bundle ฝั่งเบราว์เซอร์ (หลักเดียวกับ officeHours.ts)
 */

export const RATE_TABS = ["welfare", "deposit", "loan"] as const;
export type RateTab = (typeof RATE_TABS)[number];

export const RATE_TAB_LABEL: Record<RateTab, string> = {
  welfare: "สวัสดิการ",
  deposit: "เงินรับฝาก",
  loan: "เงินให้กู้",
};

/**
 * ค่าที่บันทึกไว้อาจเก่าหรือเพี้ยน — เก็บเฉพาะคีย์ที่รู้จักและไม่ซ้ำ แล้วต่อท้ายตัวที่ขาดตามลำดับตั้งต้น
 * ยังไม่เคยตั้ง = สวัสดิการ → เงินรับฝาก → เงินให้กู้ (เจ้าของเว็บสั่ง 11 ก.ย. 2569)
 *
 * ⚠️ ต้องคืนครบทั้ง 3 เสมอ ไม่งั้นแท็บที่หลุดจากรายการจะหายจากหน้าแรกเงียบ ๆ
 */
export function fillRateTabOrder(saved: unknown): RateTab[] {
  const picked = Array.isArray(saved)
    ? saved.filter(
        (key, index): key is RateTab =>
          RATE_TABS.includes(key as RateTab) && saved.indexOf(key) === index,
      )
    : [];
  return [...picked, ...RATE_TABS.filter((key) => !picked.includes(key))];
}
