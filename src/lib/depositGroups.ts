import type { InterestRates } from "@/lib/settings";

/**
 * จัดอัตราดอกเบี้ยเงินฝากเป็นกลุ่มตามประเภท — ใช้ทั้งฝั่งเซิร์ฟเวอร์และเบราว์เซอร์
 *
 * แยกไฟล์ไว้ (ไม่รวมใน component) เพราะเป็นตรรกะล้วน ไม่แตะ React
 * เผื่อวันหน้าอยากเอาไปใช้ที่อื่น เช่นหน้าแรก หรือทำกลุ่มเงินกู้บ้าง
 *
 * ⚠️ **จับกลุ่มจากคำขึ้นต้นของชื่อรายการ** ซึ่งเจ้าหน้าที่พิมพ์เองในหลังบ้าน
 * ตั้งชื่อใหม่ที่ไม่ขึ้นต้นด้วยคำพวกนี้ รายการนั้นจะไปกองอยู่กลุ่ม "อื่น ๆ"
 * — ตั้งใจให้ตกกลุ่มท้ายไว้ ดีกว่าหายไปเฉย ๆ โดยไม่มีใครรู้
 */

export type RateGroup = {
  key: string;
  /** ชื่อบนปุ่มสลับกลุ่ม */
  label: string;
  /** ชุดสีของกลุ่ม — เจ้าของเว็บเลือกเอง 22 ส.ค. 2026 */
  tone: {
    /** สีตัวเลขดอกเบี้ยกับชื่อกลุ่ม */
    text: string;
    /** พื้นหลังอ่อนของการ์ด */
    card: string;
    /** เส้นขอบการ์ด */
    ring: string;
    /** ปุ่มกลุ่มตอนถูกเลือก */
    active: string;
    /** หลอดนับถอยหลัง */
    bar: string;
  };
  rows: { label: string; rate: string }[];
};

/** ออมทรัพย์ = ฟ้า · ฝากประจำ = ม่วง · ทวีสุข = ชมพู */
const DEFS = [
  {
    key: "saving",
    label: "ออมทรัพย์",
    match: "ออมทรัพย์",
    tone: {
      text: "text-sky-700",
      card: "bg-sky-50",
      ring: "ring-sky-200",
      active: "bg-sky-600 text-white shadow",
      bar: "from-sky-500 to-sky-300",
    },
  },
  {
    key: "fixed",
    label: "ฝากประจำ",
    match: "ฝากประจำ",
    tone: {
      text: "text-violet-700",
      card: "bg-violet-50",
      ring: "ring-violet-200",
      active: "bg-violet-600 text-white shadow",
      bar: "from-violet-500 to-violet-300",
    },
  },
  {
    key: "thawisuk",
    label: "ทวีสุข",
    match: "ทวีสุข",
    tone: {
      text: "text-pink-700",
      card: "bg-pink-50",
      ring: "ring-pink-200",
      active: "bg-pink-600 text-white shadow",
      bar: "from-pink-500 to-pink-300",
    },
  },
] as const;

const OTHER = {
  text: "text-gray-700",
  card: "bg-gray-50",
  ring: "ring-gray-200",
  active: "bg-gray-600 text-white shadow",
  bar: "from-gray-500 to-gray-300",
};

export function groupDeposits(rates: InterestRates): RateGroup[] {
  const rows = rates.deposit.map((r) => ({ label: r.label, rate: String(r.rate) }));

  const groups: RateGroup[] = DEFS.map((d) => ({
    key: d.key,
    label: d.label,
    tone: d.tone,
    rows: rows.filter((r) => r.label.startsWith(d.match)),
  })).filter((g) => g.rows.length > 0);

  // รายการที่ชื่อไม่เข้าพวก — เก็บไว้ท้ายสุด อย่าปล่อยให้หาย
  const taken = new Set(groups.flatMap((g) => g.rows.map((r) => r.label)));
  const rest = rows.filter((r) => !taken.has(r.label));
  if (rest.length > 0) {
    groups.push({ key: "other", label: "อื่น ๆ", tone: OTHER, rows: rest });
  }

  return groups;
}
