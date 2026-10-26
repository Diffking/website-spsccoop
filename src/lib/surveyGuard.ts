/**
 * กันไล่สุ่มในขั้นยืนยันตัวตน (เลขสมาชิก + เบอร์) — สเปก sync-agent ข้อ 6: ราว 5 ครั้ง / 15 นาที
 *
 * ผ่านแล้วได้ชื่อที่ปิดบังบางส่วน ถ้ายิงรัวได้ไม่จำกัดก็ไล่เดาเบอร์ของเลขสมาชิกหนึ่งได้ จึงนับสามชั้น:
 *
 * 1. ตามเลขสมาชิกที่ถูกลอง — **นับทุกครั้ง** 5 ครั้ง · ตั้งหัวหลอกไอพีได้ แต่จะลองใครก็ต้องส่งเลขคนนั้นมา
 * 2. ตามไอพี — **นับเฉพาะครั้งที่ไม่ผ่าน** 5 ครั้ง · งานประชุมที่สมาชิกหลายสิบคนสแกนพร้อมกันผ่าน wifi
 *    เดียวกันใช้ไอพีเดียวกันหมด ถ้านับครั้งที่ผ่านด้วย คนที่หกเป็นต้นไปจะเข้าไม่ได้ทั้งห้อง
 *    · อ่าน x-visitor-ip ก่อน (Worker ส่งไอพีจริงของคนกดมา ไม่งั้นทุกคนเป็นไอพีของ Cloudflare)
 * 3. รวมทั้งระบบ — ไม่ผ่านติดกันผิดปกติ (ไล่สุ่มแบบเปลี่ยนไอพีทุกครั้ง) พักทั้งระบบชั่วคราว
 *
 * เก็บในหน่วยความจำของ process (รันคอนเทนเนอร์เดียว) หลักเดียวกับหน้า login
 */

const WINDOW_MS = 15 * 60_000;
const LIMIT = { ipMiss: 5, id: 5, globalMiss: 300 };

const hits = new Map<string, { count: number; firstAt: number }>();

function bump(key: string): number {
  const now = Date.now();
  const rec = hits.get(key);
  if (!rec || now - rec.firstAt > WINDOW_MS) {
    hits.set(key, { count: 1, firstAt: now });
    return 1;
  }
  rec.count += 1;
  return rec.count;
}

function count(key: string): number {
  const rec = hits.get(key);
  if (!rec || Date.now() - rec.firstAt > WINDOW_MS) return 0;
  return rec.count;
}

function sweep() {
  const now = Date.now();
  for (const [key, rec] of hits) if (now - rec.firstAt > WINDOW_MS) hits.delete(key);
}

export function visitorIp(request: Request): string {
  return (
    request.headers.get("x-visitor-ip") ??
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    "unknown"
  );
}

/** นับหนึ่งครั้งก่อนตรวจ — คืน true ถ้ายังลองได้ */
export function allowLookup(ip: string, identifier: string): boolean {
  sweep();
  if (count("global:miss") >= LIMIT.globalMiss) return false;
  if (count(`ipmiss:${ip}`) >= LIMIT.ipMiss) return false;
  return bump(`id:${identifier}`) <= LIMIT.id;
}

/**
 * ฝากคำตอบแบบยังไม่ยืนยันตัวตน — ไอพีละ 10 ครั้ง / 15 นาที
 * กันคนยิงขยะเข้ามาเป็นกองรอตรวจ (ของจากกล่องพักบนโฮสต์ไม่ผ่านด่านนี้ มีโทเคนยืนยันแล้ว)
 */
export function allowQueue(ip: string): boolean {
  sweep();
  return bump(`queue:${ip}`) <= 10;
}

/** ตรวจไม่ผ่าน — นับเข้าไอพีนั้นและชั้นรวมทั้งระบบ */
export function recordMiss(ip: string): void {
  bump(`ipmiss:${ip}`);
  bump("global:miss");
}
