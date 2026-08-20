import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { ADMIN_HOME, canArea } from "@/lib/permissions";
import { db } from "@/lib/db";
import { AI_READY } from "@/lib/ai";
import { storageTarget } from "@/lib/ftp";
import { KINDS, KIND_FOLDER, KIND_LABEL, type Kind } from "@/lib/announcementKinds";
import AnnouncementsManager from "@/components/admin/AnnouncementsManager";
import StorageStatus from "@/components/admin/StorageStatus";

export default async function AdminAnnouncementsPage() {
  const user = await currentUser();
  if (!user) redirect("/login/");
  // ไม่ได้ดูแลส่วนนี้ก็ไม่ต้องเห็น — เมนูซ่อนให้แล้ว ตรงนี้กันคนพิมพ์ที่อยู่เข้ามาเอง
  if (!canArea(user, "home.announcements")) redirect(ADMIN_HOME);

  const announcements = await db.announcement.findMany({ orderBy: { publishedAt: "desc" } });
  const storage = storageTarget();

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-1 text-xl font-bold text-gray-800">ประกาศ / จดหมายข่าว / รายงานกิจการ</h1>
      <p className="mb-5 text-sm text-gray-500">เอกสารที่ขึ้นการ์ดสามแท็บบนหน้าแรก</p>

      {/* ไฟล์แต่ละหมวดลงคนละโฟลเดอร์ แสดงให้ครบว่าอันไหนไปไหน */}
      <StorageStatus
        kind={storage.kind}
        label={storage.label}
        folders={KINDS.map((k) => ({ name: KIND_FOLDER[k], label: KIND_LABEL[k] }))}
      />

      <AnnouncementsManager
        aiReady={AI_READY}
        items={announcements.map((a) => ({
          id: a.id,
          number: a.number,
          title: a.title,
          kind: a.kind as Kind,
          badge: a.badge,
          hideNumber: a.hideNumber,
          publishedAt: a.publishedAt.toISOString().slice(0, 10),
          fileUrl: a.fileUrl,
          published: a.published,
        }))}
      />
    </main>
  );
}
