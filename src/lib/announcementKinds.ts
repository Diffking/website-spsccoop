/**
 * สามหมวดของเอกสารที่ขึ้นการ์ดหน้าแรก — ใช้ร่วมกันทั้งหน้าเว็บและหลังบ้าน
 * ชื่อไทยอยู่ที่เดียว จะได้ไม่หลุดไม่ตรงกันระหว่างแท็บหน้าแรกกับเมนูหลังบ้าน
 */

export const KINDS = ["ANNOUNCEMENT", "NEWSLETTER", "REPORT"] as const;
export type Kind = (typeof KINDS)[number];

export const KIND_LABEL: Record<Kind, string> = {
  ANNOUNCEMENT: "ประกาศ",
  NEWSLETTER: "จดหมายข่าว",
  REPORT: "รายงานกิจการ",
};

/** คำนำหน้าเลขที่ในรายการ เช่น "ประกาศที่ 19/2569" · "จดหมายข่าวฉบับที่ 3/2569" */
export const KIND_PREFIX: Record<Kind, string> = {
  ANNOUNCEMENT: "ประกาศที่",
  NEWSLETTER: "จดหมายข่าวฉบับที่",
  REPORT: "รายงานกิจการ",
};

/**
 * คำเชื่อมก่อนชื่อเรื่อง ตามที่เขียนในหัวเอกสารจริง
 * ("ประกาศที่ 1/2569 เรื่อง ทุนการศึกษาแก่บุตรสมาชิก ประจำปี 2569")
 * รายงานกิจการไม่มีบรรทัด "เรื่อง" จึงเว้นว่างไว้
 */
export const KIND_SUBJECT: Record<Kind, string> = {
  ANNOUNCEMENT: "เรื่อง",
  NEWSLETTER: "เรื่อง",
  REPORT: "",
};

/** บรรทัดที่แสดงจริงทั้งหน้าเว็บและหลังบ้าน — รวมไว้ที่เดียวจะได้ไม่หลุดไม่ตรงกัน */
export const announcementLine = (kind: Kind, number: string, title: string): string =>
  [KIND_PREFIX[kind], number, KIND_SUBJECT[kind], title].filter(Boolean).join(" ");

/** ป้ายเหนือรายการในการ์ดหน้าแรก */
export const KIND_HEADING: Record<Kind, string> = {
  ANNOUNCEMENT: "ประกาศสหกรณ์",
  NEWSLETTER: "จดหมายข่าวสหกรณ์",
  REPORT: "รายงานกิจการประจำปี",
};

/**
 * หมวดไหนเปิดอ่านแบบ E-Book (พลิกหน้าในเว็บ) แทนการโหลดไฟล์ทั้งก้อน
 *
 * ประกาศเป็นเอกสารหน้าเดียวสองหน้า เปิดไฟล์ตรง ๆ เร็วกว่า
 * ส่วนจดหมายข่าวกับรายงานกิจการหนาหลายสิบหน้า ไฟล์ใหญ่ ถ้าให้โหลดทั้งเล่มก่อนอ่านจะรอนาน
 */
export const KIND_EBOOK: Record<Kind, boolean> = {
  ANNOUNCEMENT: false,
  NEWSLETTER: true,
  REPORT: true,
};

/** ปลายทางเมื่อกดอ่าน — E-Book ของเราเอง หรือไฟล์ตรง ๆ */
export function readerHref(kind: Kind, id: string, fileUrl: string | null): string | null {
  const file = fileUrl && fileUrl !== "#" ? fileUrl : null;
  if (!file) return null;
  // ไฟล์ที่ไม่ใช่ PDF (เช่นลิงก์ไปหน้าอื่น) เปิดตรง ๆ เสมอ เพราะพลิกหน้าไม่ได้
  const isPdf = /\.pdf(\?|#|$)/i.test(file);
  return KIND_EBOOK[kind] && isPdf ? `/ebook/${id}/` : file;
}

/** โฟลเดอร์ปลายทางฝั่ง FTP ของแต่ละหมวด — ต้องตรงกับ FOLDERS ใน src/lib/ftp.ts */
export const KIND_FOLDER: Record<Kind, "Declar" | "newsletter" | "resultreport"> = {
  ANNOUNCEMENT: "Declar",
  NEWSLETTER: "newsletter",
  REPORT: "resultreport",
};

export const isKind = (value: unknown): value is Kind =>
  typeof value === "string" && (KINDS as readonly string[]).includes(value);
