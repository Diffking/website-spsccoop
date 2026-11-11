import { Info } from "lucide-react";

/**
 * บอกเจ้าหน้าที่ว่าของที่บันทึกไปขึ้น .com ช้ากว่า .org — จะได้ไม่ต้องถามซ้ำว่าทำไมยังไม่ขึ้น
 *
 * สมาชิกอ่าน www.spsccoop.com ผ่านสำเนาบนโฮสต์ (`ttl_page` 120 วิ) และกดบันทึกแล้ว
 * ไม่ได้ล้างสำเนาให้ (ปิดตั้งแต่ 22 ก.ย. 2569 กันไอพีโดนแบน) · บอก 5 นาทีเผื่อเวลาที่โฮสต์ดึงใหม่
 * · ย้ำ "ไม่ต้องรีเฟรชซ้ำ" เพราะการกดรีเฟรช .com จากสำนักงาน = ไอพีสำนักงานแตะโฮสต์ทุกครั้ง
 */
export default function PublishDelayNote({ compact = false }: { compact?: boolean }) {
  return (
    <p
      className={`flex items-start gap-2 rounded-lg bg-sky-50 text-sky-800 ring-1 ring-sky-100 ${
        compact ? "mt-2 px-3 py-1.5 text-xs" : "mb-4 px-3 py-2 text-sm"
      }`}
    >
      <Info className={`mt-0.5 shrink-0 ${compact ? "h-3.5 w-3.5" : "h-4 w-4"}`} />
      <span>
        บันทึกแล้ว <strong>spsccoop.org ขึ้นทันที</strong> ·{" "}
        <strong>www.spsccoop.com ขึ้นภายในไม่เกิน 5 นาที</strong> ไม่ต้องกดรีเฟรชซ้ำ
        {!compact && (
          <> · ถ้าจะปิดเครื่องทันทีหลังบันทึก ให้สั่งอุ่นสำเนาที่หน้าภาพรวม (หรือแจ้งผู้ดูแลเว็บ) ก่อน</>
        )}
      </span>
    </p>
  );
}
