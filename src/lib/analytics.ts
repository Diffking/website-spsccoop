import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { publicPaths } from "@/lib/publicPaths";

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

/** ชื่อหน้าที่อ่านง่ายสำหรับกราฟ — path ที่ไม่รู้จักใช้ path เดิมไปก่อน */
const PAGE_LABELS: Record<string, string> = {
  "/": "หน้าแรก",
  "/splash": "หน้าวันสำคัญ",
  "/about/directory/board": "คณะกรรมการดำเนินการ",
};

/**
 * จำนวนครั้งที่เปิดเว็บรายปี (พ.ศ.) — ปีที่ยังไม่มีข้อมูลจะไม่ถูกใส่มา
 * นับหน่วยเดียวกับตัวนับสะสมที่ท้ายเว็บ คือ "ครั้ง" ไม่ใช่ "คน"
 */
export async function visitsByYear(): Promise<YearPoint[]> {
  try {
    const rows = await db.pageView.findMany({ select: { day: true, count: true } });
    const byYear = new Map<number, number>();

    for (const row of rows) {
      // +543 = พ.ศ. · ใช้ปีตามเวลาไทยให้ตรงกับตอนบันทึก
      const year =
        Number(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric" }).format(row.day)) + 543;
      byYear.set(year, (byYear.get(year) ?? 0) + row.count);
    }

    return [...byYear.entries()]
      .map(([year, visits]) => ({ year, visits }))
      .sort((a, b) => a.year - b.year);
  } catch (error) {
    console.error("อ่านสถิติรายปีไม่ได้:", error);
    return [];
  }
}

/**
 * ยอดเข้าชมสะสม (ครั้ง) = ยอดยกมาจากเว็บเดิม + ที่ระบบนี้นับได้เอง
 *
 * **นับเป็นครั้ง ไม่ใช่คน** — คนเดิมเปิดเว็บสิบรอบก็นับสิบครั้ง เป็นตัวนับแบบเดียว
 * กับที่เว็บเดิมใช้มาตลอด เปิดหน้าเว็บกี่หน้าก็เดินหน้าไปเท่านั้นครั้ง
 * (จำนวน "คน" ยังเก็บอยู่ที่ VisitorDay ใช้ดูแยกได้ในหน้าภาพรวม)
 *
 * เว็บเดิมนับมาหลายปีก่อนจะย้ายมาระบบนี้ ถ้าเริ่มนับใหม่จากศูนย์ ตัวเลขบนหน้าเว็บ
 * จะร่วงจากสองแสนกว่าเหลือหลักสิบ เหมือนเว็บเพิ่งเปิด จึงยกยอดเดิมมาเป็นจุดตั้งต้น
 * แล้วนับต่อจากตรงนั้น · ยอดยกมาแก้ได้ที่หลังบ้าน (ส่วนท้ายเว็บ) ไม่ได้ฝังไว้ในโค้ด
 */
export async function visitTotal(carriedOver: number): Promise<number> {
  try {
    const sum = await db.pageView.aggregate({ _sum: { count: true } });
    return carriedOver + (sum._sum.count ?? 0);
  } catch (error) {
    console.error("อ่านยอดเข้าชมสะสมไม่ได้:", error);
    // ฐานล่มก็ยังต้องโชว์ยอดยกมา ดีกว่าโชว์ 0 ให้สมาชิกเห็น
    return carriedOver;
  }
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

    return rows.map((row) => ({
      page: PAGE_LABELS[row.path] ?? row.path,
      views: row._sum.count ?? 0,
    }));
  } catch (error) {
    console.error("อ่านหน้ายอดนิยมไม่ได้:", error);
    return [];
  }
}
