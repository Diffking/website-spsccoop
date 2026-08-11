import { db } from "@/lib/db";
import type { CalendarEvent } from "@/data/home";

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

/**
 * วันหยุดสหกรณ์ของ "เดือนนี้" สำหรับปฏิทินหน้าแรก (ปฏิทินแสดงทีละเดือน)
 * ตัดเดือนตามเวลาไทย ไม่ใช่ UTC ไม่งั้นต้นเดือน/ปลายเดือนจะคลาดไปหนึ่งวัน
 */
export async function getHolidayEvents(): Promise<CalendarEvent[]> {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
      month: "2-digit",
    }).format(new Date());
    const [year, month] = parts.split("-").map(Number);

    const from = new Date(`${parts}-01T00:00:00+07:00`);
    const to = new Date(Date.UTC(year, month, 1) - 7 * 3_600_000);

    const rows = await db.holiday.findMany({
      where: { published: true, date: { gte: from, lt: to } },
      orderBy: { date: "asc" },
    });

    const dayOf = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", day: "numeric" });

    return rows.map((r) => ({
      day: Number(dayOf.format(r.date)),
      type: "holiday" as const,
      title: r.title,
      place: r.note ?? undefined,
    }));
  } catch (error) {
    console.error("อ่านวันหยุดไม่ได้:", error);
    return [];
  }
}

export type SlideItem = { id: string; src: string; title: string; desc: string; href: string };

/**
 * แบนเนอร์สไลด์หน้าแรก — คืนลิสต์ว่างถ้ายังไม่มีในฐาน
 * (หน้าแรกจะใช้ภาพชุดเดิมที่ติดมากับโค้ดแทน จะได้ไม่มีช่องว่างคาหน้า)
 */
export async function getSlides(): Promise<SlideItem[]> {
  try {
    const rows = await db.slide.findMany({
      where: { published: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    return rows.map((r) => ({
      id: r.id,
      src: r.imageUrl,
      title: r.title,
      desc: r.caption ?? "",
      href: r.href ?? "#",
    }));
  } catch (error) {
    console.error("อ่านแบนเนอร์สไลด์ไม่ได้:", error);
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
