import { db } from "@/lib/db";
import { localAsset } from "@/lib/assetFallback";
import {
  committees,
  memberFeatures,
  memberLinks,
  recommends,
  services,
  footerLinks,
  officerServices,
  calendarEvents,
} from "@/data/home";

/**
 * ทุกส่วนของหน้าแรกที่เป็น "รายการ" อยู่ในตาราง HomeItem ตารางเดียว แยกด้วย section
 *
 * ตอนยังไม่มีข้อมูลในฐาน หน้าเว็บจะใช้ชุดที่ติดมากับโค้ดไปก่อน (ไม่มีช่องว่างคาหน้า)
 * ส่วนหลังบ้านจะ "นำเข้าค่าปัจจุบัน" ให้อัตโนมัติครั้งแรกที่เปิด จะได้มีของให้แก้ทันที
 */

export type Section =
  | "services"
  | "recommends"
  | "memberFeatures"
  | "memberLinks"
  | "committees"
  | "officers"
  | "footerLinks";

export type Item = {
  id: string;
  title: string;
  subtitle: string | null;
  icon: string | null;
  href: string | null;
  imageUrl: string | null;
  theme: string | null;
  /** ใช้เฉพาะ "บริการของเรา" — member | committee | staff */
  category: string | null;
  published: boolean;
};

type Seed = Omit<Item, "id" | "published">;

const blank = { subtitle: null, icon: null, href: null, imageUrl: null, theme: null, category: null };

/** ค่าตั้งต้นของแต่ละส่วน = ของที่แสดงอยู่บนเว็บตอนนี้ */
export const DEFAULTS: Record<Section, Seed[]> = {
  services: services.map((s) => ({ ...blank, title: s.label, icon: s.icon, href: s.href })),
  recommends: recommends.map((r) => ({
    ...blank,
    title: r.title,
    subtitle: r.subtitle,
    href: r.href,
    theme: r.theme,
  })),
  memberFeatures: memberFeatures.map((m) => ({
    ...blank,
    title: m.title,
    subtitle: m.subtitle,
    icon: m.icon,
    href: m.href,
  })),
  memberLinks: memberLinks.map((m) => ({ ...blank, title: m.label, icon: m.icon, href: m.href })),
  committees: committees.map((c) => ({ ...blank, title: c.name, subtitle: c.role })),
  officers: officerServices.map((o) => ({
    ...blank,
    title: o.office,
    subtitle: o.desc,
    icon: o.officeIcon,
    imageUrl: o.image || null,
  })),
  footerLinks: footerLinks.map((f) => ({ ...blank, title: f.label, href: f.href })),
};

export const SECTION_LABELS: Record<Section, { label: string; hint: string }> = {
  services: { label: "บริการของเรา", hint: "แถวไอคอนบริการกลางหน้าแรก" },
  recommends: { label: "แนะนำสมาชิก", hint: "การ์ดใหญ่ 3 ใบ เงินฝาก/เงินกู้/สวัสดิการ" },
  memberFeatures: {
    label: "การ์ดคิวอาร์โค้ด/โซเชียล",
    hint: "การ์ดคิวอาร์โค้ดและลิงก์โซเชียลมีเดีย ในส่วนสำหรับสมาชิก",
  },
  memberLinks: { label: "ลิงก์สำหรับสมาชิก", hint: "ปุ่มคู่มือและไลน์สหกรณ์" },
  committees: { label: "คณะกรรมการ (สไลด์หน้าแรก)", hint: "สไลด์เล็กข้างการ์ดประกาศ" },
  officers: { label: "สำนักงานบริการสมาชิก", hint: "การ์ดสำนักงานท้ายหน้าแรก" },
  footerLinks: { label: "ลิงก์หน่วยงานท้ายเว็บ", hint: "รายการลิงก์ในส่วนท้ายของทุกหน้า" },
};

/** อ่านรายการของส่วนนั้น — ยังไม่มีในฐานจะคืนค่าตั้งต้นให้หน้าเว็บใช้ไปก่อน */
export async function getItems(section: Section): Promise<Item[]> {
  try {
    const rows = await db.homeItem.findMany({
      where: { section, published: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    if (rows.length > 0) {
      return rows.map((r) => ({
        id: r.id,
        title: r.title,
        subtitle: r.subtitle,
        icon: r.icon,
        // href เป็นไฟล์ PDF ได้ (เช่นคู่มือแนะนำสมาชิก) ต้องชี้สำเนาในเครื่องเหมือนรูป
        href: localAsset(r.href) || null,
        imageUrl: localAsset(r.imageUrl) || null,
        theme: r.theme,
        category: r.category,
        published: r.published,
      }));
    }
  } catch (error) {
    console.error(`อ่านรายการ "${section}" ไม่ได้:`, error);
  }

  return DEFAULTS[section].map((seed, i) => ({ ...seed, id: `default-${i}`, published: true }));
}

/**
 * ใช้ในหลังบ้าน — ถ้ายังไม่เคยมีข้อมูลของส่วนนี้ ให้นำค่าที่แสดงอยู่บนเว็บตอนนี้เข้าฐานก่อน
 * เจ้าหน้าที่จะได้เห็นของจริงให้แก้ ไม่ใช่หน้าว่างเปล่า
 */
export async function getItemsForAdmin(section: Section): Promise<Item[]> {
  const existing = await db.homeItem.count({ where: { section } });

  if (existing === 0) {
    await db.homeItem.createMany({
      data: DEFAULTS[section].map((seed, i) => ({ ...seed, section, sortOrder: i + 1 })),
    });
  }

  const rows = await db.homeItem.findMany({
    where: { section },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    subtitle: r.subtitle,
    icon: r.icon,
    href: localAsset(r.href) || null,
    imageUrl: localAsset(r.imageUrl) || null,
    theme: r.theme,
    category: r.category,
    published: r.published,
  }));
}

/* ── ปฏิทินกิจกรรม ── */

/** ประเภทกิจกรรมบนปฏิทิน — วันหยุดมาจากอีกตาราง ไม่นับในนี้ */
export const EVENT_TYPES = ["mobile", "project", "seminar"] as const;
export type EventType = (typeof EVENT_TYPES)[number];
export const isEventType = (v: unknown): v is EventType =>
  typeof v === "string" && (EVENT_TYPES as readonly string[]).includes(v);

export type EventItem = {
  id: string;
  day: number;
  /** วันที่เต็มแบบ "YYYY-MM-DD" — ว่าง = รายการเก่าที่ระบุแค่วันที่ในเดือน */
  date: string;
  type: EventType;
  title: string;
  place: string | null;
  time: string | null;
  published: boolean;
};

/** วันที่แบบไทย "YYYY-MM-DD" ของค่าที่เก็บเป็นเที่ยงคืนเวลาไทย */
const thaiYmd = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(d);

/**
 * กิจกรรมที่จะขึ้นปฏิทินหน้าแรก — ปฏิทินโชว์ทีละเดือน จึงคัดเฉพาะเดือนนี้
 *
 * รายการที่ระบุวันที่เต็มไว้ ขึ้นเฉพาะเดือน/ปีของมันจริง ๆ
 * ส่วนรายการเก่าที่มีแต่เลขวัน (ยังไม่เคยแก้ให้ระบุวันที่) ขึ้นทุกเดือนเหมือนเดิม
 */
/**
 * กิจกรรมที่มาจากแบนเนอร์สไลด์ — สไลด์ที่ใส่ "วันจัดกิจกรรม" ไว้จะไปปักบนปฏิทินให้เอง
 * ไม่ต้องมาพิมพ์ซ้ำอีกรอบในเมนูปฏิทิน แก้ชื่อที่สไลด์ที่เดียวเปลี่ยนทั้งสองที่
 */
async function getSlideEvents(month: string): Promise<EventItem[]> {
  try {
    const rows = await db.slide.findMany({
      where: { published: true, eventDate: { not: null } },
      orderBy: { eventDate: "asc" },
      select: { id: true, title: true, caption: true, eventDate: true, eventType: true },
    });

    return rows
      .map((r) => {
        const date = thaiYmd(r.eventDate as Date);
        return {
          id: `slide-${r.id}`,
          day: Number(date.slice(8)),
          date,
          type: isEventType(r.eventType) ? r.eventType : ("project" as EventType),
          title: r.title,
          place: r.caption,
          time: null,
          published: true,
        };
      })
      .filter((e) => e.date.startsWith(month));
  } catch (error) {
    console.error("อ่านกิจกรรมจากสไลด์ไม่ได้:", error);
    return [];
  }
}

export async function getCalendarEvents(): Promise<EventItem[]> {
  const month = thaiYmd(new Date()).slice(0, 7); // "2026-08"
  const fromSlides = await getSlideEvents(month);

  try {
    const rows = await db.calendarEvent.findMany({
      where: { published: true },
      orderBy: { day: "asc" },
    });
    if (rows.length > 0) {
      return rows
        .map((r) => ({
          id: r.id,
          day: r.day,
          date: r.date ? thaiYmd(r.date) : "",
          type: isEventType(r.type) ? r.type : "project",
          title: r.title,
          place: r.place,
          time: r.time,
          published: r.published,
        }))
        .filter((e) => !e.date || e.date.startsWith(month))
        .concat(fromSlides);
    }
  } catch (error) {
    console.error("อ่านกิจกรรมปฏิทินไม่ได้:", error);
  }

  // ค่าตั้งต้นไม่เอารายการ holiday มาด้วย เพราะวันหยุดมาจากเมนู "วันหยุด" แล้ว
  return calendarEvents
    .filter((e) => e.type !== "holiday")
    .map((e, i) => ({
      id: `default-${i}`,
      day: e.day,
      date: "",
      type: isEventType(e.type) ? e.type : ("project" as EventType),
      title: e.title,
      place: e.place ?? null,
      time: e.time ?? null,
      published: true,
    }))
    .concat(fromSlides);
}

export async function getCalendarEventsForAdmin(): Promise<EventItem[]> {
  const existing = await db.calendarEvent.count();

  if (existing === 0) {
    await db.calendarEvent.createMany({
      data: calendarEvents
        .filter((e) => e.type !== "holiday")
        .map((e) => ({
          day: e.day,
          type: e.type,
          title: e.title,
          place: e.place ?? null,
          time: e.time ?? null,
        })),
    });
  }

  // เรียงตามวันที่จริงก่อน รายการที่ยังไม่ระบุวันที่ไปต่อท้าย
  const rows = await db.calendarEvent.findMany({
    orderBy: [{ date: { sort: "asc", nulls: "last" } }, { day: "asc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    day: r.day,
    date: r.date ? thaiYmd(r.date) : "",
    type: isEventType(r.type) ? r.type : "project",
    title: r.title,
    place: r.place,
    time: r.time,
    published: r.published,
  }));
}
