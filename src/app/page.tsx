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

// JSON-LD structured data สำหรับ SEO หน้า Home
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: site.name,
  url: "https://beta.spsccoop.com",
  telephone: site.phone,
  email: site.email,
  address: {
    "@type": "PostalAddress",
    streetAddress: site.address,
    addressCountry: "TH",
  },
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SplashGate />
      <Header />
      <main>
        <Hero />
        <NewsTicker />
        <NewsSection />
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
