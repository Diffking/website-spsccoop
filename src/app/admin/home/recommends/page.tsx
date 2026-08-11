import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getItemsForAdmin } from "@/lib/homeItems";
import HomeItemsManager from "@/components/admin/HomeItemsManager";

export default async function Page() {
  const user = await currentUser();
  if (!user) redirect("/admin/");

  const items = await getItemsForAdmin("recommends");

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-1 text-xl font-bold text-gray-800">แนะนำสมาชิก</h1>
      <p className="mb-5 text-sm text-gray-500">การ์ดใหญ่ 3 ใบ เงินฝาก/เงินกู้/สวัสดิการ</p>

      <HomeItemsManager section="recommends" items={items} fields={["subtitle", "href", "theme"]} titleLabel="หัวข้อการ์ด" />
    </main>
  );
}
