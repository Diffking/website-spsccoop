import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import Header from "@/components/site/Header";
import Footer from "@/components/site/Footer";
import PageTracker from "@/components/site/PageTracker";
import BackToTop from "@/components/ui/BackToTop";
import { getArchivedAnnouncements, getArchiveYears } from "@/lib/content";
import { announcementLine, readerHref } from "@/lib/announcementKinds";
import { pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ year: string }> };

export async function generateMetadata({ params }: Params) {
  const { year } = await params;
  const meta = await pageMetadata(`/news/archive/${year}`);
  return { ...meta, title: `ประกาศปีบัญชี ${year}` };
}

/**
 * คลังประกาศของปีบัญชีหนึ่ง (16 พ.ย. 2569) — ประกาศที่จัดเก็บแล้วไม่ขึ้นหน้าแรก/หน้ารวม ย้ายมาอยู่ที่นี่
 * จัดเก็บ/ย้ายกลับได้ที่ หลังบ้าน → ประกาศ / จดหมายข่าว → คลังประกาศตามปีบัญชี
 */
export default async function ArchiveYearPage({ params }: Params) {
  const { year } = await params;
  const fy = /^\d{4}$/.test(year) ? Number(year) : NaN;
  if (!(fy >= 2560 && fy <= 2700)) notFound();
  const [items, years] = await Promise.all([getArchivedAnnouncements(fy), getArchiveYears()]);
  if (items.length === 0) notFound();

  return (
    <>
      <PageTracker />
      <Header />
      <main>
        <section className="bg-gradient-to-b from-brand-600 to-brand-400 py-10 text-center text-white">
          <div className="mx-auto max-w-6xl px-4">
            <h1 className="text-2xl font-bold md:text-3xl">ประกาศปีบัญชี {fy}</h1>
            <p className="mt-2 text-sm text-white/85">
              1 ตุลาคม {fy - 1} – 30 กันยายน {fy} · {items.length} ฉบับ
            </p>
          </div>
        </section>

        <div className="mx-auto w-full max-w-3xl px-4 py-8">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Link href="/news/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand-600">
              <ArrowLeft className="h-4 w-4" /> ประกาศปัจจุบัน
            </Link>
            {years.length > 1 && (
              <div className="ml-auto flex flex-wrap gap-2">
                {years.map((y) => (
                  <Link
                    key={y}
                    href={`/news/archive/${y}/`}
                    aria-current={y === fy ? "page" : undefined}
                    className={`inline-flex min-h-9 items-center rounded-full px-3 text-sm font-medium ring-1 ${
                      y === fy ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-brand-700 ring-brand-100 hover:bg-brand-50"
                    }`}
                  >
                    ปีบัญชี {y}
                  </Link>
                ))}
              </div>
            )}
          </div>

          <ul className="grid grid-cols-1 gap-2">
            {items.map((a) => {
              const href = readerHref(a.kind, a.id, a.href);
              const line = announcementLine(a.kind, a.number, a.title, a.hideNumber);
              const body = (
                <>
                  <FileText className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium leading-relaxed text-gray-800">{line}</span>
                    <span className="mt-0.5 block text-xs text-gray-500">{a.date}</span>
                  </span>
                </>
              );
              const shell = "flex min-w-0 items-start gap-3 rounded-xl px-4 py-3 ring-1 ring-black/5 transition";
              return (
                <li key={a.id} className="min-w-0">
                  {href ? (
                    <a href={href} target="_blank" rel="noopener noreferrer" className={`${shell} bg-white hover:bg-brand-50/60`}>
                      {body}
                    </a>
                  ) : (
                    <div className={`${shell} bg-white`}>{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </main>
      <BackToTop />
      <Footer />
    </>
  );
}
