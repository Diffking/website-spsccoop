import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { ADMIN_HOME, canArea } from "@/lib/permissions";
import { getSeo } from "@/lib/seo";
import SeoManager from "@/components/admin/SeoManager";

export default async function AdminSeoPage() {
  const user = await currentUser();
  if (!user) redirect("/login/");
  // ไม่ได้ดูแลส่วนนี้ก็ไม่ต้องเห็น — เมนูซ่อนให้แล้ว ตรงนี้กันคนพิมพ์ที่อยู่เข้ามาเอง
  if (!canArea(user, "seo")) redirect(ADMIN_HOME);

  const seo = await getSeo();

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-1 text-xl font-bold text-gray-800">SEO</h1>
      <p className="mb-5 text-sm text-gray-500">
        กำหนดจากที่นี่ที่เดียวว่าหน้าไหนให้เครื่องมือค้นหาเก็บ หน้าไหนไม่ให้เก็บ
      </p>

      <SeoManager initial={seo} />
    </main>
  );
}
