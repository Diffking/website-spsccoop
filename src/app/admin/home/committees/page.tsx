import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getItemsForAdmin } from "@/lib/homeItems";
import HomeItemsManager from "@/components/admin/HomeItemsManager";

export default async function Page() {
  const user = await currentUser();
  if (!user) redirect("/admin/");

  const items = await getItemsForAdmin("committees");

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-1 text-xl font-bold text-gray-800">คณะกรรมการ (สไลด์หน้าแรก)</h1>
      <p className="mb-5 text-sm text-gray-500">สไลด์เล็กข้างการ์ดประกาศ</p>

      <HomeItemsManager section="committees" items={items} fields={["subtitle", "imageUrl"]} titleLabel="ชื่อ-สกุล" />
    </main>
  );
}
