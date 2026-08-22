import type { InterestRates } from "@/lib/settings";

/**
 * จัดอัตราดอกเบี้ยเป็นกลุ่มตามประเภท — ใช้ได้ทั้งเงินฝากและเงินกู้
 *
 * แยกไฟล์ไว้ (ไม่รวมใน component) เพราะเป็นตรรกะล้วน ไม่แตะ React
 * ฝั่งเซิร์ฟเวอร์คิดกลุ่มให้เสร็จแล้วค่อยส่งเข้า `RateSections`
 *
 * ⚠️ **จับกลุ่มจากคำที่อยู่ในชื่อรายการ** ซึ่งเจ้าหน้าที่พิมพ์เองในหลังบ้าน
 * ตั้งชื่อใหม่ที่ไม่มีคำพวกนี้เลย รายการนั้นจะไปกองอยู่กลุ่ม "อื่น ๆ"
 * — ตั้งใจให้ตกกลุ่มท้ายไว้ **ดีกว่าหายไปเฉย ๆ โดยไม่มีใครรู้**
 *
 * ⚠️ **ลำดับใน DEFS สำคัญ — ใครตรงก่อนได้ไปก่อน** เช่น
 * "เงินกู้สามัญหมุนเวียน ผ่านอิเล็กทรอนิกส์" เข้าได้ทั้งกลุ่มทั่วไปและกลุ่มสามัญ
 * วางกลุ่มทั่วไปไว้บนสุดมันจึงไปอยู่กลุ่มทั่วไป ตามที่เจ้าของเว็บต้องการ
 */

export type Tone = {
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

export type RateGroup = {
  key: string;
  /** ชื่อบนปุ่มสลับกลุ่ม */
  label: string;
  tone: Tone;
  rows: { label: string; rate: string }[];
};

type Def = { key: string; label: string; match: readonly string[]; tone: Tone };

/*
 * ⚠️ **เขียนชื่อคลาสเต็ม ๆ เท่านั้น ห้ามประกอบด้วย template string**
 * Tailwind อ่านคลาสจากซอร์สแบบข้อความตรง ๆ — `text-${c}-700` มันมองไม่เห็น
 * จะไม่สร้าง CSS ให้ แล้วกลุ่มนั้นจืดไปทั้งกลุ่มโดยไม่มีอะไรฟ้อง
 * (เคยเขียนแบบนั้นแล้วต้องแก้ 22 ส.ค. 2026)
 *
 * แก้สีแล้วต้องเช็คในไฟล์ CSS ที่ build ออกมาจริงว่ามีครบทุกคลาส
 */
const TONES = {
  sky: {
    text: "text-sky-700", card: "bg-sky-50", ring: "ring-sky-200",
    active: "bg-sky-600 text-white shadow", bar: "from-sky-500 to-sky-300",
  },
  violet: {
    text: "text-violet-700", card: "bg-violet-50", ring: "ring-violet-200",
    active: "bg-violet-600 text-white shadow", bar: "from-violet-500 to-violet-300",
  },
  pink: {
    text: "text-pink-700", card: "bg-pink-50", ring: "ring-pink-200",
    active: "bg-pink-600 text-white shadow", bar: "from-pink-500 to-pink-300",
  },
  rose: {
    text: "text-rose-700", card: "bg-rose-50", ring: "ring-rose-200",
    active: "bg-rose-600 text-white shadow", bar: "from-rose-500 to-rose-300",
  },
  orange: {
    text: "text-orange-700", card: "bg-orange-50", ring: "ring-orange-200",
    active: "bg-orange-600 text-white shadow", bar: "from-orange-500 to-orange-300",
  },
  emerald: {
    text: "text-emerald-700", card: "bg-emerald-50", ring: "ring-emerald-200",
    active: "bg-emerald-600 text-white shadow", bar: "from-emerald-500 to-emerald-300",
  },
  gray: {
    text: "text-gray-700", card: "bg-gray-50", ring: "ring-gray-200",
    active: "bg-gray-600 text-white shadow", bar: "from-gray-500 to-gray-300",
  },
} as const satisfies Record<string, Tone>;

/** เงินฝาก — โทนเย็น (เจ้าของเว็บเลือกเอง 22 ส.ค. 2026) */
const DEPOSIT_DEFS: readonly Def[] = [
  { key: "saving", label: "ออมทรัพย์", match: ["ออมทรัพย์"], tone: TONES.sky },
  { key: "fixed", label: "ฝากประจำ", match: ["ฝากประจำ"], tone: TONES.violet },
  { key: "thawisuk", label: "ทวีสุข", match: ["ทวีสุข"], tone: TONES.pink },
];

/**
 * เงินกู้ — โทนอุ่นทั้งชุด แยกจากเงินฝากที่เป็นโทนเย็น สมาชิกจะได้ไม่สับสนว่าดูตารางไหนอยู่
 * กลุ่ม "ทั่วไป" คือเงินกู้ที่กดเองได้ผ่าน ATM หรือแอป — ต้องอยู่บนสุดเพราะชื่อรายการ
 * มักมีคำว่า "สามัญ" ปนอยู่ด้วย ถ้าไม่มาก่อนจะถูกกลุ่มสามัญดูดไปหมด
 */
const LOAN_DEFS: readonly Def[] = [
  {
    key: "general",
    label: "ทั่วไป (ATM / แอป)",
    match: ["ฉุกเฉิน", "ATM", "แอป", "แอพ", "อิเล็กทรอนิกส์"],
    tone: TONES.rose,
  },
  { key: "normal", label: "เงินกู้สามัญ", match: ["สามัญ"], tone: TONES.orange },
  { key: "special", label: "เงินกู้พิเศษ", match: ["พิเศษ"], tone: TONES.emerald },
];

const OTHER = TONES.gray;

/** จับกลุ่มแบบใครตรงก่อนได้ก่อน — รายการหนึ่งอยู่ได้กลุ่มเดียว ไม่นับซ้ำ */
function build(list: { label: string; rate: string | number }[], defs: readonly Def[]): RateGroup[] {
  const groups: RateGroup[] = defs.map((d) => ({
    key: d.key,
    label: d.label,
    tone: d.tone,
    rows: [],
  }));
  const other: RateGroup = { key: "other", label: "อื่น ๆ", tone: OTHER, rows: [] };

  for (const item of list) {
    const row = { label: item.label, rate: String(item.rate) };
    const hit = defs.findIndex((d) => d.match.some((word) => item.label.includes(word)));
    if (hit === -1) other.rows.push(row);
    else groups[hit].rows.push(row);
  }

  const out = groups.filter((g) => g.rows.length > 0);
  if (other.rows.length > 0) out.push(other);
  return out;
}

export const groupDeposits = (rates: InterestRates): RateGroup[] => build(rates.deposit, DEPOSIT_DEFS);
export const groupLoans = (rates: InterestRates): RateGroup[] => build(rates.loan, LOAN_DEFS);
