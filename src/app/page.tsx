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
import ScrollProgress from "@/components/ui/ScrollProgress";
import PageTracker from "@/components/site/PageTracker";
import BackToTop from "@/components/ui/BackToTop";
import { site } from "@/data/home";
import { getCommitteeSet, getRates, getSiteInfo, getSplash } from "@/lib/settings";
import { getAnnouncements, getHolidayEvents, getSlides } from "@/lib/content";
import { getCalendarEvents, getItems } from "@/lib/homeItems";
import { pageMetadata } from "@/lib/seo";

// อ่านที่อยู่/ดอกเบี้ยจากฐานทุกครั้งที่มีคนเข้า — แก้ในหลังบ้านแล้วเห็นผลทันทีไม่ต้อง deploy
// (ห้าม prerender ตอน build ด้วย เพราะตอน build ใน Docker ยังไม่มี DATABASE_URL)
export const dynamic = "force-dynamic";

// ตั้งค่า SEO ของหน้านี้ที่ /admin/seo
export const generateMetadata = () => pageMetadata("/");

export default async function Home() {
  const [
    info,
    rates,
    announcements,
    splash,
    holidays,
    slides,
    committees,
    services,
    recommends,
    memberFeatures,
    memberLinks,
    officers,
    events,
    committeeSet,
  ] = await Promise.all([
    getSiteInfo(),
    getRates(),
    // ดึงเผื่อทั้ง 3 แท็บ (ประกาศ · จดหมายข่าว · รายงานกิจการ) แล้วค่อยแยกฝั่ง client
    getAnnouncements(60),
    getSplash(),
    getHolidayEvents(),
    getSlides(),
    getItems("committees"),
    getItems("services"),
    getItems("recommends"),
    getItems("memberFeatures"),
    getItems("memberLinks"),
    getItems("officers"),
    getCalendarEvents(),
    getCommitteeSet(),
  ]);

  // ปฏิทินรับ place/time เป็น optional ส่วนฐานเก็บเป็น null — แปลงก่อนส่งเข้า
  const calendar = events.map((e) => ({
    day: e.day,
    type: e.type,
    title: e.title,
    place: e.place ?? undefined,
    time: e.time ?? undefined,
  }));

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
      <PageTracker />
      <ScrollProgress />
      <SplashGate content={splash} />
      <Header />
      <main>
        <Hero rates={rates} slides={slides} />
        <NewsTicker />
        <NewsSection announcements={announcements} committees={committees} committeeSet={committeeSet} />
        <Services items={services} />
        <Recommend cards={recommends} features={memberFeatures} />
        <MemberCorner links={memberLinks} />
        <CoopCalendar holidays={holidays} events={calendar} />
        <OfficerService items={officers} />
      </main>
      <BackToTop />
      <Footer />
    </>
  );
}
