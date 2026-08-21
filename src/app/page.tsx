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
import SectionNav from "@/components/home/SectionNav";
import { site } from "@/data/home";
import { SECTION_SHORT, orderedSections, resolveTones, type HomeSectionKey } from "@/lib/homeSections";
import {
  getCommitteePhotoScale,
  getCommitteeSet,
  getHomeOrder,
  getHomeSections,
  getHomeTones,
  getRates,
  getSiteInfo,
  getSplash,
} from "@/lib/settings";
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
    committeePhotoScale,
    show,
    tones,
    order,
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
    getCommitteePhotoScale(),
    getHomeSections(),
    getHomeTones(),
    getHomeOrder(),
  ]);

  // สีพื้นหลังของแต่ละส่วน — "สลับให้เอง" คิดจากส่วนที่แสดงอยู่จริง ตามลำดับที่จัดไว้
  const bg = resolveTones(tones, (key) => show[key], order);

  // ปฏิทินรับ place/time เป็น optional ส่วนฐานเก็บเป็น null — แปลงก่อนส่งเข้า
  const calendar = events.map((e) => ({
    day: e.day,
    type: e.type,
    title: e.title,
    place: e.place ?? undefined,
    time: e.time ?? undefined,
  }));

  // เนื้อของแต่ละส่วน — ประกอบไว้ก่อน แล้วค่อยเรียงตามลำดับที่จัดไว้ตอน render
  const blocks: Record<HomeSectionKey, React.ReactNode> = {
    hero: <Hero rates={rates} slides={slides} />,
    ticker: <NewsTicker bg={bg.ticker} />,
    news: (
      <NewsSection
        announcements={announcements}
        committees={committees}
        committeeSet={committeeSet}
        committeePhotoScale={committeePhotoScale}
        bg={bg.news}
      />
    ),
    services: <Services items={services} bg={bg.services} />,
    // สองอันนี้เป็นเรื่องของสมาชิกชุดเดียวกัน ใช้พื้นหลังสีเดียวจะได้ดูเป็นก้อนเดียว
    member: (
      <>
        <Recommend cards={recommends} features={memberFeatures} bg={bg.member} />
        <MemberCorner links={memberLinks} bg={bg.member} />
      </>
    ),
    calendar: <CoopCalendar holidays={holidays} events={calendar} bg={bg.calendar} />,
    officers: <OfficerService items={officers} bg={bg.officers} />,
  };

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
      {/*
        เปิด/ปิดและจัดลำดับแต่ละส่วนได้ที่ /admin/home
        ปิดแล้วข้อมูลยังอยู่ครบ แค่ไม่ขึ้นบนหน้าเว็บ · ลำดับด้านล่างมาจากที่จัดไว้ในหลังบ้าน
      */}
      <main>
        {orderedSections(order).map((section) => {
          if (!show[section.key]) return null;
          const node = blocks[section.key];
          /*
            ห่อด้วย div ที่มี id เพื่อให้ตัวนำทางลอยด้านซ้าย (SectionNav) กระโดดมาได้
            scroll-mt-20 = เว้นที่ให้แถบเมนูที่ปักอยู่หัวจอไม่บังหัวข้อของส่วนนั้น
            (แถบบนหุบไปตอนเลื่อนแล้ว เหลือแค่แถวเมนูสูงราว 44px — เว้น 80px พอมีที่หายใจ)
          */
          return (
            <div key={section.key} id={`sec-${section.key}`} className="scroll-mt-20">
              {node}
            </div>
          );
        })}
      </main>
      {/* รายการในตัวนำทางต้องตรงกับที่วาดจริง — ส่งลำดับที่กรองแล้วไปเลย ไม่ให้มันคำนวณเอง */}
      <SectionNav
        items={orderedSections(order)
          .filter((s) => show[s.key] && SECTION_SHORT[s.key])
          .map((s) => ({ key: s.key, label: SECTION_SHORT[s.key] as string }))}
      />
      <BackToTop />
      <Footer />
    </>
  );
}
