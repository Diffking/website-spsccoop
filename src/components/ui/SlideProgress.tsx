/**
 * หลอดนับถอยหลังของสไลด์ — วิ่งจากซ้ายไปขวา เต็มหลอดเมื่อไหร่ก็เปลี่ยนเนื้อหาพอดี
 *
 * มีไว้ให้สมาชิกรู้ว่า "เดี๋ยวมันจะเปลี่ยนแล้วนะ" ไม่ใช่จู่ ๆ เนื้อหาก็เปลี่ยนเอง
 * และเห็นได้ด้วยว่าแต่ละการ์ดเดินคนละจังหวะกัน (ดู SLIDE_TIMING ใน src/lib/slideMotion.ts)
 *
 * ทำด้วย CSS animation ล้วน ไม่ใช่ตัวจับเวลาใน JS — พอเอาเมาส์ชี้ค้างแล้วสั่ง `paused`
 * เบราว์เซอร์หยุดหลอดค้างไว้ตรงนั้นเองแล้วเดินต่อจากเดิม ไม่ต้องคำนวณเวลาที่เหลือ
 *
 * ⚠️ `key={at}` สำคัญ — ต้องให้ React สร้าง element ใหม่ทุกครั้งที่เปลี่ยนหน้า
 * หลอดถึงจะเริ่มวิ่งใหม่จากศูนย์ ถ้าไม่ใส่ CSS animation จะเดินต่อจากเดิมค้างเต็มหลอด
 *
 * เครื่องที่ตั้งค่า "ลดการเคลื่อนไหว" ไว้จะไม่เห็นหลอดนี้เลย (ซ่อนไว้ใน globals.css)
 */
export default function SlideProgress({
  ms,
  at,
  paused,
  className = "",
}: {
  /** ความยาวหนึ่งรอบ (มิลลิวินาที) — ต้องตรงกับจังหวะที่ใช้เลื่อนจริง */
  ms: number;
  /** ลำดับหน้าปัจจุบัน ใช้เป็น key ให้หลอดเริ่มใหม่ */
  at: number;
  paused: boolean;
  className?: string;
}) {
  return (
    <span
      key={at}
      aria-hidden
      style={{
        animationDuration: `${ms}ms`,
        animationPlayState: paused ? "paused" : "running",
      }}
      // ไม่ใส่มุมโค้งไว้ในนี้ ให้แต่ละที่เติมเอง — Tailwind สองคลาสที่ชนกันไม่การันตีว่าอันหลังชนะ
      className={`slide-progress h-1 origin-left bg-gradient-to-r from-brand-600 to-brand-400 ${className}`}
    />
  );
}
