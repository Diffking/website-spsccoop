/**
 * ที่อยู่เว็บสาธารณะ — ที่ที่สมาชิกเปิดดู ไม่ใช่โดเมนของหลังบ้าน
 *
 * หลังบ้านอยู่คนละโดเมนกับหน้าเว็บแล้ว (admin.spsccoop.org กับ spsccoop.org)
 * ลิงก์ "เปิดหน้าเว็บไซต์" จึงชี้ "/" เฉย ๆ ไม่ได้ มันจะวนกลับมาที่หลังบ้านเอง
 *
 * เปลี่ยนได้ที่ PUBLIC_SITE_URL ใน .env โดยไม่ต้องแก้โค้ด
 */
export function publicSiteUrl(): string {
  const value = process.env.PUBLIC_SITE_URL?.trim();
  return (value || "https://spsccoop.org").replace(/\/+$/, "");
}
