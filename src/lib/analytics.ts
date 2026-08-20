import { createHash } from "node:crypto";
import { db } from "@/lib/db";

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

/**
 * นับเฉพาะคนที่เปิดโดเมนสาธารณะจริง (www.spsccoop.com)
 *
 * เว็บเดียวกันเปิดได้หลายทาง: สมาชิกเข้า www.spsccoop.com · เจ้าหน้าที่กับตัวมิเรอร์
 * เข้า coopsmile.org ตรง ๆ ถ้านับหมดทุกทาง ยอดจะบวกงานของเจ้าหน้าที่กับการทดสอบเข้าไปด้วย
 * ตัวเลขในหน้าภาพรวมจึงไม่ใช่ยอดผู้เข้าชมจริง
 *
 * ตัวมิเรอร์บนโฮสต์บอกโดเมนที่คนเปิดจริงมาทางหัว x-public-host (ดู php-frontend/index.php)
 * เปลี่ยนโดเมนที่นับได้ที่ ANALYTICS_HOST ใน .env
 */
export function countedHost(raw: string | null | undefined): boolean {
  const host = (raw ?? "").split(":")[0].trim().toLowerCase();
  if (!host) return false;

  // ตอนพัฒนาในเครื่องต้องนับได้ ไม่งั้นทดสอบไม่ได้เลย (เว็บจริงตั้ง NODE_ENV=production)
  if (process.env.NODE_ENV !== "production" && (host === "localhost" || host === "127.0.0.1")) {
    return true;
  }

  const counted = (process.env.ANALYTICS_HOST ?? "spsccoop.com").trim().toLowerCase();
  return host === counted || host.endsWith(`.${counted}`);
}

function fingerprint(ip: string, userAgent: string, day: Date): string {
  // ค่าลับกันคนเดารหัสย้อนกลับ — ไม่ตั้งก็ยังใช้ได้ แค่ค่าเดาง่ายขึ้น
  const salt = process.env.ANALYTICS_SALT ?? "coopsmile";
  return createHash("sha256")
    .update(`${ip}|${userAgent}|${day.toISOString()}|${salt}`)
    .digest("hex");
}

/** บันทึกการเข้าชมหนึ่งครั้ง — เงียบเสมอ ไม่ให้กระทบการแสดงหน้าเว็บ */
export async function record(path: string, ip: string, userAgent: string): Promise<void> {
  if (!shouldTrack(path)) return;

  const day = thaiDay();
  // ตัด query string และ trailing slash ให้เหลือรูปเดียว ไม่งั้นหน้าเดียวจะถูกนับแยกกัน
  const clean = (path.split("?")[0].replace(/\/+$/, "") || "/").slice(0, 200);

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

export type YearPoint = { year: number; visitors: number };
export type PagePoint = { page: string; views: number };

/** ชื่อหน้าที่อ่านง่ายสำหรับกราฟ — path ที่ไม่รู้จักใช้ path เดิมไปก่อน */
const PAGE_LABELS: Record<string, string> = {
  "/": "หน้าแรก",
  "/splash": "หน้าวันสำคัญ",
  "/about/directory/board": "คณะกรรมการดำเนินการ",
};

/** จำนวนคนรายปี (พ.ศ.) — ปีที่ยังไม่มีข้อมูลจะไม่ถูกใส่มา */
export async function visitorsByYear(): Promise<YearPoint[]> {
  try {
    const rows = await db.visitorDay.findMany({ select: { day: true } });
    const byYear = new Map<number, number>();

    for (const row of rows) {
      // +543 = พ.ศ. · ใช้ปีตามเวลาไทยให้ตรงกับตอนบันทึก
      const year =
        Number(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric" }).format(row.day)) + 543;
      byYear.set(year, (byYear.get(year) ?? 0) + 1);
    }

    return [...byYear.entries()]
      .map(([year, visitors]) => ({ year, visitors }))
      .sort((a, b) => a.year - b.year);
  } catch (error) {
    console.error("อ่านสถิติรายปีไม่ได้:", error);
    return [];
  }
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
