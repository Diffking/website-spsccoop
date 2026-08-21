import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { ADMIN_HOME, canArea } from "@/lib/permissions";
import { getItemsForAdmin } from "@/lib/homeItems";
import { getCommitteePhotoScale, getCommitteeSet } from "@/lib/settings";
import { committeeFolder } from "@/lib/assetFolders";
import HomeItemsManager from "@/components/admin/HomeItemsManager";
import CommitteeSetForm from "@/components/admin/CommitteeSetForm";

export default async function Page() {
  const user = await currentUser();
  if (!user) redirect("/login/");
  // ไม่ได้ดูแลส่วนนี้ก็ไม่ต้องเห็น — เมนูซ่อนให้แล้ว ตรงนี้กันคนพิมพ์ที่อยู่เข้ามาเอง
  if (!canArea(user, "home.committees")) redirect(ADMIN_HOME);

  const [items, set, scale] = await Promise.all([
    getItemsForAdmin("committees"),
    getCommitteeSet(),
    getCommitteePhotoScale(),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-1 text-xl font-bold text-gray-800">คณะกรรมการดำเนินการ</h1>
      <p className="mb-5 text-sm text-gray-500">สไลด์เล็กข้างการ์ดประกาศบนหน้าแรก</p>

      <div className="space-y-5">
        <CommitteeSetForm initial={set} initialScale={scale} />

        {/* รูปกรรมการลงโฟลเดอร์ของชุดที่ตั้งไว้ เช่น assets/committees/set45 */}
        <HomeItemsManager
          section="committees"
          folder={committeeFolder(set)}
          items={items}
          fields={["subtitle", "imageUrl"]}
          titleLabel="ชื่อ-สกุล"
        />
      </div>
    </main>
  );
}
