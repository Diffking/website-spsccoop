import Link from "next/link";
import Image from "next/image";
import { CalendarDays, ExternalLink, Images, MapPin } from "lucide-react";
import Header from "@/components/site/Header";
import Footer from "@/components/site/Footer";
import PageTracker from "@/components/site/PageTracker";
import BackToTop from "@/components/ui/BackToTop";
import { currentFiscalYear, getAlbumsOfYear, getFiscalYears } from "@/lib/gallery";
import { albumDateLabel, albumServiceName, fiscalRangeLabel } from "@/lib/galleryShared";

/**
 * หน้าภาพกิจกรรมสหกรณ์ของปีบัญชีหนึ่ง — ใช้ทั้ง /gallery/ (ปีปัจจุบัน) และ /gallery/<ปี>/
 *
 * การ์ดละอัลบั้ม: ภาพเด่นภาพเดียว (เก็บในเครื่องนี้) + เกี่ยวกับอะไร/วันไหน/ที่ไหน/รายละเอียด
 * กดภาพหรือปุ่มแล้วเปิดอัลบั้มเต็มบนบริการภายนอกในแท็บใหม่
 */
export default async function GalleryView({ year }: { year: number }) {
  const current = currentFiscalYear();
  const [albums, years] = await Promise.all([getAlbumsOfYear(year), getFiscalYears()]);
  // ปุ่มเลือกปี: ปีปัจจุบันขึ้นเสมอ (แม้ยังว่าง) + ทุกปีที่มีอัลบั้ม + ปีที่กำลังเปิดอยู่
  const pills = [...new Set([current, year, ...years])].sort((a, b) => b - a);

  return (
    <>
      <PageTracker />
      <Header />
      <main>
        <section className="bg-gradient-to-b from-brand-600 to-brand-400 py-10 text-center text-white">
          <div className="mx-auto max-w-6xl px-4">
            <h1 className="text-2xl font-bold md:text-3xl">กิจกรรมสหกรณ์ ประจำปี {year}</h1>
            <p className="mt-2 text-sm text-white/85">
              ปีบัญชี {fiscalRangeLabel(year)} · กด “ดูภาพทั้งหมด” เพื่อเปิดอัลบั้มเต็ม
            </p>
          </div>
        </section>

        <div className="mx-auto w-full max-w-6xl px-4 py-8">
          {pills.length > 1 && (
            <nav aria-label="เลือกปีบัญชี" className="mb-6 flex flex-wrap gap-2">
              {pills.map((fy) => (
                <Link
                  key={fy}
                  href={fy === current ? "/gallery/" : `/gallery/${fy}/`}
                  aria-current={fy === year ? "page" : undefined}
                  className={`inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold ring-1 transition ${
                    fy === year
                      ? "bg-brand-600 text-white ring-brand-600"
                      : "bg-white text-brand-700 ring-brand-100 hover:bg-brand-50"
                  }`}
                >
                  ปี {fy}
                </Link>
              ))}
            </nav>
          )}

          {albums.length === 0 ? (
            <div className="rounded-2xl bg-white px-6 py-16 text-center shadow-sm ring-1 ring-black/5">
              <Images className="mx-auto h-10 w-10 text-brand-300" aria-hidden="true" />
              <p className="mt-3 font-semibold text-gray-700">ยังไม่มีภาพกิจกรรมของปีบัญชี {year}</p>
              <p className="mt-1 text-sm text-gray-500">เจ้าหน้าที่จะทยอยลงภาพกิจกรรมให้ชมเร็ว ๆ นี้</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {albums.map((a) => (
                <article
                  key={a.id}
                  className="flex min-w-0 flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5"
                >
                  <a
                    href={a.albumUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative block aspect-[4/3] overflow-hidden bg-brand-50"
                    aria-label={`เปิดอัลบั้ม ${a.title}`}
                  >
                    <Image
                      src={a.coverUrl}
                      alt={a.title}
                      fill
                      sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw"
                      className="object-cover transition duration-300 group-hover:scale-[1.03]"
                    />
                    {a.photoCount ? (
                      <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-brand-800 shadow-sm">
                        <Images className="h-3.5 w-3.5" aria-hidden="true" />
                        {a.photoCount.toLocaleString("th-TH")} ภาพ
                      </span>
                    ) : null}
                  </a>

                  <div className="flex min-w-0 flex-1 flex-col gap-2.5 p-5">
                    <h2 className="text-lg font-bold leading-snug text-brand-800">{a.title}</h2>
                    <div className="flex flex-col gap-1.5 text-sm text-gray-700">
                      <span className="flex items-start gap-2">
                        <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
                        {albumDateLabel(new Date(a.eventDate))}
                      </span>
                      {a.place && (
                        <span className="flex items-start gap-2">
                          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
                          {a.place}
                        </span>
                      )}
                    </div>
                    {a.caption && <p className="flex-1 text-sm leading-relaxed text-gray-600">{a.caption}</p>}
                    <a
                      href={a.albumUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700"
                    >
                      ดูภาพทั้งหมด
                      <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    </a>
                    <span className="text-center text-xs text-gray-500">
                      เปิดใน {albumServiceName(a.albumUrl)} (แท็บใหม่)
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </main>
      <BackToTop />
      <Footer />
    </>
  );
}
