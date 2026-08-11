import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getItemsForAdmin } from "@/lib/homeItems";
import HomeItemsManager from "@/components/admin/HomeItemsManager";

export default async function Page() {
  const user = await currentUser();
  if (!user) redirect("/admin/");

  const items = await getItemsForAdmin("footerLinks");

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-1 text-xl font-bold text-gray-800">ลิงก์หน่วยงานท้ายเว็บ</h1>
      <p className="mb-5 text-sm text-gray-500">รายการลิงก์ในส่วนท้ายของทุกหน้า</p>

      <HomeItemsManager section="footerLinks" items={items} fields={["href"]} titleLabel="ชื่อหน่วยงาน" />
    </main>
  );
}
