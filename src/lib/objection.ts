/**
 * ระบบคำทักท้วงรายงานการประชุมใหญ่ — ตรรกะล้วน ไม่แตะฐาน ใช้ได้ทั้งหน้าเว็บ หลังบ้าน และ API
 *
 * เจ้าของเว็บกำหนด 16 พ.ย. 2569:
 *   · **ระบบแยกต่างหาก ไม่เกี่ยวกับแบบประเมิน** (ห้ามเอาไปรวมกับ Survey)
 *   · สมาชิกพิมพ์เอง 4 อย่าง: เลขที่สมาชิก · ชื่อ-นามสกุล · ระเบียบวาระที่ (1–5) · รายละเอียดที่ต้องการแก้ไข
 *   · แยกเป็นปี ๆ · เจ้าหน้าที่ตั้งชื่อระเบียบวาระได้ · กำหนดวันเริ่ม/วันปิดรับเองในหลังบ้าน
 *   · มีด่านกันบอทตอนกดส่ง (src/lib/botGuard.ts)
 */

export const AGENDA_COUNT = 5;

export type Agenda = { no: number; title: string };
export type ObjectionItem = { no: number; detail: string };
export type RoundStatus = "draft" | "scheduled" | "open" | "closed";

export const DETAIL_MAX = 2000;

/** ชื่อระเบียบวาระครบ 5 ข้อเสมอ — ค่าในฐานอ่านไม่ออก/ไม่ครบก็เติมให้ */
export function readAgendas(raw: unknown): Agenda[] {
  const list = Array.isArray(raw) ? raw : [];
  return Array.from({ length: AGENDA_COUNT }, (_, i) => {
    const found = list.find((a) => a && typeof a === "object" && Number((a as Agenda).no) === i + 1) as
      | Agenda
      | undefined;
    const title = typeof found?.title === "string" ? found.title.replace(/\s+/g, " ").trim().slice(0, 200) : "";
    return { no: i + 1, title };
  });
}

/** "ระเบียบวาระที่ 3 เรื่อง ..." — ไม่ได้ตั้งชื่อก็เหลือแค่เลขวาระ */
export const agendaLabel = (a: Agenda) => `ระเบียบวาระที่ ${a.no}${a.title ? ` ${a.title}` : ""}`;

export function readItems(raw: unknown): ObjectionItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((o) => ({ no: Number((o as ObjectionItem)?.no), detail: String((o as ObjectionItem)?.detail ?? "") }))
    .filter((o) => Number.isInteger(o.no) && o.no >= 1 && o.no <= AGENDA_COUNT)
    .sort((a, b) => a.no - b.no);
}

export function roundStatus(
  r: { published: boolean; opensAt: Date | string; closesAt: Date | string },
  now = Date.now(),
): RoundStatus {
  if (!r.published) return "draft";
  if (now < new Date(r.opensAt).getTime()) return "scheduled";
  if (now > new Date(r.closesAt).getTime()) return "closed";
  return "open";
}

export const STATUS_LABEL: Record<RoundStatus, string> = {
  draft: "ยังไม่เผยแพร่",
  scheduled: "ยังไม่เปิดรับ",
  open: "เปิดรับอยู่",
  closed: "ปิดรับแล้ว",
};

const thaiDay = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Asia/Bangkok",
});
const thaiTime = new Intl.DateTimeFormat("th-TH", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Bangkok",
});

/** "14 พฤศจิกายน 2569" */
export const thaiDate = (d: Date | string) => thaiDay.format(new Date(d));
/** "14 พฤศจิกายน 2569 เวลา 09:30 น." */
export const thaiDateTime = (d: Date | string) =>
  `${thaiDay.format(new Date(d))} เวลา ${thaiTime.format(new Date(d))} น.`;

/** YYYY-MM-DD ตามเวลาไทย — ค่าที่ ThaiDatePicker ใช้ */
export const dateValue = (d: Date | string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date(d));

/** วันเริ่ม = 00:00 · วันปิด = 23:59:59 ตามเวลาไทย */
export function dayStart(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00+07:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}
export function dayEnd(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T23:59:59+07:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** หัวเรื่องตั้งต้นของปี */
export const defaultTitle = (year: number) => `คำทักท้วงรายงานการประชุมใหญ่ ปี ${year}`;

/** ชื่อ-สกุลที่สมาชิกพิมพ์เอง — ต้องมีตัวอักษร ไม่มีลิงก์ ไม่ยาวเกิน */
export function readName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.replace(/\s+/g, " ").trim();
  if (name.length < 3 || name.length > 120) return null;
  if (!/[฀-๿a-zA-Z]/.test(name)) return null;
  if (/https?:|www\.|[<>{}]/i.test(name)) return null;
  return name;
}

export function readMembNo(raw: unknown): string | null {
  const digits = typeof raw === "string" ? raw.replace(/\D/g, "") : "";
  return /^\d{1,8}$/.test(digits) ? digits : null;
}

export const membKey = (membNo: string) => membNo.replace(/^0+/, "") || "0";
