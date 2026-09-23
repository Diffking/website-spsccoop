import { SPLASH_GRACE_MS, type SplashContent } from "@/content/splash";

/**
 * "เข้าเว็บไปแล้วหรือยัง" ของหน้าวันสำคัญ — เก็บใน sessionStorage ของเบราว์เซอร์
 *
 * รวมไว้ที่เดียวเพราะมีสามที่ที่ต้องตอบคำถามเดียวกันนี้: ปุ่มเข้าสู่เว็บไซต์ ·
 * ตัวนับถอยหลังบนหน้าวันสำคัญ · ตัวเด้งตอนกลับมาหน้าแรก (SplashGate)
 * ถ้าต่างคนต่างอ่านคีย์นี้เอง วันหลังแก้เงื่อนไขที่เดียวแล้วอีกสองที่หลุดเงียบ ๆ
 *
 * ⚠️ มีที่ที่สี่ที่ลอกเงื่อนไขนี้ไปไม่ได้จริง ๆ คือสคริปต์เด้งก่อนวาดหน้าใน
 * splashRedirect.ts (เป็นข้อความ JS ฝังใน HTML import ไม่ได้) — แก้ที่นี่แล้วต้องไปดูตัวนั้นด้วย
 */
const ENTERED_KEY = "spsc_entered";

/** จำว่าเพิ่งเข้าเว็บไปเมื่อไหร่ — เก็บเป็นเวลา ไม่ใช่แค่ธง เพราะโหมด "ทุกครั้ง" ต้องรู้ */
export function markEntered(): void {
  try {
    sessionStorage.setItem(ENTERED_KEY, String(Date.now()));
  } catch {}
}

/**
 * เข้าเว็บไปแล้ว = ไม่ต้องเด้งไปหน้าวันสำคัญอีก
 *
 * โหมด "ทุกครั้ง" ถือว่ายังไม่เข้าเมื่อพ้นช่วงผ่อนผันแล้ว — ไม่มีช่วงผ่อนผัน
 * = กดเข้าเว็บแล้วเด้งกลับทันที วนจนเข้าเว็บไม่ได้
 */
export function hasEntered(content: SplashContent): boolean {
  try {
    if (content.repeat !== "always") return sessionStorage.getItem(ENTERED_KEY) !== null;
    const entered = Number(sessionStorage.getItem(ENTERED_KEY));
    return Number.isFinite(entered) && entered > 0 && Date.now() - entered < SPLASH_GRACE_MS;
  } catch {
    // อ่าน sessionStorage ไม่ได้ (โหมดส่วนตัวบางเบราว์เซอร์) — ถือว่ายังไม่เข้า
    return false;
  }
}
