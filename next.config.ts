import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // รันเป็น Node server ใน Docker (เดิมเป็น output:"export" อัปไฟล์นิ่งขึ้น FTP)
  // เปลี่ยนเพราะเนื้อหามาจากฐานข้อมูลแล้ว static export ทำงานไม่ได้
  output: "standalone",
  // ยังไม่เปิด image optimization — ต้องลง sharp ใน runtime image ก่อน ค่อยเปิดทีหลัง
  images: { unoptimized: true },
  // คงรูปแบบ URL เดิม /path/ ไว้ ไม่ให้ลิงก์เก่าเสีย
  trailingSlash: true,
};

export default nextConfig;
