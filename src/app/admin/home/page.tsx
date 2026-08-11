import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getComponentModes, getRates, getSiteInfo } from "@/lib/settings";
import { AI_READY } from "@/lib/ai";
import HomeSettings from "@/components/admin/HomeSettings";
import SlidesManager from "@/components/admin/SlidesManager";
import TickerManager from "@/components/admin/TickerManager";
import AnnouncementsManager from "@/components/admin/AnnouncementsManager";

export default async function AdminHomePage() {
  const user = await currentUser();
  if (!user) redirect("/admin/");

  const [siteInfo, rates, tickers, announcements, slides, modes] = await Promise.all([
    getSiteInfo(),
    getRates(),
    db.newsTicker.findMany({ orderBy: { sortOrder: "asc" } }),
    db.announcement.findMany({ orderBy: { publishedAt: "desc" } }),
    db.slide.findMany({ orderBy: { sortOrder: "asc" } }),
    getComponentModes(),
  ]);

  return (
    <>
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3">
          <Link href="/admin/" className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <p className="font-semibold text-gray-800">หน้าแรก</p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-5">
        <SlidesManager
          items={slides.map((s) => ({
            id: s.id,
            imageUrl: s.imageUrl,
            title: s.title,
            caption: s.caption,
            href: s.href,
            published: s.published,
          }))}
          mode={modes.slides}
          aiReady={AI_READY}
        />

        <TickerManager items={tickers.map((t) => ({ id: t.id, text: t.text, published: t.published }))} />

        <AnnouncementsManager
          items={announcements.map((a) => ({
            id: a.id,
            number: a.number,
            title: a.title,
            publishedAt: a.publishedAt.toISOString().slice(0, 10),
            fileUrl: a.fileUrl,
            published: a.published,
          }))}
        />

        <HomeSettings
          initialSiteInfo={siteInfo}
          initialRates={rates}
          ratesMode={modes.rates}
          aiReady={AI_READY}
        />
      </main>
    </>
  );
}
