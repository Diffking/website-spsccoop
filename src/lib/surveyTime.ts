/**
 * วันเวลาของแบบประเมิน — เก็บเป็น ISO แต่คนเห็น/กรอกเป็นเวลาไทย
 *
 * แยกวันที่กับเวลาออกจากกัน เพราะตัวเลือกวันที่ของระบบ (ThaiDatePicker) รับแค่ "YYYY-MM-DD"
 * คิดผ่าน +07:00 ตรง ๆ ทุกครั้ง ไม่พึ่งโซนเวลาของเครื่อง — เครื่องเจ้าหน้าที่กับเซิร์ฟเวอร์
 * อาจตั้งโซนไม่ตรงกัน แล้ววันจะเลื่อนไปหนึ่งวันแบบที่เคยเจอในปฏิทิน
 */

const DATE = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" });
const TIME = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Bangkok",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const THAI = new Intl.DateTimeFormat("th-TH", {
  timeZone: "Asia/Bangkok",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** ISO → { date: "YYYY-MM-DD", time: "HH:MM" } ตามเวลาไทย · ว่าง → ช่องว่าง */
export function splitThai(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: "", time: "" };
  return { date: DATE.format(d), time: TIME.format(d) };
}

/** วันที่ + เวลาไทย → ISO · ไม่มีวันที่ = null (ไม่กำหนด) */
export function joinThai(date: string, time: string, fallbackTime: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const t = /^\d{2}:\d{2}$/.test(time) ? time : fallbackTime;
  const d = new Date(`${date}T${t}:00+07:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** "22 ต.ค. 2569 16:30" — ไว้โชว์ในรายการ */
export function thaiDateTime(iso: string | Date | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : `${THAI.format(d)} น.`;
}
