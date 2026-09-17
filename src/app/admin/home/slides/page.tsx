import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { ADMIN_HOME, canArea } from "@/lib/permissions";
import { db } from "@/lib/db";
import { AI_READY } from "@/lib/ai";
import SlidesManager, { type DocLink } from "@/components/admin/SlidesManager";
import StorageStatus from "@/components/admin/StorageStatus";
import { getAnnouncements } from "@/lib/content";
import { KIND_LABEL, announcementLine, readerHref } from "@/lib/announcementKinds";

export default async function AdminSlidesPage() {
  const user = await currentUser();
  if (!user) redirect("/login/");
  // ไม่ได้ดูแลส่วนนี้ก็ไม่ต้องเห็น — เมนูซ่อนให้แล้ว ตรงนี้กันคนพิมพ์ที่อยู่เข้ามาเอง
  if (!canArea(user, "home.slides")) redirect(ADMIN_HOME);

  const slides = await db.slide.findMany({ orderBy: { sortOrder: "asc" } });

  /*
   * รายการเอกสารให้เลือกเป็นปลายทางของสไลด์
   *
   * ⚠️ ที่อยู่ปลายทางคิดด้วย readerHref ตัวเดียวกับหน้าแรก — ห้ามประกอบ /ebook/<id>/ เองที่นี่
   * ไม่งั้นวันหลังแก้กฎว่าหมวดไหนอ่านแบบ E-Book แล้วหลังบ้านจะพาไปคนละที่กับที่หน้าเว็บพาไป
   * · ตัวที่ยังไม่มีไฟล์แนบถูกตัดออก (readerHref คืน null) จะได้ไม่มีให้เลือกแล้วกดไปเจอที่ว่าง
   */
  const docs: DocLink[] = (await getAnnouncements(500))
    .map((a) => {
      const href = readerHref(a.kind, a.id, a.href);
      return href
        ? {
            href,
            label: `${announcementLine(a.kind, a.number, a.title, a.hideNumber)} · ${a.date}`,
            group: KIND_LABEL[a.kind],
          }
        : null;
    })
    .filter((d): d is DocLink => d !== null);

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-1 text-xl font-bold text-gray-800">แบนเนอร์สไลด์</h1>
      <p className="mb-5 text-sm text-gray-500">ภาพใหญ่ที่เลื่อนอยู่บนสุดของหน้าแรก</p>

      <StorageStatus />

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
        docs={docs}
      />
    </main>
  );
}
