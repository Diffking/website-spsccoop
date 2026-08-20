import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { ADMIN_HOME, canArea } from "@/lib/permissions";
import { getBrand, getNav } from "@/lib/nav";
import { db } from "@/lib/db";
import BrandForm from "@/components/admin/BrandForm";
import NavMenuEditor from "@/components/admin/NavMenuEditor";

export default async function AdminHeaderPage() {
  const user = await currentUser();
  if (!user) redirect("/login/");
  // ไม่ได้ดูแลส่วนนี้ก็ไม่ต้องเห็น — เมนูซ่อนให้แล้ว ตรงนี้กันคนพิมพ์ที่อยู่เข้ามาเอง
  if (!canArea(user, "header")) redirect(ADMIN_HOME);

  const [nav, brand, pages] = await Promise.all([
    getNav(),
    getBrand(),
    // เอาไว้เช็คว่าเมนูแต่ละอันชี้ไปหน้าที่มีจริงไหม
    db.page.findMany({
      orderBy: { slug: "asc" },
      select: { id: true, slug: true, title: true, published: true },
    }),
  ]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="mb-1 text-xl font-bold text-gray-800">ส่วนหัวเว็บ</h1>
      <p className="mb-5 text-sm text-gray-500">ชื่อ โลโก้ และเมนูนำทางที่ขึ้นทุกหน้า</p>

      <div className="space-y-5">
        <BrandForm initial={brand} />
        <NavMenuEditor initial={nav} initialPages={pages} />
      </div>
    </main>
  );
}
