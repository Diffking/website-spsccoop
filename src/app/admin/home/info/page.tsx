import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getSiteInfo } from "@/lib/settings";
import SiteInfoForm from "@/components/admin/SiteInfoForm";

export default async function AdminSiteInfoPage() {
  const user = await currentUser();
  if (!user) redirect("/admin/");

  const siteInfo = await getSiteInfo();

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-1 text-xl font-bold text-gray-800">ข้อมูลสหกรณ์</h1>
      <p className="mb-5 text-sm text-gray-500">ที่อยู่ เบอร์โทร อีเมล เวลาทำการ</p>

      <SiteInfoForm initial={siteInfo} />
    </main>
  );
}
