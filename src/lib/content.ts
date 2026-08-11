import { db } from "@/lib/db";

/**
 * เนื้อหาหน้าแรกที่เป็น "รายการ" — ข่าววิ่งกับประกาศ ที่แก้ได้จากหลังบ้าน /admin/home
 *
 * ทุกฟังก์ชันกลืน error แล้วคืนลิสต์ว่างแทน เพราะหน้าแรกเรียกใช้ทั้งหมดนี้ —
 * ฐานสะดุดทีต้องไม่ทำให้ทั้งหน้าพัง (เหมือน getSetting ใน settings.ts)
 */

export type AnnouncementItem = {
  id: string;
  number: string;
  title: string;
  /** วันที่แบบไทยพร้อมแสดงผล เช่น "30 มิ.ย. 2569" — แปลงฝั่งเซิร์ฟเวอร์กัน hydration ไม่ตรง */
  date: string;
  href: string;
};

const thaiDate = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Bangkok",
});

export async function getTickerItems(): Promise<string[]> {
  try {
    const rows = await db.newsTicker.findMany({
      where: { published: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });
    return rows.map((r) => r.text);
  } catch (error) {
    console.error("อ่านข่าววิ่งไม่ได้:", error);
    return [];
  }
}

export async function getAnnouncements(take = 20): Promise<AnnouncementItem[]> {
  try {
    const rows = await db.announcement.findMany({
      where: { published: true },
      orderBy: { publishedAt: "desc" },
      take,
    });
    return rows.map((r) => ({
      id: r.id,
      number: r.number,
      title: r.title,
      date: thaiDate.format(r.publishedAt),
      // ยังไม่มีหน้ารายละเอียดประกาศ — ถ้าไม่มีไฟล์แนบก็ยังไม่ต้องลิงก์ไปไหน
      href: r.fileUrl ?? "#",
    }));
  } catch (error) {
    console.error("อ่านประกาศไม่ได้:", error);
    return [];
  }
}
