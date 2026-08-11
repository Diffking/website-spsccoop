import { db } from "@/lib/db";
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
  published: boolean;
};

type Seed = Omit<Item, "id" | "published">;

const blank = { subtitle: null, icon: null, href: null, imageUrl: null, theme: null };

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
  memberFeatures: { label: "การ์ดสำหรับสมาชิก", hint: "การ์ดบริการย่อยในส่วนสำหรับสมาชิก" },
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
        href: r.href,
        imageUrl: r.imageUrl,
        theme: r.theme,
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
    href: r.href,
    imageUrl: r.imageUrl,
    theme: r.theme,
    published: r.published,
  }));
}

/* ── ปฏิทินกิจกรรม ── */

export type EventItem = {
  id: string;
  day: number;
  type: "mobile" | "project";
  title: string;
  place: string | null;
  time: string | null;
  published: boolean;
};

export async function getCalendarEvents(): Promise<EventItem[]> {
  try {
    const rows = await db.calendarEvent.findMany({
      where: { published: true },
      orderBy: { day: "asc" },
    });
    if (rows.length > 0) {
      return rows.map((r) => ({
        id: r.id,
        day: r.day,
        type: r.type === "mobile" ? "mobile" : "project",
        title: r.title,
        place: r.place,
        time: r.time,
        published: r.published,
      }));
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
      type: e.type === "mobile" ? "mobile" : "project",
      title: e.title,
      place: e.place ?? null,
      time: e.time ?? null,
      published: true,
    }));
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

  const rows = await db.calendarEvent.findMany({ orderBy: { day: "asc" } });
  return rows.map((r) => ({
    id: r.id,
    day: r.day,
    type: r.type === "mobile" ? "mobile" : "project",
    title: r.title,
    place: r.place,
    time: r.time,
    published: r.published,
  }));
}
