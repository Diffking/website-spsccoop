/**
 * กันไล่สุ่มเบอร์/เลขสมาชิกในขั้นยืนยันตัวตน
 *
 * ขั้นนี้บอกได้ว่าเบอร์ไหนเป็นของสมาชิก (พร้อมชื่อที่ปิดบังบางส่วน) ถ้ายิงรัวได้ไม่จำกัด
 * ก็กลายเป็นเครื่องไล่หารายชื่อสมาชิก จึงนับสามชั้น:
 *
 * 1. ตามไอพีของคนกด — มาทาง .com ต้องอ่าน x-visitor-ip ที่ตัวมิเรอร์ส่งมา
 *    (cf-connecting-ip เป็นไอพีของโฮสต์ ถ้าใช้ค่านั้นสมาชิกทั้งสหกรณ์จะถูกนับเป็นคนเดียว
 *    แล้วโดนล็อกพร้อมกันหมด — เรื่องเดียวกับตัวนับเข้าชม)
 * 2. ตามเบอร์/เลขที่ถูกค้น — ตั้งหัวหลอกไอพีได้ แต่จะค้นใครก็ต้องส่งเลขคนนั้นมา
 * 3. รวมทั้งระบบ — หาไม่เจอติดกันผิดปกติ (มีคนไล่สุ่มแบบเปลี่ยนไอพีทุกครั้ง) พักทั้งระบบชั่วคราว
 *    แลกกับสมาชิกจริงต้องรอ 15 นาที ยอมได้กว่าปล่อยให้ไล่ดูดรายชื่อไปทั้งสหกรณ์
 *
 * เก็บในหน่วยความจำของ process (รันคอนเทนเนอร์เดียว) หลักเดียวกับหน้า login
 */

const WINDOW_MS = 15 * 60_000;
const LIMIT = { ip: 20, id: 8, globalMiss: 300 };

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

/** นับหนึ่งครั้งก่อนค้น — คืน true ถ้ายังค้นได้ */
export function allowLookup(ip: string, identifier: string): boolean {
  sweep();
  if (count("global:miss") >= LIMIT.globalMiss) return false;
  const byIp = bump(`ip:${ip}`);
  const byId = bump(`id:${identifier}`);
  return byIp <= LIMIT.ip && byId <= LIMIT.id;
}

/** ค้นแล้วไม่เจอ — นับเข้าชั้นรวมทั้งระบบ */
export function recordMiss(): void {
  bump("global:miss");
}
