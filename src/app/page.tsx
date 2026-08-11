import Header from "@/components/site/Header";
import Footer from "@/components/site/Footer";
import SplashGate from "@/components/site/SplashGate";
import Hero from "@/components/home/Hero";
import NewsTicker from "@/components/home/NewsTicker";
import NewsSection from "@/components/home/NewsSection";
import Services from "@/components/home/Services";
import Recommend from "@/components/home/Recommend";
import MemberCorner from "@/components/home/MemberCorner";
import CoopCalendar from "@/components/home/CoopCalendar";
import OfficerService from "@/components/home/OfficerService";
import { site } from "@/data/home";
import { getRates, getSiteInfo, getSplash } from "@/lib/settings";
import { getAnnouncements } from "@/lib/content";

// อ่านที่อยู่/ดอกเบี้ยจากฐานทุกครั้งที่มีคนเข้า — แก้ในหลังบ้านแล้วเห็นผลทันทีไม่ต้อง deploy
// (ห้าม prerender ตอน build ด้วย เพราะตอน build ใน Docker ยังไม่มี DATABASE_URL)
export const dynamic = "force-dynamic";

export default async function Home() {
  const [info, rates, announcements, splash] = await Promise.all([
    getSiteInfo(),
    getRates(),
    getAnnouncements(),
    getSplash(),
  ]);

  // JSON-LD structured data สำหรับ SEO หน้า Home
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: site.name,
    url: "https://beta.spsccoop.com",
    telephone: info.phone,
    email: info.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: info.address,
      addressCountry: "TH",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SplashGate content={splash} />
      <Header />
      <main>
        <Hero rates={rates} />
        <NewsTicker />
        <NewsSection announcements={announcements} />
        <Services />
        <Recommend />
        <MemberCorner />
        <CoopCalendar />
        <OfficerService />
      </main>
      <Footer />
    </>
  );
}
