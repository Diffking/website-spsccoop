import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { ADMIN_HOME, canArea } from "@/lib/permissions";
import { db } from "@/lib/db";
import { AI_READY } from "@/lib/ai";
import SlidesManager from "@/components/admin/SlidesManager";
import StorageStatus from "@/components/admin/StorageStatus";
import { storageTarget } from "@/lib/ftp";

export default async function AdminSlidesPage() {
  const user = await currentUser();
  if (!user) redirect("/admin/");
  // ไม่ได้ดูแลส่วนนี้ก็ไม่ต้องเห็น — เมนูซ่อนให้แล้ว ตรงนี้กันคนพิมพ์ที่อยู่เข้ามาเอง
  if (!canArea(user, "home.slides")) redirect(ADMIN_HOME);

  const slides = await db.slide.findMany({ orderBy: { sortOrder: "asc" } });

  const storage = storageTarget("banner_slide");

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-1 text-xl font-bold text-gray-800">แบนเนอร์สไลด์</h1>
      <p className="mb-5 text-sm text-gray-500">ภาพใหญ่ที่เลื่อนอยู่บนสุดของหน้าแรก</p>

      <StorageStatus kind={storage.kind} label={storage.label} />

      <SlidesManager
        items={slides.map((s) => ({
          id: s.id,
          imageUrl: s.imageUrl,
          title: s.title,
          caption: s.caption,
          href: s.href,
          published: s.published,
          startsAt: s.startsAt
            ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(s.startsAt)
            : "",
          endsAt: s.endsAt
            ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(s.endsAt)
            : "",
          eventDate: s.eventDate
            ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(s.eventDate)
            : "",
          eventType: s.eventType ?? "",
        }))}
        aiReady={AI_READY}
      />
    </main>
  );
}
