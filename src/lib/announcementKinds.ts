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

/** ป้ายเหนือรายการในการ์ดหน้าแรก */
export const KIND_HEADING: Record<Kind, string> = {
  ANNOUNCEMENT: "ประกาศสหกรณ์",
  NEWSLETTER: "จดหมายข่าวสหกรณ์",
  REPORT: "รายงานกิจการประจำปี",
};

/** โฟลเดอร์ปลายทางฝั่ง FTP ของแต่ละหมวด — ต้องตรงกับ FOLDERS ใน src/lib/ftp.ts */
export const KIND_FOLDER: Record<Kind, "Declar" | "mailnew" | "resultreport"> = {
  ANNOUNCEMENT: "Declar",
  NEWSLETTER: "mailnew",
  REPORT: "resultreport",
};

export const isKind = (value: unknown): value is Kind =>
  typeof value === "string" && (KINDS as readonly string[]).includes(value);
