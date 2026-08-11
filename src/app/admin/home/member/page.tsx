import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getItemsForAdmin } from "@/lib/homeItems";
import HomeItemsManager from "@/components/admin/HomeItemsManager";

export default async function Page() {
  const user = await currentUser();
  if (!user) redirect("/admin/");

  const [features, links] = await Promise.all([
    getItemsForAdmin("memberFeatures"),
    getItemsForAdmin("memberLinks"),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-1 text-xl font-bold text-gray-800">สำหรับสมาชิก</h1>
      <p className="mb-5 text-sm text-gray-500">การ์ดบริการย่อยและปุ่มลิงก์ในส่วนสำหรับสมาชิก</p>

      <h2 className="mb-2 text-sm font-semibold text-brand-700">การ์ดบริการ</h2>
      <HomeItemsManager
        section="memberFeatures"
        items={features}
        fields={["subtitle", "icon", "href"]}
        titleLabel="หัวข้อการ์ด"
      />

      <h2 className="mb-2 mt-8 text-sm font-semibold text-brand-700">ปุ่มลิงก์</h2>
      <HomeItemsManager
        section="memberLinks"
        items={links}
        fields={["icon", "href"]}
        titleLabel="ชื่อปุ่ม"
      />
    </main>
  );
}
