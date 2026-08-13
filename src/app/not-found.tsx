import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { Home, Wrench } from "lucide-react";
import BackButton from "@/components/site/BackButton";
import { site } from "@/data/home";
import logo from "@/data/asset/logo_vector.svg";

/**
 * หน้า 404 — เปิดลิงก์ที่ยังไม่มีหน้า หรือหน้าที่ย้ายไปแล้ว
 *
 * ตั้งใจไม่แตะฐานข้อมูลเลย (ไม่ใช้ Header/Footer ตัวจริงที่อ่านเมนู/ที่อยู่จากฐาน)
 * เพราะสองเหตุผล — Next พยายาม prerender หน้านี้ตอน build ซึ่งตอนนั้นยังไม่มี DATABASE_URL
 * และเวลาฐานล่มจริง หน้าที่แจ้งปัญหาต้องเป็นหน้าที่ยังขึ้นได้อยู่
 */
export const metadata: Metadata = {
  title: `ขออภัย กำลังปรับปรุงข้อมูล · ${site.name}`,
  description: "ไม่พบหน้าที่เรียก หรือหน้านี้กำลังปรับปรุงข้อมูล",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-sky-soft">
      {/* แถบบนแบบย่อ — ให้ยังรู้ว่าอยู่เว็บสหกรณ์ และกดกลับหน้าหลักได้จากตรงนี้ */}
      <header className="bg-gradient-to-r from-brand-700 to-brand-500 text-white">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2">
          <Link href="/" className="flex min-w-0 items-center gap-2">
            <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-white shadow ring-1 ring-black/5">
              <Image src={logo} alt={site.name} width={32} height={32} className="h-7 w-7 object-contain" />
            </span>
            <span className="truncate text-sm font-medium">{site.name}</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 py-16 text-center">
        <span className="grid h-20 w-20 place-items-center rounded-2xl bg-white text-brand-500 shadow-sm ring-1 ring-black/5">
          <Wrench className="h-9 w-9" />
        </span>

        <p className="mt-6 text-6xl font-bold tracking-tight text-brand-200 sm:text-7xl">404</p>

        <h1 className="mt-1 text-2xl font-bold text-brand-800 sm:text-3xl">
          ขออภัย กำลังปรับปรุงข้อมูล
        </h1>

        <p className="mt-3 max-w-xl text-sm leading-7 text-gray-600 sm:text-base">
          หน้าที่คุณเปิดยังไม่พร้อมให้บริการ อาจกำลังจัดทำเนื้อหาอยู่ หรือถูกย้ายไปที่อื่นแล้ว
          <br className="hidden sm:block" />
          ลองกลับไปหน้าหลักแล้วเลือกจากเมนูอีกครั้งได้เลยครับ
        </p>

        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-brand-700"
          >
            <Home className="h-4 w-4" />
            กลับหน้าหลัก
          </Link>
          <BackButton className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-brand-700 shadow-sm ring-1 ring-black/5 transition hover:bg-brand-50" />
        </div>
      </main>

      <footer className="bg-brand-800 py-4 text-center text-xs text-white/70">
        {site.name}
      </footer>
    </div>
  );
}
