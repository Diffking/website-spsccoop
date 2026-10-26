import { db } from "@/lib/db";
import { publicRoot } from "@/lib/survey";
import { acceptQueued } from "@/lib/surveyIntake";
import { openSealed, queueKeys } from "@/lib/surveyQueue";

/**
 * คุยกับ Cloudflare Worker ที่ survey.spsccoop.org (cloudflare/survey-edge/) — ทิศ เครื่องนี้ → Cloudflare
 * **ไม่แตะโฮสต์ spsccoop.com เลย** จึงเรียกถี่ได้โดยไม่เสี่ยงโดนแบน
 *
 *   pullQueue() ดึงคำตอบที่ Worker พักไว้ตอนเครื่องปิด → รับเข้า (รอตรวจ) → สั่ง Worker ลบ/เก็บเป็นรายการเสีย
 *   warmEdge()  ให้ Worker เก็บสำเนาหน้าแบบประเมินที่เปิดรับอยู่ + ลิงก์กรรมการ ไว้เสิร์ฟตอนเครื่องปิด
 *
 * เรียกจาก POST /api/survey/pull ทุก 10 นาที (service survey-verify)
 * Worker ยังไม่ได้ขึ้น / ต่อไม่ได้ = คืน error เงียบ ๆ รอบหน้าลองใหม่ ไม่กระทบอย่างอื่น
 */

/** ที่อยู่ Worker — ตั้งแยกได้ที่ SURVEY_EDGE_URL (ทดสอบบนเครื่อง) ไม่ตั้ง = โดเมนลิงก์แบบประเมิน */
export const edgeBase = () => (process.env.SURVEY_EDGE_URL || publicRoot(process.env.SURVEY_PUBLIC_URL)).replace(/\/+$/, "");

type EdgeItem = { id: string; path: string; sealed: string; queuedAt: number };

export type PullReport = { fetched: number; accepted: number; dead: number; retry: number; error?: string };

export async function pullQueue(limit = 100): Promise<PullReport> {
  const report: PullReport = { fetched: 0, accepted: 0, dead: 0, retry: 0 };
  const { token } = await queueKeys();
  const headers = { "x-queue-token": token, "content-type": "application/json" };

  let items: EdgeItem[];
  try {
    const r = await fetch(`${edgeBase()}/__queue?limit=${limit}`, { headers, signal: AbortSignal.timeout(20_000) });
    if (!r.ok) return { ...report, error: `Worker ตอบ ${r.status}` };
    items = ((await r.json()) as { items: EdgeItem[] }).items ?? [];
  } catch (e) {
    return { ...report, error: e instanceof Error ? e.message : "ต่อ Worker ไม่ได้" };
  }
  report.fetched = items.length;
  if (!items.length) return report;

  const done: string[] = [];
  const dead: { id: string; error: string }[] = [];
  for (const item of items) {
    const code = /^\/api\/survey\/([a-z0-9]{4,12})\/queue\/?$/.exec(item.path)?.[1];
    const plain = code ? await openSealed(safeJson(item.sealed)) : null;
    const body = plain ? safeJson(plain) : null;
    if (!code || !body || typeof body !== "object") {
      dead.push({ id: item.id, error: "ไขรายการไม่ได้" });
      continue;
    }
    // เวลาที่ส่งจริง = เวลาที่ Worker รับ (เชื่อได้ — ได้มาจากช่องทางที่มีโทเคน) ไม่เกินเวลาตอนนี้
    const submittedAt = new Date(Math.min(item.queuedAt * 1000, Date.now()));
    try {
      const res = await acceptQueued(code, body as Record<string, unknown>, { submittedAt, queueId: `edge:${item.id}` });
      if (res.status < 300) done.push(item.id);
      // 5xx = ฝั่งเรายังไม่พร้อม (เช่น ยังไม่ได้ตั้ง pepper) ไม่ใช่ของเสีย — ค้างในกล่องไว้รอบหน้า
      else if (res.status >= 500) report.retry += 1;
      else dead.push({ id: item.id, error: String(res.body.error ?? res.status).slice(0, 250) });
    } catch (e) {
      // ฐานของเราสะดุด — ไม่ลบจากกล่อง รอบหน้าค่อยลองใหม่
      console.error("รับคำตอบจาก Worker ไม่สำเร็จ:", e);
      report.retry += 1;
    }
  }

  try {
    await fetch(`${edgeBase()}/__queue/ack`, {
      method: "POST",
      headers,
      body: JSON.stringify({ done, dead }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (e) {
    // ack หาย = รอบหน้าได้รายการเดิมซ้ำ → queueId กันบันทึกซ้ำให้แล้ว (ถือว่าสำเร็จ)
    console.error("แจ้ง Worker ลบรายการไม่สำเร็จ:", e);
  }
  report.accepted = done.length;
  report.dead = dead.length;
  return report;
}

const safeJson = (s: string): unknown => {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
};

/**
 * ให้ Worker เก็บสำเนาหน้าที่ต้องเปิดได้ตอนเครื่องปิด — ส่งหัว x-edge-warm (โทเคน) Worker จะเก็บหน้า
 * พร้อมไฟล์ /_next/static ที่หน้านั้นเรียกใช้ทั้งหมด · ไม่ทำ = หน้าใหม่ที่ยังไม่มีใครเปิดจะเปิดไม่ขึ้นตอนกลางคืน
 */
export async function warmEdge(): Promise<{ pages: number; error?: string }> {
  const now = new Date();
  // ปิดไปไม่เกิน 30 วันก็ยังอุ่นต่อ — สำเนาบน Worker จะได้กลายเป็นหน้า "ปิดรับแล้ว"
  // ไม่งั้นกด "สิ้นสุดการประเมิน" แล้ว สำเนาเก่าที่ยังเป็นฟอร์มค้างอยู่ตอนเครื่องปิด
  const recent = new Date(now.getTime() - 30 * 86400_000);
  const [surveys, shared] = await Promise.all([
    db.survey.findMany({
      where: {
        published: true,
        OR: [{ closedAt: null }, { closedAt: { gt: recent } }],
        AND: [{ OR: [{ closesAt: null }, { closesAt: { gt: recent } }] }],
      },
      select: { code: true },
    }),
    db.survey.findMany({
      where: { shareToken: { not: null }, OR: [{ shareExpiresAt: null }, { shareExpiresAt: { gt: now } }] },
      select: { shareToken: true },
    }),
  ]);
  const paths = [...surveys.map((s) => `/s/${s.code}/`), ...shared.map((s) => `/r/${s.shareToken}/`)];
  const { token } = await queueKeys();
  let pages = 0;
  for (const path of paths) {
    try {
      const r = await fetch(`${edgeBase()}${path}`, { headers: { "x-edge-warm": token }, signal: AbortSignal.timeout(60_000) });
      if (r.ok) pages += 1;
    } catch (e) {
      return { pages, error: e instanceof Error ? e.message : "ต่อ Worker ไม่ได้" };
    }
  }
  return { pages };
}
