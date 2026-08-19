/**
 * ถามสถานะสำเนาหน้าเว็บบนโฮสต์ และสั่งอุ่นใหม่ด้วยมือ
 *
 * ตัวมิเรอร์อยู่คนละเครื่อง (โฮสต์ของ spsccoop.com) เครื่องนี้จึงไม่รู้เองว่ามันทำงานอยู่ไหม
 * อุ่นล่าสุดเมื่อไหร่ — ต้องถามผ่าน warm.php?status=1 ซึ่งอ่านจากแฟ้มที่มันบันทึกไว้ทุกครั้ง
 *
 * ไม่ตั้ง MIRROR_WARM_URL / MIRROR_PURGE_TOKEN ใน .env = ถือว่าไม่ได้ใช้ตัวมิเรอร์
 */

export type MirrorLastRun = {
  time: number;
  seconds: number;
  pages: { ok: number; skip: number; fail: number; total: number };
  assets: { ok: number; skip: number; fail: number; total: number } | null;
  bytes: number;
  /** "auto" = ตัวตั้งเวลาทุกชั่วโมง · "manual" = เจ้าหน้าที่กดปุ่มเอง */
  by: string;
  /** เวลารอบอัตโนมัติล่าสุด — กดเองไม่ทับค่านี้ ใช้ดูว่าตัวตั้งเวลายังเดินอยู่ไหม */
  auto_time: number | null;
};

export type MirrorStatus = {
  /** ตั้งค่าไว้หรือยัง */
  configured: boolean;
  /** ติดต่อโฮสต์ได้ไหม */
  reachable: boolean;
  url: string | null;
  last: MirrorLastRun | null;
  cache: { pages: number; items: number; bytes: number } | null;
  error: string | null;
};

/** ที่อยู่ของตัวอุ่นสำเนา — ไม่ได้ตั้งไว้ก็เดาจากที่อยู่ตัวล้างสำเนา (อยู่โฟลเดอร์เดียวกันเสมอ) */
function warmBase(): string | null {
  const direct = process.env.MIRROR_WARM_URL;
  if (direct) return direct;

  const purge = process.env.MIRROR_PURGE_URL;
  return purge ? purge.replace(/purge\.php(\?.*)?$/, "warm.php") : null;
}

function warmUrl(): string | null {
  const url = warmBase();
  const token = process.env.MIRROR_PURGE_TOKEN;
  return url && token ? `${url}?token=${encodeURIComponent(token)}` : null;
}

export async function mirrorStatus(): Promise<MirrorStatus> {
  const base = warmUrl();
  const shown = warmBase();
  if (!base) {
    return { configured: false, reachable: false, url: shown, last: null, cache: null, error: null };
  }

  try {
    const res = await fetch(`${base}&status=1`, {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      return { configured: true, reachable: false, url: shown, last: null, cache: null, error: `โฮสต์ตอบ ${res.status}` };
    }
    const data = (await res.json()) as { last?: MirrorLastRun; cache?: MirrorStatus["cache"] };
    return {
      configured: true,
      reachable: true,
      url: shown,
      last: data.last ?? null,
      cache: data.cache ?? null,
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "ติดต่อไม่ได้";
    return { configured: true, reachable: false, url: shown, last: null, cache: null, error: message };
  }
}

/** สั่งอุ่นเดี๋ยวนี้ — รอจนเสร็จเพราะเจ้าหน้าที่กดแล้วต้องเห็นผล (ใช้เวลาไม่กี่วินาทีถึงราวหนึ่งนาที) */
export async function runWarm(force = false): Promise<{ ok: boolean; text: string }> {
  const base = warmUrl();
  if (!base) return { ok: false, text: "ยังไม่ได้ตั้งค่าตัวมิเรอร์ใน .env" };

  try {
    const res = await fetch(`${base}&by=manual${force ? "&force=1" : ""}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(600_000),
    });
    const text = (await res.text()).trim();
    return { ok: res.ok, text: text || `โฮสต์ตอบ ${res.status}` };
  } catch (error) {
    return { ok: false, text: error instanceof Error ? error.message : "ติดต่อโฮสต์ไม่ได้" };
  }
}
