import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { currentUser } from "@/lib/auth";
import { ADMIN_HOME, canAnyPage, filterPages, hasFullAccess } from "@/lib/permissions";
import { db } from "@/lib/db";
import PagesManager from "@/components/admin/PagesManager";
import { designedPageOf } from "@/lib/designedPages";

export default async function AdminPagesPage() {
  const user = await currentUser();
  if (!user) redirect("/login/");
  // ไม่ได้ดูแลหน้าเนื้อหาสักหมวดก็ไม่ต้องเห็น — เมนูซ่อนให้แล้ว ตรงนี้กันคนพิมพ์ที่อยู่เข้ามาเอง
  if (!canAnyPage(user)) redirect(ADMIN_HOME);

  const all = await db.page.findMany({
    orderBy: { slug: "asc" },
    select: {
      id: true,
      slug: true,
      title: true,
      published: true,
      updatedAt: true,
      category: true,
    },
  });

  /*
   * หน้าที่ระบบจัดหน้าให้เอง (เช่น ติดต่อเรา) ไม่ใช่หน้าเนื้อหาธรรมดา
   * กดเข้าไปจะเจอช่อง HTML ว่าง ๆ ทั้งที่หน้าเว็บมีของเต็มไปหมด — แยกไปอยู่เมนูของมันเอง
   * แต่ยังกดเข้าไปพิมพ์ข้อความเพิ่มได้จากเมนูนั้น
   */
  // เห็นเฉพาะหมวดที่ตัวเองดูแล — คนดูแลหมวดเดียวจะได้ไม่ต้องเลื่อนผ่านหน้าของคนอื่น
  const pages = filterPages(user, all);
  const designed = pages.filter((p) => designedPageOf(p.slug));
  const normal = pages.filter((p) => !designedPageOf(p.slug));

  return (
    <>
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3">
          <Link href="/admin/" className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <p className="font-semibold text-gray-800">หน้าเนื้อหา</p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-4 px-4 py-5">
        <PagesManager
          pages={normal.map((p) => ({ ...p, updatedAt: p.updatedAt.toISOString() }))}
          canRenameCategory={hasFullAccess(user) || user.areas.includes("pages")}
        />

        {designed.length > 0 && (
          <Link
            href="/admin/designed/"
            className="flex items-start gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 transition hover:bg-gray-50"
          >
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
            <span className="min-w-0 flex-1">
              <span className="block font-medium text-gray-800">
                หน้าออกแบบอัตโนมัติ ({designed.length})
              </span>
              <span className="block text-sm text-gray-500">
                {designed.map((p) => p.title).join(" · ")} — ระบบจัดหน้าให้เอง
                แก้ได้ที่เมนูหน้าออกแบบอัตโนมัติ
              </span>
            </span>
            <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-gray-300" />
          </Link>
        )}
      </main>
    </>
  );
}
