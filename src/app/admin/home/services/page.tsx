import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { ADMIN_HOME, canArea } from "@/lib/permissions";
import { getItemsForAdmin } from "@/lib/homeItems";
import HomeItemsManager from "@/components/admin/HomeItemsManager";

export default async function Page() {
  const user = await currentUser();
  if (!user) redirect("/login/");
  // ไม่ได้ดูแลส่วนนี้ก็ไม่ต้องเห็น — เมนูซ่อนให้แล้ว ตรงนี้กันคนพิมพ์ที่อยู่เข้ามาเอง
  if (!canArea(user, "home.services")) redirect(ADMIN_HOME);

  const items = await getItemsForAdmin("services");

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-1 text-xl font-bold text-gray-800">บริการของเรา</h1>
      <p className="mb-5 text-sm text-gray-500">แถวไอคอนบริการกลางหน้าแรก</p>

      <HomeItemsManager grouped section="services" items={items} fields={["icon", "href"]} titleLabel="ชื่อบริการ" />
    </main>
  );
}
