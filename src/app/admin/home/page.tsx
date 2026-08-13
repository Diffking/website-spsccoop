import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import HomePreview from "@/components/admin/HomePreview";
import HomeSectionsForm from "@/components/admin/HomeSectionsForm";
import { getHomeOrder, getHomeSections, getHomeTones } from "@/lib/settings";

export default async function AdminHomePage() {
  const user = await currentUser();
  if (!user) redirect("/admin/");

  const [sections, tones, order] = await Promise.all([
    getHomeSections(),
    getHomeTones(),
    getHomeOrder(),
  ]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <h1 className="mb-1 text-xl font-bold text-gray-800">หน้าแรก</h1>
      <p className="mb-5 text-sm text-gray-500">
        เลือกส่วนที่จะแก้จากแถบด้านบน หรือกดดูพรีวิวหน้าแรกของจริง
      </p>

      <div className="space-y-5">
        <HomeSectionsForm initial={sections} initialTones={tones} initialOrder={order} />
        <HomePreview />
      </div>
    </main>
  );
}
