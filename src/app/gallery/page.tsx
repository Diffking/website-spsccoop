import GalleryView from "@/components/site/GalleryView";
import { currentFiscalYear } from "@/lib/gallery";
import { pageMetadata } from "@/lib/seo";

// อัลบั้มแก้ได้จากหลังบ้าน จึงอ่านฐานทุกครั้ง (และตอน build ยังไม่มี DATABASE_URL)
export const dynamic = "force-dynamic";

export const generateMetadata = () => pageMetadata("/gallery");

/** ภาพกิจกรรมสหกรณ์ — เปิดมาเจอปีบัญชีปัจจุบันเสมอ (1 ต.ค. – 30 ก.ย.) */
export default function GalleryPage() {
  return <GalleryView year={currentFiscalYear()} />;
}
