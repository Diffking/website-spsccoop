/**
 * บอกตัวมิเรอร์ฝั่งโฮสต์ให้ทิ้งสำเนาเก่า หลังเจ้าหน้าที่กดบันทึก
 *
 * หน้าเว็บที่สมาชิกเห็นคือ "สำเนา" ที่ PHP บนโฮสต์เก็บไว้ ไม่ใช่ของสดจากเครื่องนี้
 * ถ้าไม่บอกอะไรเลย ของใหม่จะขึ้นก็ต่อเมื่อสำเนาหมดอายุ (ราว 2 นาที) — เจ้าหน้าที่กดบันทึก
 * แล้วเปิดดูจะยังเห็นของเก่า แล้วเข้าใจว่าบันทึกไม่ติด
 *
 * ตั้ง MIRROR_PURGE_URL กับ MIRROR_PURGE_TOKEN ใน .env ถึงจะทำงาน ไม่ตั้ง = ข้ามไปเงียบ ๆ
 * (ตอนพัฒนาในเครื่องไม่มีตัวมิเรอร์ ไม่ควรมีอะไรพังเพราะเรื่องนี้)
 *
 * **ห้ามทำให้การบันทึกพัง** — ยิงแล้วไม่รอผล โฮสต์ล่มหรือรหัสผิดก็แค่สำเนาเก่าค้างอยู่
 * จนหมดอายุเอง ซึ่งแย่กว่าเดิมนิดเดียว แต่ถ้าไปทำให้ปุ่มบันทึกพังคือแย่กว่ามาก
 */

/*
 * ⚠️ ยิงไม่สำเร็จแล้วต้องหยุด ห้ามยิงซ้ำ — บทเรียน 21 ส.ค. 2026
 *
 * โฮสต์ (hostinglotus) มีไฟร์วอลล์ที่นับคำขอที่ล้มเหลวแล้วแบนไอพีต้นทาง วันนั้นเครื่องนี้
 * แตะโฮสต์ไม่ถึงสิบครั้งก็โดนแบนทั้งไอพี · พอโดนแบนแล้ว ทุกคำขอที่ยิงต่อจะถูกทิ้งอย่างเดียว
 * ไม่ได้อะไรกลับมา **แต่ยังเติมตัวนับให้ CSF/LFD อยู่ดี** จนเลื่อนจากแบนชั่วคราวเป็นถาวรได้
 *
 * ตัวตัดวงจรนี้จึงทำงานแบบ "พลาดครั้งเดียวก็หยุด" ไม่ใช่ลองใหม่จนกว่าจะสำเร็จ:
 * ล้มเหลวปุ๊บหยุดยิงทันที แล้วค่อยยอมให้ลองใหม่เมื่อพ้นเวลาพักที่ยาวขึ้นเรื่อย ๆ
 *
 * ยอมแลกอะไร: ช่วงที่ตัดวงจรอยู่ สำเนาบนโฮสต์จะไม่ถูกล้างทันทีตอนกดบันทึก ต้องรอ
 * หมดอายุเอง (`ttl_page` 120 วิ) — ช้ากว่าเดิมสองนาที ซึ่งแลกกับการไม่โดนแบนถาวรคุ้มกว่ามาก
 *
 * สถานะเก็บในหน่วยความจำของโปรเซส รีสตาร์ต `web` แล้วเริ่มนับใหม่ — ตั้งใจ เพราะการรีสตาร์ต
 * มักแปลว่าคนแก้อะไรบางอย่างแล้ว (สลับเน็ต ปลดไอพี) ควรได้ลองใหม่ทันทีโดยไม่ต้องรอ
 */

/** พักนานเท่าไหร่หลังพลาดครั้งที่ 1, 2, 3, 4+ — ยิ่งพลาดซ้ำยิ่งพักนาน */
const BACKOFF_MS = [15 * 60_000, 60 * 60_000, 6 * 3_600_000, 24 * 3_600_000];

let consecutiveFails = 0;
let pausedUntil = 0;

/** ให้หน้าอื่นถามสถานะได้ (หน้าภาพรวมหลังบ้าน) โดยไม่ต้องรู้กลไกข้างใน */
export function mirrorPurgeStatus(): { paused: boolean; until: Date | null; fails: number } {
  const paused = Date.now() < pausedUntil;
  return { paused, until: paused ? new Date(pausedUntil) : null, fails: consecutiveFails };
}

function openBreaker(reason: string): void {
  consecutiveFails += 1;
  const wait = BACKOFF_MS[Math.min(consecutiveFails - 1, BACKOFF_MS.length - 1)];
  pausedUntil = Date.now() + wait;
  console.warn(
    `[mirror] ล้างสำเนาไม่สำเร็จ (${reason}) ครั้งที่ ${consecutiveFails} — ` +
      `หยุดยิงหาโฮสต์ถึง ${new Date(pausedUntil).toISOString()} กันโดนไฟร์วอลล์แบน`
  );
}

function closeBreaker(): void {
  if (consecutiveFails > 0) {
    console.info(`[mirror] ล้างสำเนาสำเร็จอีกครั้ง — เริ่มนับใหม่ (พลาดไป ${consecutiveFails} ครั้ง)`);
  }
  consecutiveFails = 0;
  pausedUntil = 0;
}

type PurgeBody = { token: string; paths?: string[]; all?: true };

async function tell(body: PurgeBody): Promise<void> {
  const url = process.env.MIRROR_PURGE_URL;
  const token = process.env.MIRROR_PURGE_TOKEN;
  if (!url || !token) return;

  // ตัดวงจรอยู่ = ไม่ยิงเลย ไม่ใช่ยิงแล้วค่อยรับ error
  if (Date.now() < pausedUntil) return;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, token }),
      signal: AbortSignal.timeout(4000),
    });
    // ตอบกลับมาแต่ไม่ใช่ 2xx ก็นับว่าพลาด (รหัสผิด · โฮสต์ error · โดน WAF กั้น)
    if (!res.ok) {
      openBreaker(`HTTP ${res.status}`);
      return;
    }
    closeBreaker();
  } catch (e) {
    // ต่อไม่ติด/หมดเวลา — หน้าตาแบบเดียวกับตอนโดนไฟร์วอลล์ทิ้งแพ็กเก็ต
    openBreaker(e instanceof Error ? e.name : "ต่อไม่ติด");
  }
}

/** ล้างสำเนาเฉพาะหน้าที่ระบุ — ใช้ตอนแก้เนื้อหาหน้าเดียว */
export function purgePaths(paths: string[]): void {
  const clean = paths.filter((p) => p.startsWith("/"));
  if (clean.length === 0) return;
  void tell({ token: "", paths: clean });
}

/**
 * ล้างสำเนาหน้าเว็บทั้งเว็บ — ใช้ตอนแก้ของที่โผล่ทุกหน้า (เมนู หัวเว็บ ท้ายเว็บ ค่าตั้ง)
 * รูปกับไฟล์แนบไม่ถูกลบ ตัวมิเรอร์เก็บไว้เหมือนเดิม
 */
export function purgeEverySite(): void {
  void tell({ token: "", all: true });
}
