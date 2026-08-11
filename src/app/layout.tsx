import type { Metadata } from "next";
import { Sarabun } from "next/font/google";
import "./globals.css";

const sarabun = Sarabun({
  variable: "--font-sarabun",
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const siteName = "สหกรณ์ออมทรัพย์สาธารณสุขสงขลา จำกัด";
const siteUrl = "https://beta.spsccoop.com";

// ---- SEO หน้า Home ----
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${siteName} | เงินฝาก เงินกู้ สวัสดิการสมาชิก`,
    template: `%s | ${siteName}`,
  },
  description:
    "เว็บไซต์ทางการของสหกรณ์ออมทรัพย์สาธารณสุขสงขลา จำกัด ให้บริการเงินรับฝาก เงินให้กู้ สวัสดิการสมาชิก ข่าวประกาศ อัตราดอกเบี้ย และบริการออนไลน์สำหรับสมาชิก",
  keywords: [
    "สหกรณ์ออมทรัพย์สาธารณสุขสงขลา",
    "สหกรณ์ออมทรัพย์",
    "เงินฝากสหกรณ์",
    "เงินกู้สหกรณ์",
    "อัตราดอกเบี้ยสหกรณ์",
    "สวัสดิการสมาชิก",
    "spsccoop",
  ],
  authors: [{ name: siteName }],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "th_TH",
    url: siteUrl,
    siteName,
    title: `${siteName} | เงินฝาก เงินกู้ สวัสดิการสมาชิก`,
    description:
      "บริการเงินรับฝาก เงินให้กู้ สวัสดิการสมาชิก ข่าวประกาศ และอัตราดอกเบี้ยล่าสุดของสหกรณ์ออมทรัพย์สาธารณสุขสงขลา จำกัด",
  },
  twitter: {
    card: "summary_large_image",
    title: siteName,
    description:
      "บริการเงินรับฝาก เงินให้กู้ สวัสดิการสมาชิก และข่าวประกาศของสหกรณ์ออมทรัพย์สาธารณสุขสงขลา จำกัด",
  },
  robots: { index: true, follow: true },
};

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
