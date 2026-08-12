import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getItemsForAdmin } from "@/lib/homeItems";
import { getCommitteeSet } from "@/lib/settings";
import { committeeFolder, storageTarget } from "@/lib/ftp";
import HomeItemsManager from "@/components/admin/HomeItemsManager";
import CommitteeSetForm from "@/components/admin/CommitteeSetForm";

export default async function Page() {
  const user = await currentUser();
  if (!user) redirect("/admin/");

  const [items, set] = await Promise.all([getItemsForAdmin("committees"), getCommitteeSet()]);
  const storage = storageTarget();

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-1 text-xl font-bold text-gray-800">คณะกรรมการดำเนินการ</h1>
      <p className="mb-5 text-sm text-gray-500">สไลด์เล็กข้างการ์ดประกาศบนหน้าแรก</p>

      <div className="space-y-5">
        <CommitteeSetForm initial={set} storageBase={storage.kind === "ftp" ? storage.label : ""} />

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
