"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import LineMark from "@/components/admin/LineMark";

/**
 * แถบทวงให้ผูกบัญชี LINE — ขึ้นทุกหน้าหลังบ้านจนกว่าเจ้าตัวจะผูก
 *
 * เจ้าของเว็บสั่งไว้ 17 ก.ย. 2569 ว่าอยากให้เจ้าหน้าที่ทุกคนผูก LINE
 * ของเดิมปุ่มผูกซ่อนอยู่ในเมนู "บัญชีของฉัน" ที่เดียว คนที่ไม่เคยเข้าไปก็ไม่มีทางรู้ว่าต้องผูก
 * ระบบไม่เคยบอกเลยสักที่ — จะได้ไม่ต้องไล่บอกกันปากเปล่า
 *
 * ⚠️ **ปิดเองไม่ได้ตั้งใจ** ถ้ามีปุ่มปิด คนก็กดปิดแล้วไม่ผูกอยู่ดี ซึ่งแปลว่าแถบนี้
 * ไม่ได้ทำอะไรเลย · แต่ก็ **ไม่บังคับ** ยังกดใช้เมนูอื่นทำงานต่อได้ตามปกติ
 * (เคยพิจารณาแบบบังคับให้ผูกก่อนถึงใช้หลังบ้านได้ แล้วไม่เอา เพราะวันไหน LINE ล่ม
 * จะทำงานไม่ได้ทั้งสำนักงาน)
 *
 * หายไปเองทันทีที่ผูกเสร็จ ไม่ต้องมีใครมาปิดให้
 */
export default function LineNudge() {
  const pathname = usePathname();

  // อยู่ในหน้าที่มีปุ่มผูกอยู่แล้ว ไม่ต้องทวงซ้ำ — การ์ดผูก LINE อยู่ใต้ลงไปนิดเดียว
  if (pathname?.startsWith("/admin/account")) return null;

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-3 gap-y-2 text-sm">
        <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600" />
        <p className="min-w-0 flex-1 text-amber-900">
          <b>บัญชีของคุณยังไม่ได้ผูก LINE</b> — ผูกแล้วเข้าระบบด้วยการกดปุ่มเดียว
          ไม่ต้องจำรหัสผ่านอีก และปลอดภัยกว่ารหัสเลข 4 ตัวท้ายเบอร์โทร
        </p>
        <Link
          href="/admin/account/"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#06C755] px-3 py-1.5 font-medium text-white transition hover:brightness-105"
        >
          <LineMark className="h-4 w-4" /> ผูกบัญชี LINE
        </Link>
      </div>
    </div>
  );
}
