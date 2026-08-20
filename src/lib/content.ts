import { db } from "@/lib/db";
import { getTickerSettings } from "@/lib/settings";
import { announcementLine, KINDS, type Kind } from "@/lib/announcementKinds";
import { localAsset } from "@/lib/assetFallback";
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
  /** ซ่อนเลขที่บนหน้าเว็บ */
  hideNumber: boolean;
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
  /** หมวดของประกาศ — ใช้เลือกสีป้าย · null = ข้อความที่พิมพ์เองไม่ได้มาจากประกาศ */
  kind: Kind | null;
};

/** ดึงกี่เรื่องต่อหมวดได้มากสุด — กันตั้งเลขเยอะจนข่าววิ่งครบรอบเป็นสิบนาที */
export const TICKER_MAX_PER_KIND = 20;

/**
 * ข้อความที่จะวิ่งจริง = ประกาศล่าสุดที่ดึงมาเอง + ข้อความที่พิมพ์เพิ่มไว้เอง (ถ้ามี)
 *
 * ดึงแยกหมวด หมวดละไม่เกิน perKind เรื่อง แล้ววิ่งเรียงทีละหมวด
 * (ประกาศ → จดหมายข่าว → รายงานกิจการ) เดิมดึงรวมกันเป็นชุดเดียว
 * ประกาศซึ่งออกถี่กว่ามากจึงกินโควตาไปเกือบหมด อีกสองหมวดแทบไม่ได้ขึ้นเลย
 *
 * ป้าย "New" ให้เฉพาะรายการต้น ๆ ของแต่ละหมวด (ตั้งจำนวนแยกหมวดได้ที่ /admin/home/ticker)
 * เอาประกาศขึ้นก่อนข้อความที่พิมพ์เอง เพราะป้ายต้องหมายถึงเรื่องที่ใหม่จริง
 * ไม่ใช่ข้อความประจำที่ปักไว้นาน ๆ
 */
export async function getTickerEntries(): Promise<TickerEntry[]> {
  const settings = await getTickerSettings();
  const label = settings.badgeText.trim();
  const perKind = Math.max(1, Math.min(TICKER_MAX_PER_KIND, settings.perKind));

  const auto: TickerEntry[] = [];

  if (settings.auto) {
    for (const kind of KINDS) {
      const rows = await getAnnouncements(perKind, kind);
      const quota = settings.badgeCounts[kind] ?? 0;

      rows.forEach((a, i) => {
        auto.push({
          text: announcementLine(a.kind, a.number, a.title, a.hideNumber),
          href: a.href && a.href !== "#" ? a.href : null,
          badge: label && i < quota ? label : null,
          kind: a.kind,
        });
      });
    }
  }

  const manual: TickerEntry[] = (await getTickerItems()).map((text) => ({
    text,
    href: null,
    badge: null,
    kind: null,
  }));

  return [...auto, ...manual];
}

/**
 * วันหยุดสหกรณ์ของ "วันนี้" — ป้ายบนหัวเว็บใช้บอกว่าวันนี้ปิดทำการ
 * คืนชื่อวันหยุด หรือ null ถ้าวันนี้ทำการปกติ (ฐานล่มก็คืน null ไม่ทำให้หัวเว็บพัง)
 */
export async function getHolidayToday(): Promise<string | null> {
  try {
    const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
    const from = new Date(`${ymd}T00:00:00+07:00`);
    const to = new Date(from.getTime() + 24 * 3_600_000);

    const row = await db.holiday.findFirst({
      where: { published: true, date: { gte: from, lt: to } },
      select: { title: true },
    });
    return row?.title ?? null;
  } catch (error) {
    console.error("อ่านวันหยุดวันนี้ไม่ได้:", error);
    return null;
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
      src: localAsset(r.imageUrl),
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
      hideNumber: r.hideNumber,
      date: thaiDate.format(r.publishedAt),
      // ยังไม่มีหน้ารายละเอียดประกาศ — ถ้าไม่มีไฟล์แนบก็ยังไม่ต้องลิงก์ไปไหน
      href: localAsset(r.fileUrl) || "#",
    }));
  } catch (error) {
    console.error("อ่านประกาศไม่ได้:", error);
    return [];
  }
}
