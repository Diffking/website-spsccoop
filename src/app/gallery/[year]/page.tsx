import { notFound } from "next/navigation";
import GalleryView from "@/components/site/GalleryView";
import { isFiscalYear } from "@/lib/galleryShared";
import { pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ year: string }> };

export async function generateMetadata({ params }: Params) {
  const { year } = await params;
  return pageMetadata(`/gallery/${year}`);
}

/** ภาพกิจกรรมของปีบัญชีย้อนหลัง เช่น /gallery/2569/ */
export default async function GalleryYearPage({ params }: Params) {
  const { year } = await params;
  const fy = /^\d{4}$/.test(year) ? Number(year) : NaN;
  if (!isFiscalYear(fy)) notFound();
  return <GalleryView year={fy} />;
}
