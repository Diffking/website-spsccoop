import { Sarabun } from "next/font/google";
import { connection } from "next/server";
import { db } from "@/lib/db";
import "./globals.css";

const sarabun = Sarabun({
  variable: "--font-sarabun",
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

// SEO ทั้งหมดย้ายไปตั้งที่หลังบ้าน (/admin/seo) แล้ว — แต่ละหน้าเรียก pageMetadata(path)
// ของตัวเอง ไฟล์นี้เหลือแค่โครง html + ฟอนต์

/**
 * ฐานข้อมูลตอบไหม — ผลไปติดเป็นป้าย <meta name="mirror-data"> ให้ตัวมิเรอร์บนโฮสต์อ่าน
 *
 * ⚠️ ฟังก์ชันอ่านเนื้อหาทุกตัวใน src/lib/content.ts กลืน error แล้วคืนลิสต์ว่าง หน้าเว็บจึงยังตอบ 200
 * ตอนฐานยังไม่พร้อม (เครื่องเพิ่งตื่น/กำลังหลับ) · ถ้าไม่มีป้ายนี้ ตัวมิเรอร์จะเก็บ "หน้าว่าง"
 * ทับสำเนาดีที่อุ่นไว้ แล้วเสิร์ฟหน้าว่างทั้งคืน · ป้าย "down" = มิเรอร์ไม่เก็บ ใช้สำเนาเดิมต่อ
 * (ดู php-frontend/lib/mirror.php → degraded)
 */
async function dataReady(): Promise<boolean> {
  try {
    await db.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // ทุกหน้าเป็น force-dynamic อยู่แล้ว — กันไว้อีกชั้นไม่ให้ป้ายถูกแช่ตอน build (ตอนนั้นไม่มีฐาน)
  await connection();
  const ready = await dataReady();
  return (
    <html lang="th" className={`${sarabun.variable} h-full antialiased`}>
      <head>
        <meta name="mirror-data" content={ready ? "ok" : "down"} />
      </head>
      <body className="min-h-full flex flex-col bg-white text-gray-800">
        {children}
      </body>
    </html>
  );
}
