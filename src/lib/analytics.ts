import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { publicPaths } from "@/lib/publicPaths";
import { fiscalRange, fiscalYearOf } from "@/lib/galleryShared";

/**
 * นับผู้เข้าชมเว็บเอง ไม่ใช้บริการภายนอก
 *
 * เก็บสองอย่าง: จำนวนครั้งที่เปิดแต่ละหน้ารายวัน (PageView) และจำนวนคนรายวัน (VisitorDay)
 * ไม่เก็บ IP ไม่เก็บ cookie ไม่ตามรอยข้ามวัน — ลายนิ้วมือถูกแฮชรวมกับวันที่
 * ทำให้คนเดิมกลายเป็นค่าใหม่ทุกวัน และย้อนกลับเป็น IP ไม่ได้
 */

/** วันที่ตามเวลาไทย ตัดเป็นเที่ยงคืน — เก็บให้ตรงกับที่คนไทยเข้าใจว่า "วันนี้" */
export function thaiDay(at = new Date()): Date {
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(at);
  return new Date(`${ymd}T00:00:00+07:00`);
}

/** ไม่ต้องนับหน้าหลังบ้าน ไฟล์ระบบ หรือ API */
export function shouldTrack(path: string): boolean {
  return !/^\/(admin|api|_next|uploads|robots\.txt|sitemap\.xml)/.test(path);
}

/** อ่านรายชื่อโดเมนจาก .env — คั่นด้วยจุลภาค เว้นวรรคได้ ตัวพิมพ์ใหญ่เล็กไม่สำคัญ */
function hostList(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * นับคนที่เปิดหน้าเว็บ **ทุกโดเมนสาธารณะ** — เข้าทาง spsccoop.com หรือ spsccoop.org
 * ก็คือคนที่มาอ่านเว็บของสหกรณ์เหมือนกัน ยอดจึงต้องรวมกัน
 *
 * (เดิมนับเฉพาะ spsccoop.com เพราะกลัวยอดปนงานของเจ้าหน้าที่ แต่หน้าหลังบ้านไม่เคยถูกนับ
 * อยู่แล้ว — shouldTrack ตัด /admin ทิ้ง และตัวแจ้งนับก็ติดอยู่แต่บนหน้าเว็บสาธารณะ)
 *
 * โดเมนของหลังบ้านไม่นับเสมอ ถึงจะเป็นโดเมนย่อยของโดเมนที่นับก็ตาม —
 * admin.spsccoop.org ลงท้ายด้วย .spsccoop.org ถ้าไม่กันไว้จะถูกนับไปด้วย
 *
 * ตัวมิเรอร์บนโฮสต์บอกโดเมนที่คนเปิดจริงมาทางหัว x-public-host (ดู php-frontend/index.php)
 * เปลี่ยนรายชื่อโดเมนได้ที่ ANALYTICS_HOST ใน .env (คั่นด้วยจุลภาค)
 */
export function countedHost(raw: string | null | undefined): boolean {
  const host = (raw ?? "").split(":")[0].trim().toLowerCase();
  if (!host) return false;

  // ตอนพัฒนาในเครื่องต้องนับได้ ไม่งั้นทดสอบไม่ได้เลย (เว็บจริงตั้ง NODE_ENV=production)
  if (process.env.NODE_ENV !== "production" && (host === "localhost" || host === "127.0.0.1")) {
    return true;
  }

  if (hostList(process.env.ADMIN_HOST).includes(host)) return false;

  const counted = hostList(process.env.ANALYTICS_HOST ?? "spsccoop.com,spsccoop.org");
  return counted.some((c) => host === c || host.endsWith(`.${c}`));
}

function fingerprint(ip: string, userAgent: string, day: Date): string {
  // ค่าลับกันคนเดารหัสย้อนกลับ — ไม่ตั้งก็ยังใช้ได้ แค่ค่าเดาง่ายขึ้น
  const salt = process.env.ANALYTICS_SALT ?? "coopsmile";
  return createHash("sha256")
    .update(`${ip}|${userAgent}|${day.toISOString()}|${salt}`)
    .digest("hex");
}

/**
 * ที่อยู่ของหน้าที่มีอยู่จริง — เก็บไว้ในหน่วยความจำสั้น ๆ
 *
 * ตัวแจ้งนับถูกยิงทุกครั้งที่มีคนเปิดหน้า ถ้าไปถามฐานทุกครั้งจะเปลืองเปล่า ๆ
 * ห้านาทีพอ — เพิ่มหน้าใหม่แล้วรออีกนิดเดียวก็เริ่มนับ
 */
let knownPaths: { at: number; set: Set<string> } | null = null;
const KNOWN_TTL_MS = 5 * 60_000;

async function isRealPage(path: string): Promise<boolean> {
  // หน้าอ่าน PDF กับ E-Book สร้างที่อยู่จากรหัสไฟล์ ไม่ได้อยู่ในรายการหน้าเว็บ
  if (path === "/read" || /^\/ebook\/[A-Za-z0-9_-]{1,40}$/.test(path)) return true;

  if (!knownPaths || Date.now() - knownPaths.at > KNOWN_TTL_MS) {
    const list = await publicPaths();
    knownPaths = {
      at: Date.now(),
      set: new Set(list.map((p) => p.replace(/\/+$/, "") || "/")),
    };
  }
  return knownPaths.set.has(path);
}

/**
 * บันทึกการเข้าชมหนึ่งครั้ง — เงียบเสมอ ไม่ให้กระทบการแสดงหน้าเว็บ
 *
 * **นับเฉพาะที่อยู่ของหน้าที่มีอยู่จริง** — เส้นทางนี้เปิดให้ยิงได้โดยไม่ต้องล็อกอิน
 * (หน้าเว็บต้องยิงเองได้) ถ้ารับที่อยู่อะไรก็ได้ คนไม่หวังดีจะยิงที่อยู่มั่ว ๆ
 * สร้างแถวใหม่ได้ไม่จำกัด ทั้งทำให้ฐานบวม ไฟล์สำรองใหญ่ ตัวเลขบนเว็บเพี้ยน
 * และหน้ายอดนิยมในหลังบ้านเต็มไปด้วยขยะ (ทดสอบแล้วว่ายิงได้จริง 20 ส.ค. 2026)
 */
export async function record(path: string, ip: string, userAgent: string): Promise<void> {
  if (!shouldTrack(path)) return;

  const day = thaiDay();
  // ตัด query string และ trailing slash ให้เหลือรูปเดียว ไม่งั้นหน้าเดียวจะถูกนับแยกกัน
  const clean = (path.split("?")[0].replace(/\/+$/, "") || "/").slice(0, 200);

  if (!(await isRealPage(clean))) return;

  try {
    await db.pageView.upsert({
      where: { path_day: { path: clean, day } },
      create: { path: clean, day, count: 1 },
      update: { count: { increment: 1 } },
    });

    // ซ้ำในวันเดียวกัน = คนเดิม ไม่นับเพิ่ม (unique constraint จัดการให้)
    await db.visitorDay.createMany({
      data: [{ fingerprint: fingerprint(ip, userAgent, day), day }],
      skipDuplicates: true,
    });
  } catch (error) {
    console.error("บันทึกสถิติผู้เข้าชมไม่สำเร็จ:", error);
  }
}

export type YearPoint = { year: number; visits: number };
export type PagePoint = { page: string; views: number };

/**
 * ชื่อหน้าที่อ่านง่ายสำหรับกราฟ — เฉพาะเส้นทางที่ **ไม่ได้** เป็นหน้าเนื้อหาในฐาน
 *
 * หน้าเนื้อหาทั่วไปดึงชื่อจากตาราง Page เอง (ดู `pageTitles()`) เจ้าหน้าที่ตั้งชื่อหน้า
 * ใหม่เมื่อไหร่ในสถิติก็เปลี่ยนตาม ไม่ต้องมาเติมรายชื่อในโค้ดทีละอัน
 */
const PAGE_LABELS: Record<string, string> = {
  "/": "หน้าแรก",
  "/splash": "หน้าวันสำคัญ",
  "/read": "อ่านเอกสาร (เปิดไฟล์ PDF)",
  "/contact": "ติดต่อเรา",
  "/about/directory/board": "คณะกรรมการดำเนินการ",
};

/**
 * ชื่อหน้าจากฐาน — คีย์เป็น "/" + slug ให้ตรงกับ path ที่ตัวนับเก็บไว้
 * ฐานสะดุดก็คืนแมปว่าง แล้วกราฟจะโชว์เป็น path เดิม ไม่พังทั้งหน้า
 */
async function pageTitles(): Promise<Map<string, string>> {
  try {
    const rows = await db.page.findMany({ select: { slug: true, title: true } });
    return new Map(rows.map((r) => [`/${r.slug}`, r.title]));
  } catch {
    return new Map();
  }
}

/** ชื่อที่เอาไปโชว์ — รายชื่อตายตัวมาก่อน แล้วค่อยชื่อจากฐาน แล้วค่อย path เดิม */
function pageLabel(path: string, titles: Map<string, string>): string {
  if (PAGE_LABELS[path]) return PAGE_LABELS[path];
  // หนังสืออิเล็กทรอนิกส์สร้าง path จากรหัสไฟล์ ไม่มีในตาราง Page
  if (path.startsWith("/ebook/")) return "หนังสืออิเล็กทรอนิกส์";
  return titles.get(path.replace(/\/$/, "")) ?? path;
}

/**
 * จำนวนครั้งที่เปิดเว็บราย "ปีบัญชี" (1 ต.ค. – 30 ก.ย. ตั้งชื่อตามปี พ.ศ. ที่สิ้นสุด)
 * ปีที่ยังไม่มีข้อมูลจะไม่ถูกใส่มา · หน่วย "ครั้ง" เหมือนตัวนับท้ายเว็บ
 *
 * เดิมจัดกลุ่มตามปีปฏิทิน แต่หน้าภาพรวมเขียนป้ายว่า "ปีบัญชี" — แก้ให้ตรงกัน 19 พ.ย. 2569
 */
export async function visitsByYear(): Promise<YearPoint[]> {
  return (await fiscalVisitRows()).map(({ year, visits }) => ({ year, visits }));
}

type FiscalRow = { year: number; visits: number; firstDay: Date; lastDay: Date };

/** รวม PageView ตามปีบัญชี พร้อมวันแรก/วันสุดท้ายที่มีข้อมูล (บอกว่าปีไหนนับได้ไม่ครบ) */
async function fiscalVisitRows(): Promise<FiscalRow[]> {
  try {
    const rows = await db.pageView.groupBy({ by: ["day"], _sum: { count: true } });
    const byYear = new Map<number, FiscalRow>();
    for (const row of rows) {
      // day เก็บเป็นเที่ยงคืนเวลาไทย · fiscalYearOf คิดตามเวลาไทยเหมือนกัน 1 ต.ค. จึงตกปีใหม่ถูก
      const year = fiscalYearOf(row.day);
      const visits = row._sum.count ?? 0;
      const cur = byYear.get(year);
      if (!cur) byYear.set(year, { year, visits, firstDay: row.day, lastDay: row.day });
      else {
        cur.visits += visits;
        if (row.day < cur.firstDay) cur.firstDay = row.day;
        if (row.day > cur.lastDay) cur.lastDay = row.day;
      }
    }
    return [...byYear.values()].sort((a, b) => a.year - b.year);
  } catch (error) {
    console.error("อ่านสถิติรายปีไม่ได้:", error);
    return [];
  }
}

/**
 * ตัวนับท้ายเว็บ — จำนวนครั้งที่เปิดเว็บ "ในปีบัญชีปัจจุบัน" (เจ้าของเว็บสั่ง 19 พ.ย. 2569)
 *
 * เริ่มนับใหม่เองทุก 1 ต.ค. เวลาไทย ไม่มีใครต้องไปกดรีเซ็ต และไม่ลบข้อมูลอะไรเลย
 * แค่เลือกช่วงวันที่ตอนรวม · ยอดปีก่อน ๆ ดูได้ที่หลังบ้าน → สถิติผู้เข้าชมรายปี (ADMIN)
 *
 * **นับเป็นครั้ง ไม่ใช่คน** — คนเดิมเปิดเว็บสิบรอบก็นับสิบครั้ง แบบเดียวกับเว็บเดิม
 * · เดิมเป็นยอดสะสม = ยอดยกมาจากเว็บเดิม (`visitorCarriedOver` 228,000) + ที่ระบบนับ
 *   ค่านั้นยังอยู่ใน Setting แต่ไม่ได้ใช้คิดแล้ว
 */
export async function fiscalVisitTotal(at = new Date()): Promise<{ year: number; visits: number }> {
  const year = fiscalYearOf(at);
  const { from, to } = fiscalRange(year);
  try {
    const sum = await db.pageView.aggregate({
      _sum: { count: true },
      where: { day: { gte: from, lt: to } },
    });
    return { year, visits: sum._sum.count ?? 0 };
  } catch (error) {
    console.error("อ่านยอดเข้าชมปีบัญชีนี้ไม่ได้:", error);
    return { year, visits: 0 };
  }
}

/** ยอดที่ไอทีพิมพ์เองรายปีบัญชี — Setting["visitorYearManual"] = { "2566": 123456 } */
export const VISITOR_MANUAL_KEY = "visitorYearManual";
/** แสดงปีบัญชีปัจจุบัน + ย้อนหลังกี่ปี */
export const VISITOR_HISTORY_YEARS = 5;

export type FiscalHistoryRow = {
  year: number;
  /** ที่ระบบนี้นับได้ — null = ไม่มีข้อมูลเลยในปีนั้น */
  system: number | null;
  /** ระบบนับได้ไม่ครบปี (เริ่มนับกลางปี / ปีปัจจุบันยังไม่จบ) — วันแรก-วันสุดท้ายที่มีข้อมูล */
  firstDay: Date | null;
  lastDay: Date | null;
  /** ยอดที่ไอทีพิมพ์เอง — มีค่าเมื่อไหร่ใช้ค่านี้แทนยอดของระบบทั้งปี */
  manual: number | null;
  /** ยอดที่ใช้จริง = manual ?? system ?? null */
  shown: number | null;
};

/** ตารางสถิติรายปี: ปีบัญชีปัจจุบัน + 5 ปีย้อนหลัง เรียงใหม่ไปเก่า · ขึ้นปีใหม่เลื่อนเอง */
export async function fiscalVisitHistory(
  manual: Record<string, number>,
  at = new Date(),
): Promise<FiscalHistoryRow[]> {
  const current = fiscalYearOf(at);
  const rows = new Map((await fiscalVisitRows()).map((r) => [r.year, r]));
  return Array.from({ length: VISITOR_HISTORY_YEARS + 1 }, (_, i) => {
    const year = current - i;
    const r = rows.get(year);
    // ปีปัจจุบันใช้ยอดสดของระบบเสมอ ให้ตรงกับตัวนับท้ายเว็บ — ไม่รับยอดพิมพ์เอง
    const typed = i > 0 && Number.isFinite(manual[String(year)]) ? manual[String(year)] : null;
    const system = r ? r.visits : null;
    return {
      year,
      system,
      firstDay: r?.firstDay ?? null,
      lastDay: r?.lastDay ?? null,
      manual: typed,
      shown: typed ?? system,
    };
  });
}

/** จำนวน "คน" สะสม — นับคนเดิมที่มาคนละวันเป็นคนละครั้ง (ลายนิ้วมือเปลี่ยนทุกวัน) */
export async function uniqueVisitors(): Promise<number> {
  try {
    return await db.visitorDay.count();
  } catch (error) {
    console.error("อ่านจำนวนคนไม่ได้:", error);
    return 0;
  }
}

/** อ่านตัวเลขที่พิมพ์มาพร้อมคอมมา ("228,000") เป็นจำนวน — อ่านไม่ออกคืน 0 */
export function parseCount(raw: string | undefined | null): number {
  const digits = (raw ?? "").replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

/** หน้าที่เปิดดูมากที่สุดย้อนหลัง 12 เดือน */
export async function popularPages(take = 5): Promise<PagePoint[]> {
  try {
    const since = new Date(Date.now() - 365 * 86_400_000);
    const rows = await db.pageView.groupBy({
      by: ["path"],
      where: { day: { gte: since } },
      _sum: { count: true },
      orderBy: { _sum: { count: "desc" } },
      take,
    });

    const titles = await pageTitles();
    return rows.map((row) => ({
      page: pageLabel(row.path, titles),
      views: row._sum.count ?? 0,
    }));
  } catch (error) {
    console.error("อ่านหน้ายอดนิยมไม่ได้:", error);
    return [];
  }
}
