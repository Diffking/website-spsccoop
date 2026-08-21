import { HardDrive } from "lucide-react";

/**
 * แถบบอกว่าไฟล์ที่อัปจะไปเก็บที่ไหน
 *
 * เดิมแถบนี้มีสองโหมด (เก็บในเครื่อง / ส่งขึ้น FTP ของโฮสต์) พร้อมปุ่มทดสอบการเชื่อมต่อ
 * เจ้าของเว็บสั่งถอดการส่งขึ้น FTP ออกทั้งหมดเมื่อ 21 ส.ค. 2026 — ตอนนี้เหลือทางเดียว
 * จึงไม่ต้องมีโหมดให้เลือกอีกแล้ว และไม่มีปุ่มที่ยิงหาโฮสต์ค้างไว้ให้เผลอกด
 *
 * ข้อความอธิบายด้านล่างสำคัญกับเจ้าหน้าที่ — ไฟล์ที่เพิ่งอัปจะยังไม่ขึ้นบนหน้าเว็บ
 * สาธารณะทันที ต้องรอโฮสต์มาดึงไป ถ้าไม่บอกไว้จะนึกว่าอัปไม่สำเร็จแล้วอัปซ้ำ
 */
export default function StorageStatus() {
  return (
    <div className="mb-4 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gray-100 text-gray-500">
          <HardDrive className="h-4 w-4" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block text-xs text-gray-500">ไฟล์ที่อัปจะไปเก็บที่</span>
          <span className="block truncate text-sm font-medium text-gray-800">
            เครื่องนี้ (/uploads)
          </span>
        </span>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-gray-500">
        หน้าเว็บสาธารณะ (www.spsccoop.com) จะไปดึงไฟล์มาเก็บสำเนาเองตอนมีคนเปิดดู
        หรือตอนอุ่นแคชรอบ 09:30 และ 15:30 — <span className="text-gray-700">ไฟล์ที่เพิ่งอัป
        จะยังไม่ขึ้นบนหน้าเว็บสาธารณะทันที ไม่ต้องอัปซ้ำ</span>
      </p>
    </div>
  );
}
