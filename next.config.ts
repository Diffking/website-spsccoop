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
    // ตั้งให้พอกับเพดานที่ /api/admin/upload รับ (PDF 60MB) บวกส่วนหัวของ multipart
    proxyClientMaxBodySize: "70mb",
  },

  /*
   * หัวคำขอด้านความปลอดภัย — ใส่ทุกหน้า ทั้งเว็บสาธารณะและหลังบ้าน
   *
   * ไม่ได้ใส่ Content-Security-Policy ไว้ตรงนี้ตั้งใจ: หน้าเว็บมีทั้ง SVG ที่ฝังในหน้า
   * แผนที่จากกูเกิล และสไตล์ที่ Next ใส่มาเอง เปิด CSP แบบเข้มโดยไม่ไล่ทดสอบทุกหน้าก่อน
   * มีสิทธิ์ทำหน้าเว็บพังเงียบ ๆ — ถ้าจะเปิดต้องเริ่มจาก Report-Only แล้วดู log ก่อน
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // ห้ามเบราว์เซอร์เดาชนิดไฟล์เอง — ไฟล์ที่อัปมาจะได้ไม่ถูกรันเป็นอย่างอื่น
          { key: "X-Content-Type-Options", value: "nosniff" },
          /*
           * ให้เว็บอื่นเอาหน้าเราไปใส่ iframe ไม่ได้ (กันหลอกให้กดผิดที่)
           * SAMEORIGIN ไม่ใช่ DENY เพราะหน้าแรกของหลังบ้านมีพรีวิวที่ iframe "/" ของโดเมนตัวเอง
           */
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          // ออกจากเว็บไปที่อื่น อย่าส่งที่อยู่หน้าหลังบ้านติดไปด้วย
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // เว็บนี้ไม่ได้ใช้กล้อง ไมค์ หรือตำแหน่งจากหน้าอื่น ปิดไปเลย
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
        ],
      },
    ];
  },
};

export default nextConfig;
