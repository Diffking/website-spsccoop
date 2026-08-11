import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getComponentModes } from "@/lib/settings";
import { AI_READY } from "@/lib/ai";
import SlidesManager from "@/components/admin/SlidesManager";

export default async function AdminSlidesPage() {
  const user = await currentUser();
  if (!user) redirect("/admin/");

  const [slides, modes] = await Promise.all([
    db.slide.findMany({ orderBy: { sortOrder: "asc" } }),
    getComponentModes(),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-1 text-xl font-bold text-gray-800">แบนเนอร์สไลด์</h1>
      <p className="mb-5 text-sm text-gray-500">ภาพใหญ่ที่เลื่อนอยู่บนสุดของหน้าแรก</p>

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
    </main>
  );
}
