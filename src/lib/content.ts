import { db } from "@/lib/db";
import { getTickerSettings } from "@/lib/settings";
import { announcementLine, type Kind } from "@/lib/announcementKinds";
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
  kind: Kind;
  /** ป้ายพิเศษหน้าหัวข้อ เช่น "ด่วน" — null = ไม่ติดป้าย */
  badge: string | null;
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

export type TickerEntry = {
  text: string;
  /** ไฟล์ประกาศ ถ้ามี — กดจากข่าววิ่งไปอ่านฉบับเต็มได้เลย */
  href: string | null;
  /** คำบนป้ายหน้าข้อความ เช่น New — null = ไม่ติดป้าย */
  badge: string | null;
};

/**
 * ข้อความที่จะวิ่งจริง = ประกาศล่าสุดที่ดึงมาเอง + ข้อความที่พิมพ์เพิ่มไว้เอง (ถ้ามี)
 *
 * เอาประกาศขึ้นก่อนเพราะป้าย "New" ติดให้ n รายการแรก ซึ่งต้องหมายถึงประกาศที่ใหม่ที่สุด
 * ไม่ใช่ข้อความประจำที่ปักไว้นาน ๆ
 */
export async function getTickerEntries(): Promise<TickerEntry[]> {
  const settings = await getTickerSettings();

  const auto = settings.auto
    ? (await getAnnouncements(Math.max(1, Math.min(30, settings.limit)))).map((a) => ({
        text: announcementLine(a.kind, a.number, a.title),
        href: a.href && a.href !== "#" ? a.href : null,
        badge: null as string | null,
      }))
    : [];

  const manual = (await getTickerItems()).map((text) => ({
    text,
    href: null,
    badge: null as string | null,
  }));

  const entries = [...auto, ...manual];
  const label = settings.badgeText.trim();
  if (!label || settings.badgeCount <= 0) return entries;

  return entries.map((entry, i) => (i < settings.badgeCount ? { ...entry, badge: label } : entry));
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
    // แสดงเฉพาะที่ถึงวันเริ่มแล้วและยังไม่เลยวันสิ้นสุด — ข่าวเก่าหายเองไม่ต้องมาคอยลบ
    const now = new Date();
    const rows = await db.slide.findMany({
      where: {
        published: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      },
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

/** ไม่ระบุ kind = เอาทุกหมวดปนกัน (ข่าววิ่งใช้แบบนั้น) */
export async function getAnnouncements(take = 20, kind?: Kind): Promise<AnnouncementItem[]> {
  try {
    const rows = await db.announcement.findMany({
      where: { published: true, ...(kind ? { kind } : {}) },
      // ลำดับที่จัดเองมาก่อน · ตัวที่ยังไม่เคยจัด (0) เรียงตามวันที่ใหม่ไปเก่า
      orderBy: [{ sortOrder: "asc" }, { publishedAt: "desc" }],
      take,
    });
    return rows.map((r) => ({
      id: r.id,
      number: r.number,
      title: r.title,
      kind: r.kind as Kind,
      badge: r.badge?.trim() || null,
      date: thaiDate.format(r.publishedAt),
      // ยังไม่มีหน้ารายละเอียดประกาศ — ถ้าไม่มีไฟล์แนบก็ยังไม่ต้องลิงก์ไปไหน
      href: r.fileUrl ?? "#",
    }));
  } catch (error) {
    console.error("อ่านประกาศไม่ได้:", error);
    return [];
  }
}
