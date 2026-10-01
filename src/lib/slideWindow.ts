/**
 * สไลด์นี้ควรแสดง ณ เวลานี้ไหม — ใช้ทั้งฝั่งเซิร์ฟเวอร์ (content.ts) และเบราว์เซอร์ (Hero)
 *
 * แยกเป็นไฟล์ข้อมูลล้วน ไม่ import ฐาน เพราะ Hero เป็น client component
 * สองฝั่งต้องตัดสินด้วยกฎเดียวกันเป๊ะ ไม่งั้นสไลด์ที่เซิร์ฟเวอร์วาดมากับที่เบราว์เซอร์กรองจะไม่ตรงกัน
 */
export function slideLiveAt(
  s: { startsAt: number | null; endsAt: number | null },
  now: number,
): boolean {
  return (s.startsAt === null || s.startsAt <= now) && (s.endsAt === null || s.endsAt >= now);
}
