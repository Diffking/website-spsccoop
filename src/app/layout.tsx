import { Sarabun } from "next/font/google";
import "./globals.css";

const sarabun = Sarabun({
  variable: "--font-sarabun",
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

// SEO ทั้งหมดย้ายไปตั้งที่หลังบ้าน (/admin/seo) แล้ว — แต่ละหน้าเรียก pageMetadata(path)
// ของตัวเอง ไฟล์นี้เหลือแค่โครง html + ฟอนต์

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className={`${sarabun.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-white text-gray-800">
        {children}
      </body>
    </html>
  );
}
