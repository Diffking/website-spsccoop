/**
 * โปรแกรมคำนวณดอกเบี้ย — ตรรกะล้วน ไม่แตะ React
 *
 * สูตรตามใบประชาสัมพันธ์ของสหกรณ์ (อัตราดอกเบี้ยเป็น "ร้อยละต่อปี"):
 *
 *     ดอกเบี้ยที่ต้องจ่าย = เงินต้นคงค้าง × อัตราดอกเบี้ย/100 × จำนวนวันที่คิดดอกเบี้ย/365
 *
 * ตัวอย่างในใบประชาสัมพันธ์: เงินกู้ 100,000 บาท ร้อยละ 10 ต่อปี ชำระ 30 วัน
 * → 100,000 × 10/100 × 30/365 = 821.92 บาท (ตรงกับที่โปรแกรมนี้คำนวณได้)
 *
 * ⚠️ **แยกไฟล์ไว้ต่างหากจากหน้าจอ** หลักเดียวกับ src/lib/financialCheckup.ts
 * — ตัวเลขในนี้คือของที่สมาชิกเอาไปเทียบกับใบเสร็จจริง ต้องทดสอบได้โดยไม่ต้องเปิดเบราว์เซอร์
 *
 * ⚠️ **ไม่เก็บอะไรลงฐานเลย** ทุกค่าอยู่ในหน้าจอล้วน ๆ (หลักเดียวกับโปรแกรมตรวจสุขภาพการเงิน)
 */

/** จำนวนวันในหนึ่งปีที่ใช้เป็นตัวหาร — ปีปกติ 365 · ปีอธิกสุรทิน 366 */
export const DAY_BASES = [365, 366] as const;
export type DayBasis = (typeof DAY_BASES)[number];

/**
 * เพดานดอกเบี้ยเงินกู้ยืมของประชาชนทั่วไป — ร้อยละ 15 ต่อปี (= ร้อยละ 1.25 ต่อเดือน)
 * เกินกว่านี้เป็นการเรียกดอกเบี้ยเกินอัตราที่กฎหมายกำหนด (ตามใบประชาสัมพันธ์ของสหกรณ์)
 *
 * ⚠️ ตัวเลขนี้อ้างอิงกฎหมาย ไม่ใช่นโยบายของสหกรณ์ — **อย่าแก้เอง**
 */
export const LEGAL_MAX_YEARLY = 15;
export const LEGAL_MAX_MONTHLY = 1.25;

export type InterestInput = {
  /** เงินต้นคงค้าง (บาท) */
  principal: number;
  /** อัตราดอกเบี้ย ร้อยละต่อปี */
  rate: number;
  /** จำนวนวันที่คิดดอกเบี้ย */
  days: number;
  /** ตัวหาร 365 หรือ 366 */
  basis: DayBasis;
};

export type InterestResult = {
  /** ดอกเบี้ยทั้งช่วง (ยังไม่ปัด — ปัดตอนแสดงผล) */
  interest: number;
  /** ดอกเบี้ยวันละเท่าไร */
  perDay: number;
  /** เงินต้น + ดอกเบี้ย */
  total: number;
  /** อัตราที่กรอกเกินเพดานตามกฎหมายหรือไม่ */
  overLegal: boolean;
  /** กรอกครบพอที่จะคิดได้จริงหรือยัง (มีทั้งเงินต้น อัตรา และจำนวนวัน) */
  ready: boolean;
};

/** ปัดเป็นสตางค์ (ทศนิยม 2 ตำแหน่ง) แบบครึ่งขึ้น */
export const satang = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function calcInterest({ principal, rate, days, basis }: InterestInput): InterestResult {
  const perDay = (principal * (rate / 100)) / basis;
  const interest = perDay * days;

  return {
    perDay,
    interest,
    total: principal + interest,
    overLegal: rate > LEGAL_MAX_YEARLY,
    ready: principal > 0 && rate > 0 && days > 0,
  };
}

/* ------------------------------------------------------------------ *
 * ตัวเลขเข้า–ออก
 * ------------------------------------------------------------------ */

/** เลขไทย ๐-๙ → เลขอารบิก · สมาชิกบางท่านตั้งแป้นพิมพ์ไทยไว้แล้วพิมพ์เลขไทยติดมา */
const THAI_DIGITS = "๐๑๒๓๔๕๖๗๘๙";

/**
 * อ่านตัวเลขจากสิ่งที่ผู้ใช้พิมพ์ — ยอมให้มีจุลภาค ช่องว่าง และเลขไทย
 *
 * ⚠️ **ติดลบไม่ได้** เงินต้น อัตรา และจำนวนวัน ไม่มีทางติดลบ
 * ถ้าปล่อยผ่านจะได้ดอกเบี้ยติดลบซึ่งอ่านแล้วเข้าใจผิดว่าสหกรณ์จ่ายคืนให้
 */
export function readNumber(text: string): number {
  const arabic = String(text ?? "").replace(/[๐-๙]/g, (d) => String(THAI_DIGITS.indexOf(d)));
  const clean = arabic.replace(/[,\s]/g, "");
  const n = Number.parseFloat(clean);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** จำนวนเต็มพร้อมจุลภาค เช่น 100,000 */
export const plain = (n: number) => Math.round(n).toLocaleString("th-TH");

/** จำนวนเงินทศนิยม 2 ตำแหน่งเสมอ เช่น 821.92 — ตัวเลขบนใบเสร็จมีสตางค์ทุกใบ */
export const money = (n: number) =>
  satang(n).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * อัตราดอกเบี้ยที่เจ้าหน้าที่พิมพ์ไว้ในหลังบ้านเป็นข้อความ (เช่น "5.75" · "5.75%" · "2.00 - 3.00")
 * ดึงเอาเลขตัวแรกมาใช้ — อ่านไม่ออกคืน 0 แล้วฝั่งเรียกจะไม่เอามาทำปุ่มลัด
 */
export function readRateText(text: string): number {
  const found = String(text ?? "").match(/\d+(\.\d+)?/);
  return found ? Number.parseFloat(found[0]) : 0;
}

/* ------------------------------------------------------------------ *
 * นับวันจากปฏิทิน
 * ------------------------------------------------------------------ */

/** ปีอธิกสุรทิน (ปีที่เดือนกุมภาพันธ์มี 29 วัน) */
export const isLeapYear = (year: number) =>
  (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

/**
 * จำนวนวันจากวันเริ่มถึงวันชำระ — รับ "YYYY-MM-DD" จากช่องเลือกวันที่ของเบราว์เซอร์
 *
 * คืน null เมื่อกรอกไม่ครบหรือวันชำระอยู่ก่อนวันเริ่ม (ฝั่งหน้าจอจะได้บอกให้แก้)
 *
 * ⚠️ **คิดด้วย UTC ตั้งใจ** — `new Date("2026-08-27")` เบราว์เซอร์อ่านเป็นเที่ยงคืน UTC อยู่แล้ว
 * ถ้าเอามาลบกันแบบเวลาท้องถิ่นจะเจอวันที่คร่อมช่วงเปลี่ยนเวลาแล้วขาด/เกินไปหนึ่งวัน
 */
export function daysBetween(from: string, to: string): number | null {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;

  const days = Math.round((end - start) / 86_400_000);
  return days >= 0 ? days : null;
}

/**
 * ช่วงวันที่เลือกไว้คร่อมปีอธิกสุรทินหรือไม่ — เอาไว้เตือนว่าจะใช้ตัวหาร 366 ก็ได้
 * (ใบประชาสัมพันธ์เขียนไว้ว่า "บางกิจการอาจคิด 366 วัน ตามจำนวนวันจริงของปีนั้น ๆ")
 */
export function touchesLeapYear(from: string, to: string): boolean {
  const a = Number.parseInt(from.slice(0, 4), 10);
  const b = Number.parseInt(to.slice(0, 4), 10);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;

  for (let year = Math.min(a, b); year <= Math.max(a, b); year += 1) {
    if (isLeapYear(year)) return true;
  }
  return false;
}

/** วันนี้ในรูปแบบ YYYY-MM-DD ตามเวลาไทย — ใช้เป็นค่าตั้งต้นของช่องวันที่ */
export function todayISO(now: Date = new Date()): string {
  // +7 ชม. ก่อนตัดวันที่ ไม่งั้นช่วงหลังห้าโมงเย็นจะได้วันที่ของเมื่อวาน (เรื่องเดียวกับ slideQueue)
  return new Date(now.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);
}

/** วันที่แบบไทยไว้แสดงผล เช่น 27 ส.ค. 2569 */
export function thaiDate(iso: string): string {
  const at = Date.parse(`${iso}T00:00:00Z`);
  if (!Number.isFinite(at)) return "";
  const d = new Date(at);
  const months = [
    "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
    "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
  ];
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear() + 543}`;
}

/* ------------------------------------------------------------------ *
 * ปุ่มลัด — เลขกลม ๆ ที่กดทีเดียวจบ ไม่ต้องพิมพ์
 * ------------------------------------------------------------------ */

/** เงินต้นที่คนถามบ่อย */
export const AMOUNT_CHIPS = [10_000, 50_000, 100_000, 300_000, 500_000, 1_000_000];

/** ช่วงเวลาที่คนถามบ่อย — เขียนกำกับเป็นเดือน/ปีให้ด้วย จะได้ไม่ต้องคูณเอง */
export const DAY_CHIPS: { days: number; label: string }[] = [
  { days: 7, label: "7 วัน" },
  { days: 15, label: "15 วัน" },
  { days: 30, label: "1 เดือน" },
  { days: 90, label: "3 เดือน" },
  { days: 180, label: "6 เดือน" },
  { days: 365, label: "1 ปี" },
];

/** แถวของตาราง "ถ้าปล่อยไว้นานขึ้น ดอกเบี้ยเป็นเท่าไร" */
export const COMPARE_DAYS = [1, 7, 30, 90, 180, 365];

/** ค่าตั้งต้นของหน้า — ตรงกับตัวอย่างในใบประชาสัมพันธ์ ยกเว้นอัตราที่ดึงของจริงมาแทนถ้ามี */
export const SAMPLE_PRINCIPAL = 100_000;
export const SAMPLE_RATE = 10;
export const SAMPLE_DAYS = 30;

/* ------------------------------------------------------------------ *
 * ปุ่มลัดอัตราดอกเบี้ย — เจ้าหน้าที่เลือกได้ว่าให้ขึ้นรายการไหนบ้าง
 * ------------------------------------------------------------------ */

/** หนึ่งแถวของตารางอัตราดอกเบี้ยที่เจ้าหน้าที่ตั้งไว้ที่ หลังบ้าน → อัตราดอกเบี้ย */
export type RateRow = { label: string; rate: string };

/**
 * โปรแกรมนี้คิดได้ทั้งสองฝั่ง — **เงินกู้ที่เราต้องจ่าย** และ **เงินรับฝากที่เราจะได้รับ**
 * สูตรเดียวกันเป๊ะ ต่างกันแค่ถ้อยคำบนหน้าจอ ตารางอัตราที่ดึงมา และคำเตือนท้ายผล
 * (เจ้าของเว็บสั่งเพิ่มฝั่งเงินรับฝาก 28 ส.ค. 2026)
 */
export const RATE_KINDS = ["loan", "deposit"] as const;
export type RateKind = (typeof RATE_KINDS)[number];

/**
 * อ่านรายชื่ออัตราที่ถูกติ๊ก "ไม่ต้องขึ้น" ในโปรแกรมนี้
 * (Setting["interestRatesHidden"] ของเงินกู้ · Setting["interestDepositHidden"] ของเงินรับฝาก)
 *
 * ⚠️ **เก็บเป็นรายการที่ "ซ่อน" ไม่ใช่รายการที่ "โชว์" ตั้งใจ** — วันที่เจ้าหน้าที่เพิ่ม
 * ประเภทใหม่ที่หน้าอัตราดอกเบี้ย มันจะขึ้นในโปรแกรมนี้เองทันที ไม่ต้องมาติ๊กซ้ำ
 * ถ้าเก็บกลับกัน ประเภทใหม่จะหายเงียบ ๆ โดยไม่มีอะไรฟ้อง
 *
 * ⚠️ **ผูกด้วยชื่อรายการ ไม่ใช่ลำดับ** เพราะเจ้าหน้าที่แทรก/สลับแถวที่หน้าอัตราดอกเบี้ยได้
 * ถ้าผูกด้วยลำดับ พอแทรกแถวเดียวก็ซ่อนผิดรายการทั้งตาราง
 * (แลกกับว่าเปลี่ยนชื่อรายการเมื่อไหร่ การซ่อนจะหลุด แล้วรายการนั้นกลับมาโชว์ — หลักเดียว
 * กับสิทธิ์ `page:<หมวด>` ใน permissions.ts ที่หลุดเมื่อเปลี่ยนชื่อหมวด)
 */
export function readHiddenRates(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const clean = raw.map((item) => String(item ?? "").trim()).filter(Boolean);
  return Array.from(new Set(clean));
}

/** เหลือเฉพาะอัตราที่ให้ขึ้นเป็นปุ่มลัด — ไม่ได้ซ่อนอะไรไว้ = ขึ้นทั้งหมด */
export function visibleRates(rows: RateRow[], hidden: string[]): RateRow[] {
  if (hidden.length === 0) return rows;
  const off = new Set(hidden);
  return rows.filter((row) => !off.has(row.label.trim()));
}
