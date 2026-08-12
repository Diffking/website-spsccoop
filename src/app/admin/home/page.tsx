import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import HomePreview from "@/components/admin/HomePreview";

export default async function AdminHomePage() {
  const user = await currentUser();
  if (!user) redirect("/admin/");

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <h1 className="mb-1 text-xl font-bold text-gray-800">หน้าแรก</h1>
      <p className="mb-5 text-sm text-gray-500">
        เลือกส่วนที่จะแก้จากแถบด้านบน หรือกดดูพรีวิวหน้าแรกของจริง
      </p>

      <HomePreview />
    </main>
  );
}
