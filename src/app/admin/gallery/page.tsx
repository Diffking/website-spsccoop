import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { ADMIN_HOME, canArea } from "@/lib/permissions";
import { getAlbumsForAdmin } from "@/lib/gallery";
import GalleryManager from "@/components/admin/GalleryManager";
import PublishDelayNote from "@/components/admin/PublishDelayNote";

export default async function Page() {
  const user = await currentUser();
  if (!user) redirect("/login/");
  // เมนูซ่อนให้แล้ว ตรงนี้กันคนพิมพ์ที่อยู่เข้ามาเอง
  if (!canArea(user, "gallery")) redirect(ADMIN_HOME);

  const items = await getAlbumsForAdmin();

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-1 text-xl font-bold text-gray-800">ภาพกิจกรรม</h1>
      <p className="mb-3 text-sm text-gray-500">
        เก็บภาพเด่นอัลบั้มละ 1 ภาพ ภาพที่เหลืออยู่บน Google Photos ผ่านลิงก์ · แยกหน้าตามปีบัญชี (1 ต.ค. – 30 ก.ย.) · อัลบั้มที่ติ๊ก “ขึ้นสไลด์หน้าแรก” ใหม่สุด 8 อัลบั้มจะวนบนหน้าแรก
      </p>
      <PublishDelayNote />
      <GalleryManager items={items} />
    </main>
  );
}
