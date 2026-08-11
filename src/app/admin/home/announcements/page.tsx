import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import AnnouncementsManager from "@/components/admin/AnnouncementsManager";

export default async function AdminAnnouncementsPage() {
  const user = await currentUser();
  if (!user) redirect("/admin/");

  const announcements = await db.announcement.findMany({ orderBy: { publishedAt: "desc" } });

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-1 text-xl font-bold text-gray-800">ประกาศสหกรณ์</h1>
      <p className="mb-5 text-sm text-gray-500">การ์ดประกาศบนหน้าแรก</p>

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
    </main>
  );
}
