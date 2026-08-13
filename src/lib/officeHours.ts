/**
 * วันและเวลาทำการของสหกรณ์ — ใช้ทั้งป้าย "เปิดทำการ/ปิดทำการ" บนหัวเว็บ และข้อความท้ายเว็บ
 *
 * แยกไว้ไฟล์นี้ (ไม่รวมใน settings.ts) เพราะหัวเว็บเป็น client component
 * ถ้าไปวางรวมกับ settings.ts จะลาก prisma ติดเข้า bundle ฝั่งเบราว์เซอร์
 */

export type OfficeHours = {
  /** วันที่เปิดทำการ 0=อาทิตย์ … 6=เสาร์ */
  days: number[];
  /** "HH:MM" 24 ชั่วโมง */
  open: string;
  close: string;
};

export const DEFAULT_OFFICE_HOURS: OfficeHours = {
  days: [1, 2, 3, 4, 5],
  open: "08:30",
  close: "16:30",
};

export const DAY_NAMES = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
export const DAY_SHORT = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

const isTime = (v: unknown): v is string => typeof v === "string" && /^\d{2}:\d{2}$/.test(v);

/** ค่าที่บันทึกไว้อาจเก่าหรือเพี้ยน — ตัดของแปลกทิ้งแล้วเติมค่าตั้งต้นให้ครบเสมอ */
export function fillOfficeHours(saved: Partial<OfficeHours> | null | undefined): OfficeHours {
  const days = Array.isArray(saved?.days)
    ? [...new Set(saved.days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort()
    : DEFAULT_OFFICE_HOURS.days;

  return {
    days: days.length > 0 ? days : DEFAULT_OFFICE_HOURS.days,
    open: isTime(saved?.open) ? saved.open : DEFAULT_OFFICE_HOURS.open,
    close: isTime(saved?.close) ? saved.close : DEFAULT_OFFICE_HOURS.close,
  };
}

/**
 * "จันทร์ – ศุกร์" · "เสาร์ – อาทิตย์" · "จันทร์, พุธ, ศุกร์" แล้วแต่ว่าวันติดกันไหม
 *
 * เรียงโดยเริ่มที่วันจันทร์ตามที่คนไทยพูดกัน ไม่ใช่เริ่มวันอาทิตย์ตามเลขของ JavaScript
 * ไม่งั้นวันหยุดสุดสัปดาห์จะออกมาเป็น "อาทิตย์, เสาร์" ซึ่งอ่านแล้วสะดุด
 */
export function describeDays(days: number[]): string {
  if (days.length === 0) return "ไม่มีวันทำการ";
  if (days.length === 7) return "ทุกวัน";

  const weekIndex = (d: number) => (d + 6) % 7; // จันทร์ = 0 … อาทิตย์ = 6
  const sorted = [...days].sort((a, b) => weekIndex(a) - weekIndex(b));
  const continuous = sorted.every(
    (d, i) => i === 0 || weekIndex(d) === weekIndex(sorted[i - 1]) + 1,
  );
  if (continuous && sorted.length >= 2) {
    return `${DAY_NAMES[sorted[0]]} – ${DAY_NAMES[sorted[sorted.length - 1]]}`;
  }
  return sorted.map((d) => DAY_NAMES[d]).join(", ");
}

/** "จันทร์ – ศุกร์ 08:30 – 16:30 น." — ข้อความเดียวที่ใช้ทั้งเว็บ ไม่ต้องพิมพ์เอง */
export function describeOfficeHours(hours: OfficeHours): string {
  return `${describeDays(hours.days)} ${hours.open} – ${hours.close} น.`;
}

/** วันที่ไม่ได้ทำการ เขียนเป็นข้อความ เช่น "เสาร์, อาทิตย์" */
export function describeClosedDays(hours: OfficeHours): string {
  const off = [0, 1, 2, 3, 4, 5, 6].filter((d) => !hours.days.includes(d));
  return off.length === 0 ? "" : describeDays(off);
}

export type OfficeStatus = {
  open: boolean;
  /** ข้อความบนป้าย เช่น "เปิดทำการ" · "ปิดทำการ" · "วันหยุดสหกรณ์" */
  label: string;
  /** คำอธิบายเพิ่มตอนเอาเมาส์ชี้ */
  detail: string;
};

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/**
 * ตอนนี้เปิดอยู่ไหม — คิดจากเวลาบนเครื่องผู้อ่าน (เว็บนี้ให้บริการคนในจังหวัด เวลาตรงกันอยู่แล้ว)
 * วันหยุดสหกรณ์มาก่อนเสมอ ต่อให้ตรงกับวันทำการปกติก็ถือว่าปิด
 */
export function officeStatus(
  now: Date,
  hours: OfficeHours,
  holidayToday?: string | null,
): OfficeStatus {
  const span = `${hours.open} – ${hours.close} น.`;

  if (holidayToday) {
    return { open: false, label: "วันหยุดสหกรณ์", detail: holidayToday };
  }
  if (!hours.days.includes(now.getDay())) {
    return {
      open: false,
      label: "ปิดทำการ",
      detail: `วัน${DAY_NAMES[now.getDay()]}ไม่ใช่วันทำการ · ${describeOfficeHours(hours)}`,
    };
  }

  const minutes = now.getHours() * 60 + now.getMinutes();
  const inside = minutes >= toMinutes(hours.open) && minutes < toMinutes(hours.close);

  return inside
    ? { open: true, label: "เปิดทำการ", detail: `วันนี้เปิด ${span}` }
    : { open: false, label: "นอกเวลาทำการ", detail: `วันนี้เปิด ${span}` };
}
