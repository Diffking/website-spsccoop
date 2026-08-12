import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // รันเป็น Node server ใน Docker (เดิมเป็น output:"export" อัปไฟล์นิ่งขึ้น FTP)
  // เปลี่ยนเพราะเนื้อหามาจากฐานข้อมูลแล้ว static export ทำงานไม่ได้
  output: "standalone",
  // ยังไม่เปิด image optimization — ต้องลง sharp ใน runtime image ก่อน ค่อยเปิดทีหลัง
  images: { unoptimized: true },
  // คงรูปแบบ URL เดิม /path/ ไว้ ไม่ให้ลิงก์เก่าเสีย
  trailingSlash: true,
  experimental: {
    // โปรเจกต์นี้มี proxy/middleware ทุก request จึงถูกจำกัดขนาด body ไว้ที่ 10MB ตามค่าเริ่มต้นของ Next
    // ประกาศที่สแกนมาหลายหน้าเกิน 10MB บ่อย แล้วอัปไม่ขึ้นโดยไม่บอกว่าเพราะไฟล์ใหญ่
    // ตั้งให้พอกับเพดานที่ /api/admin/upload รับ (PDF 25MB) บวกส่วนหัวของ multipart
    proxyClientMaxBodySize: "30mb",
  },
};

export default nextConfig;
