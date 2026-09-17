import Header from "@/components/site/Header";
import Footer from "@/components/site/Footer";
import PageTracker from "@/components/site/PageTracker";
import NewsArchive from "@/components/site/NewsArchive";
import ScrollProgress from "@/components/ui/ScrollProgress";
import BackToTop from "@/components/ui/BackToTop";
import { getAnnouncements } from "@/lib/content";
import { isKind, type Kind } from "@/lib/announcementKinds";
import { pageMetadata } from "@/lib/seo";

// ประกาศแก้ได้จากหลังบ้าน จึงอ่านฐานทุกครั้ง (และตอน build ยังไม่มี DATABASE_URL)
export const dynamic = "force-dynamic";

// ตั้งค่า SEO ของหน้านี้ที่ /admin/seo — หน้าที่ยังไม่ได้เพิ่มในนั้นถือว่าไม่ให้เก็บ
export const generateMetadata = () => pageMetadata("/news");

/**
 * เอามาให้หมด ไม่ต้องแบ่งหน้า — ทั้งเว็บมีเอกสารรวมกันสามสิบกว่าฉบับ
 * ถ้าวันหนึ่งสะสมจนเป็นหลักร้อย ค่อยมาเพิ่มการแบ่งหน้าทีหลัง
 */
const TAKE = 500;

export default async function NewsPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  const { kind } = await searchParams;
  // ปุ่ม "ดูทั้งหมด →" บนหน้าแรกติดหมวดที่กำลังอ่านอยู่มาด้วย จะได้เปิดมาตรงแท็บเดิม
  const initialKind: Kind = isKind(kind) ? kind : "ANNOUNCEMENT";

  const items = await getAnnouncements(TAKE);

  return (
    <>
      <PageTracker />
      <ScrollProgress />
      <Header />
      <main>
        <section className="bg-gradient-to-b from-brand-600 to-brand-400 py-10 text-center text-white">
          <div className="mx-auto max-w-6xl px-4">
            <h1 className="text-2xl font-bold md:text-3xl">ประกาศและเอกสารเผยแพร่</h1>
            <p className="mt-2 text-sm text-white/85">
              ประกาศสหกรณ์ จดหมายข่าว และรายงานกิจการประจำปี ทั้งหมดที่เผยแพร่แล้ว
            </p>
          </div>
        </section>

        <div className="mx-auto w-full max-w-3xl px-4 py-8">
          <NewsArchive items={items} initialKind={initialKind} />
        </div>
      </main>
      <BackToTop />
      <Footer />
    </>
  );
}
