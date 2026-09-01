/**
 * CoopBridge — สะพานข้อมูลระหว่างเว็บสหกรณ์กับระบบอื่นในสำนักงาน
 *
 * ระบบอื่น (officer ที่ `192.168.100.142`) ไม่ได้ต่อฐานข้อมูลของเว็บโดยตรง
 * แต่ขอผ่านเส้นทาง `/api/bridge/*` ซึ่งคืนของที่ **จัดรูปให้เครื่องอ่าน** แล้ว
 * ไม่ต้องไปแกะ HTML ของหน้าเว็บเอง
 *
 * ทำไมต้องมีชั้นนี้ ไม่ให้ต่อฐานตรง ๆ:
 *   1. ข้อมูลจริงกระจายอยู่หลายที่ — ทำเนียบอยู่ใน HTML ของตาราง `Page`
 *      ส่วนกิจกรรมปฏิทินอยู่ทั้งตาราง `CalendarEvent` และในสไลด์ที่ใส่วันจัดงานไว้
 *      ที่นี่รวมให้เป็นก้อนเดียวแล้ว ระบบปลายทางไม่ต้องรู้ว่าของอยู่ตรงไหน
 *   2. เปลี่ยนโครงข้างในเว็บได้โดยไม่ทำระบบปลายทางพัง ตราบใดที่รูปแบบที่คืนยังเหมือนเดิม
 *   3. ฐานข้อมูลผูกกับ `127.0.0.1` เท่านั้น เครื่องอื่นในวงแลนต่อไม่ถึงอยู่แล้ว
 *
 * ⚠️ **อ่านอย่างเดียว** — ไม่มีเส้นทางไหนในชุดนี้เขียนข้อมูลของเว็บเลย
 *    ระบบปลายทางเอาไปทำอะไรต่อก็เป็นเรื่องของเขา ไม่ย้อนกลับมาแก้เว็บ
 *
 * ⚠️ **ชื่อคนส่วนใหญ่ไม่ได้อยู่ในฐานข้อมูล** — รูปบุคลากรที่ร้านทำมาให้มีชื่อพิมพ์ติด
 *    อยู่ในภาพแล้ว หน้าเว็บจึงเว้น `<figcaption>` ว่างไว้ (ดูหัวข้อ "ทำเนียบบุคลากร"
 *    ใน AGENTS.md) ที่นี่จึงเดาชื่อจาก `alt` ของรูปให้เป็นตัวตั้งต้น แล้วบอกตรง ๆ ว่า
 *    ชื่อนี้มาจากไหนด้วย `nameSource` — ระบบปลายทางจะได้รู้ว่าอันไหนเชื่อได้แค่ไหน
 *    เจ้าหน้าที่พิมพ์ชื่อจริงทับได้ที่ หลังบ้าน → เชื่อมต่อระบบ
 */

import { db } from "@/lib/db";
import { getSetting } from "@/lib/settings";

/** ชื่อระบบ — โผล่ในผลลัพธ์ทุกก้อน ระบบปลายทางเอาไว้เช็คว่าคุยกับใครอยู่ */
export const BRIDGE_NAME = "CoopBridge";

/**
 * รุ่นของรูปแบบข้อมูล — **เพิ่มเลขนี้เมื่อเปลี่ยนโครงจนของเดิมใช้ไม่ได้**
 * (เปลี่ยนชื่อช่อง · ถอดช่องออก) การเพิ่มช่องใหม่ไม่ต้องเพิ่มเลข
 */
export const BRIDGE_VERSION = 1;

/** คีย์ใน Setting — แยกสองก้อน กันตัวบันทึก "ใครมาอ่านล่าสุด" ไปทับค่าที่ตั้งไว้ */
const CONFIG_KEY = "coopBridge";
const LOG_KEY = "coopBridgeLog";

export type BridgePerson = {
  /** รหัสประจำตัวในชุดข้อมูลนี้ = ชื่อไฟล์รูป (UUID) — คงเดิมตราบใดที่ยังไม่เปลี่ยนรูป */
  id: string;
  /** ลำดับที่ในทำเนียบ เริ่มที่ 1 — เรียงตามที่วางไว้บนหน้าเว็บจริง */
  order: number;
  /** แถวที่เท่าไรบนหน้าเว็บ — ทำเนียบแบ่งเป็นแถว ๆ ตามลำดับความอาวุโส */
  row: number;
  name: string;
  role: string;
  /** ตำแหน่งที่ขึ้นบรรทัดใหม่ไว้ — หน้าที่ปรึกษาเขียนสองบรรทัด (หน่วยงาน / ตำแหน่ง) */
  roleLines: string[];
  /** ที่อยู่รูปแบบเต็ม เอาไปโหลดได้เลย */
  photo: string;
  /** ที่อยู่รูปในเว็บ เช่น "/uploads/xxx.webp" */
  photoPath: string;
  /**
   * ชื่อนี้มาจากไหน — ระบบปลายทางควรเช็คช่องนี้ก่อนเอาไปใช้
   *   caption  = พิมพ์ไว้ใต้รูปในเนื้อหาหน้าเว็บ เชื่อได้
   *   override = เจ้าหน้าที่พิมพ์ให้ที่หลังบ้าน เชื่อได้ที่สุด
   *   alt      = เดาจากคำบรรยายรูป **ยังไม่มีใครตรวจ** อาจสะกดไม่ครบหรือมีเลขลำดับปน
   *   none     = ไม่มีข้อมูลชื่อเลย มีแต่รูป
   */
  nameSource: "override" | "caption" | "alt" | "none";
  /** คำบรรยายรูปดิบ ๆ — เก็บไว้ให้ตรวจสอบย้อนได้ว่าชื่อที่เดามาจากอะไร */
  altText: string;
};

export type BridgeGroup = {
  /** คีย์คงที่สำหรับอ้างถึงกลุ่มนี้ เช่น "board45" "staff" */
  key: string;
  /** ประเภทของกลุ่ม — ใช้จับคู่กับโครงสร้างของระบบปลายทางได้โดยไม่ต้องอ่านชื่อไทย */
  kind: "board" | "auditors" | "nominations" | "advisors" | "staff" | "other";
  title: string;
  /** ที่อยู่หน้าเว็บที่ข้อมูลนี้มาจาก */
  source: string;
  /** แก้ครั้งสุดท้ายเมื่อไร — ระบบปลายทางเอาไว้ดูว่าต้องดึงใหม่ไหม */
  updatedAt: string;
  /** หน้าเว็บซ่อนชื่อใต้รูปอยู่ (รูปมีชื่อพิมพ์ติดมาในภาพแล้ว) */
  captionsHidden: boolean;
  count: number;
  /** จำนวนคนที่ชื่อยังไม่มีใครตรวจ (nameSource = alt หรือ none) */
  needsReview: number;
  people: BridgePerson[];
};

export type BridgeEvent = {
  id: string;
  /** "YYYY-MM-DD" ตามเวลาไทย — ว่าง = รายการเก่าที่ระบุแค่วันที่ในเดือน */
  date: string;
  /** วันที่ในเดือน 1-31 */
  day: number;
  /** mobile = รถโมบาย · project = โครงการ · seminar = สัมมนา */
  type: string;
  title: string;
  place: string | null;
  time: string | null;
  /** มาจากไหน — calendar = เมนูปฏิทินสหกรณ์ · slide = แบนเนอร์ที่ใส่วันจัดกิจกรรมไว้ */
  source: "calendar" | "slide";
};

export type BridgeConfig = {
  /** ปิดที่นี่ = ทุกเส้นทางตอบ 404 เหมือนไม่เคยมี */
  enabled: boolean;
  /** โทเคนที่ระบบปลายทางต้องแนบมาทุกครั้ง — ว่าง = ยังไม่เปิดใช้ */
  token: string;
  /** คีย์กลุ่มที่ **ไม่** แบ่งปัน — เก็บฝั่งซ่อนเพื่อให้ทำเนียบชุดใหม่ถูกแบ่งปันเองทันที */
  hiddenGroups: string[];
  /** ชื่อ/ตำแหน่งที่เจ้าหน้าที่พิมพ์ทับ — คีย์คือรหัสประจำตัว (ชื่อไฟล์รูป) */
  overrides: Record<string, { name?: string; role?: string }>;
  /**
   * ไอพีที่ยอมให้เรียก — ว่าง = ไอพีไหนก็ได้ (ยังต้องมีโทเคนอยู่ดี)
   *
   * ⚠️ เป็นแค่ชั้นเสริม ไม่ใช่ด่านหลัก — ไอพีที่เห็นมาจากหัวคำขอซึ่งตั้งเองได้
   * ถ้าต่อตรงเข้าเครื่องนี้โดยไม่ผ่าน Cloudflare (หลักเดียวกับที่เขียนไว้เรื่องกันเดารหัส)
   */
  allowIps: string[];
};

export type BridgeLog = {
  /** ใครมาอ่านล่าสุด แต่ละชุดข้อมูล */
  reads: Record<string, { at: string; ip: string; count: number }>;
};

export const DEFAULT_CONFIG: BridgeConfig = {
  enabled: true,
  token: "",
  hiddenGroups: [],
  overrides: {},
  allowIps: [],
};

/** อ่านค่าที่ตั้งไว้ — ค่าที่หายหรืออ่านไม่ออกถอยกลับไปใช้ค่าตั้งต้น ไม่คืนก้อนว่าง */
export function fillConfig(raw: unknown): BridgeConfig {
  const v = (raw ?? {}) as Partial<BridgeConfig>;
  const list = (x: unknown) =>
    Array.isArray(x) ? x.filter((s): s is string => typeof s === "string" && s.trim() !== "") : [];

  return {
    // ค่าที่หายไป = ถือว่าเปิด (หลักเดียวกับด่านหน้าวัตถุประสงค์ของโปรแกรมคำนวณดอกเบี้ย)
    enabled: v.enabled !== false,
    token: typeof v.token === "string" ? v.token.trim() : "",
    hiddenGroups: list(v.hiddenGroups),
    overrides:
      v.overrides && typeof v.overrides === "object" && !Array.isArray(v.overrides)
        ? (v.overrides as BridgeConfig["overrides"])
        : {},
    allowIps: list(v.allowIps),
  };
}

export async function getBridgeConfig(): Promise<BridgeConfig> {
  return fillConfig(await getSetting<unknown>(CONFIG_KEY, null));
}

export async function getBridgeLog(): Promise<BridgeLog> {
  const raw = await getSetting<unknown>(LOG_KEY, null);
  const reads = (raw as BridgeLog | null)?.reads;
  return { reads: reads && typeof reads === "object" ? reads : {} };
}

export const BRIDGE_CONFIG_KEY = CONFIG_KEY;
export const BRIDGE_LOG_KEY = LOG_KEY;

/* ------------------------------------------------------------------ *
 * อ่านทำเนียบออกมาจาก HTML ของหน้าเนื้อหา
 * ------------------------------------------------------------------ */

/**
 * ทำไมต้องแกะเอง ไม่ใช้ `src/lib/pageBlocks.ts` ที่มีตัวอ่าน `.people` อยู่แล้ว —
 * ไฟล์นั้นใช้ `DOMParser` ซึ่งมีแต่ในเบราว์เซอร์ ฝั่งเซิร์ฟเวอร์เรียกแล้วได้ก้อนว่าง
 * (เขียนไว้ในหัวไฟล์นั้นเอง) ที่นี่จึงใช้ regex ล้วนแบบเดียวกับ `src/lib/pageHtml.ts`
 */

/** ตัดแท็กออกให้เหลือข้อความล้วน — `<br>` กลายเป็นเว้นวรรค ไม่ใช่หายไปเฉย ๆ */
function plainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * หาตำแหน่ง `</div>` ที่ปิดกล่องซึ่งเริ่มที่ `from` — **นับชั้นเสมอ**
 *
 * ห้ามใช้ `</div>` ตัวแรกที่เจอ (กฎเดียวกับ `htmlStructure.ts` และ `welfareGroups.ts`)
 * ตอนนี้กล่อง `.people` ยังไม่มี `<div>` ซ้อนข้างใน แต่วันหลังใครใส่เข้ามาแล้วจะพังเงียบ ๆ
 */
function closingDiv(html: string, from: number): number {
  const tag = /<div\b|<\/div>/gi;
  tag.lastIndex = from;
  let depth = 0;

  for (let m = tag.exec(html); m; m = tag.exec(html)) {
    if (m[0].toLowerCase().startsWith("</")) {
      depth -= 1;
      if (depth === 0) return m.index;
    } else {
      depth += 1;
    }
  }
  return html.length;
}

/** ตัดเลขลำดับกับขีดคั่นออกจากคำบรรยายรูป — "01-สุจิตร" → "สุจิตร" */
function nameFromAlt(alt: string): string {
  return alt
    .replace(/^\s*\d+\s*[.)\-_]*\s*/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const ATTR = (html: string, name: string): string => {
  const m = new RegExp(`${name}\\s*=\\s*"([^"]*)"`, "i").exec(html);
  return m ? m[1].trim() : "";
};

/** รหัสประจำตัว = ชื่อไฟล์รูปโดยไม่เอานามสกุล ("/uploads/f552….webp" → "f552…") */
function idFromPhoto(path: string): string {
  const file = path.split("/").pop() ?? "";
  return file.replace(/\.[a-z0-9]+$/i, "") || file;
}

/** อ่านคนทั้งหมดในหน้าหนึ่ง — คืนตามลำดับที่วางไว้บนหน้าเว็บจริง */
export function readPeople(
  html: string,
  base: string,
  overrides: BridgeConfig["overrides"],
): { people: BridgePerson[]; captionsHidden: boolean } {
  const people: BridgePerson[] = [];
  let captionsHidden = false;
  let row = 0;

  const open = /<div\b[^>]*class="([^"]*)"[^>]*>/gi;

  for (let m = open.exec(html); m; m = open.exec(html)) {
    const classes = m[1].split(/\s+/);
    if (!classes.includes("people")) continue;

    row += 1;
    if (classes.includes("no-caption")) captionsHidden = true;

    const end = closingDiv(html, m.index);
    const inner = html.slice(m.index, end);

    const figures = inner.match(/<figure\b[\s\S]*?<\/figure>/gi) ?? [];
    for (const figure of figures) {
      const img = /<img\b[^>]*>/i.exec(figure)?.[0] ?? "";
      const photoPath = ATTR(img, "src");
      const altText = ATTR(img, "alt");

      const caption =
        /<span[^>]*class="[^"]*person-name[^"]*"[^>]*>([\s\S]*?)<\/span>/i.exec(figure)?.[1] ??
        // ไม่มี span ชื่อ = ทั้ง figcaption คือชื่อ (หน้าทำเนียบเก่าเขียนแบบนี้)
        /<figcaption[^>]*>([\s\S]*?)<\/figcaption>/i.exec(figure)?.[1] ??
        "";
      const roleHtml =
        /<span[^>]*class="[^"]*person-role[^"]*"[^>]*>([\s\S]*?)<\/span>/i.exec(figure)?.[1] ?? "";

      const id = idFromPhoto(photoPath);
      const fix = overrides[id] ?? {};
      const fromCaption = plainText(caption);
      const fromAlt = nameFromAlt(altText);

      const name = (fix.name ?? "").trim() || fromCaption || fromAlt;
      const nameSource: BridgePerson["nameSource"] = (fix.name ?? "").trim()
        ? "override"
        : fromCaption
          ? "caption"
          : fromAlt
            ? "alt"
            : "none";

      const roleText = (fix.role ?? "").trim() || plainText(roleHtml);

      people.push({
        id,
        order: people.length + 1,
        row,
        name,
        role: roleText,
        roleLines: (fix.role ?? "").trim()
          ? [roleText]
          : roleHtml
              .split(/<br\s*\/?>/i)
              .map(plainText)
              .filter(Boolean),
        photo: photoPath ? `${base}${photoPath}` : "",
        photoPath,
        nameSource,
        altText,
      });
    }
  }

  return { people, captionsHidden };
}

/* ------------------------------------------------------------------ *
 * ชุดข้อมูลที่แบ่งปัน
 * ------------------------------------------------------------------ */

/** เดาประเภทกลุ่มจากที่อยู่หน้า — ระบบปลายทางจะได้ไม่ต้องอ่านชื่อไทยเอง */
function kindOf(slug: string): BridgeGroup["kind"] {
  const last = slug.split("/").pop() ?? "";
  if (last.startsWith("board")) return "board";
  if (last.startsWith("auditor")) return "auditors";
  if (last.startsWith("nomination")) return "nominations";
  if (last.startsWith("advisor")) return "advisors";
  if (last.startsWith("staff") || last.startsWith("officer")) return "staff";
  return "other";
}

/** ที่อยู่เว็บแบบเต็มสำหรับประกอบเป็นลิงก์รูป */
export function siteBase(): string {
  return (process.env.PUBLIC_SITE_URL ?? "https://spsccoop.org").replace(/\/+$/, "");
}

/**
 * ทำเนียบทั้งหมด — **ไม่ได้ไล่ตามรายชื่อหน้าที่เขียนตายไว้ในโค้ด**
 *
 * ไล่จากหน้าเนื้อหาที่เผยแพร่แล้วใต้ `about/directory/` ที่มีทำเนียบอยู่จริง
 * พอปีหน้าเปลี่ยนเป็น "ชุดที่ 46" (สร้างหน้าใหม่ในหลังบ้าน) ก็โผล่มาเองทันที
 * ไม่มีใครต้องมาแก้โค้ด — และหน้าไหนที่เจ้าหน้าที่ยังไม่เผยแพร่ก็จะไม่หลุดออกไป
 */
export async function getDirectory(config: BridgeConfig): Promise<BridgeGroup[]> {
  const pages = await db.page.findMany({
    where: { published: true, slug: { startsWith: "about/directory" } },
    orderBy: { slug: "asc" },
    select: { slug: true, title: true, body: true, updatedAt: true },
  });

  const base = siteBase();
  const groups: BridgeGroup[] = [];

  for (const page of pages) {
    const key = page.slug.split("/").pop() ?? page.slug;
    if (config.hiddenGroups.includes(key)) continue;

    const { people, captionsHidden } = readPeople(page.body, base, config.overrides);
    // หน้าที่ไม่มีรูปคนเลย (เช่นหน้ารวมที่มีแต่การ์ดลิงก์) ไม่ใช่ทำเนียบ ข้ามไป
    if (people.length === 0) continue;

    groups.push({
      key,
      kind: kindOf(page.slug),
      title: page.title,
      source: `/${page.slug}/`,
      updatedAt: page.updatedAt.toISOString(),
      captionsHidden,
      count: people.length,
      needsReview: people.filter((p) => p.nameSource === "alt" || p.nameSource === "none").length,
      people,
    });
  }

  return groups;
}

/** วันที่แบบไทย "YYYY-MM-DD" ของค่าที่เก็บเป็นเที่ยงคืนเวลาไทย (= 17:00Z ของวันก่อนหน้า) */
const thaiYmd = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(d);

/**
 * กิจกรรมบนปฏิทิน — รวมสองต้นทางให้แล้ว
 *
 * หน้าแรกของเว็บโชว์ทีละเดือน แต่ที่นี่ส่งไปทั้งหมด ระบบปลายทางจะกรองเองก็ได้
 * (เว็บกรองเดือนปัจจุบันใน `getCalendarEvents()` — ที่นี่ตั้งใจไม่กรอง)
 */
export async function getCalendar(): Promise<BridgeEvent[]> {
  const [rows, slides] = await Promise.all([
    db.calendarEvent.findMany({
      where: { published: true },
      orderBy: [{ date: "asc" }, { day: "asc" }],
    }),
    db.slide.findMany({
      where: { published: true, eventDate: { not: null } },
      orderBy: { eventDate: "asc" },
      select: { id: true, title: true, caption: true, eventDate: true, eventType: true },
    }),
  ]);

  const fromTable: BridgeEvent[] = rows.map((r) => ({
    id: r.id,
    date: r.date ? thaiYmd(r.date) : "",
    day: r.day,
    type: r.type,
    title: r.title,
    place: r.place,
    time: r.time,
    source: "calendar",
  }));

  const fromSlides: BridgeEvent[] = slides.map((s) => {
    const date = thaiYmd(s.eventDate as Date);
    return {
      id: `slide-${s.id}`,
      date,
      day: Number(date.slice(8)),
      type: s.eventType ?? "project",
      title: s.title,
      place: s.caption,
      time: null,
      source: "slide",
    };
  });

  return [...fromTable, ...fromSlides].sort((a, b) => a.date.localeCompare(b.date));
}
