import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import PagesManager from "@/components/admin/PagesManager";

export default async function AdminPagesPage() {
  const user = await currentUser();
  if (!user) redirect("/admin/");

  const pages = await db.page.findMany({
    orderBy: { slug: "asc" },
    select: { id: true, slug: true, title: true, published: true, updatedAt: true },
  });

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

      <main className="mx-auto max-w-6xl px-4 py-5">
        <PagesManager
          pages={pages.map((p) => ({ ...p, updatedAt: p.updatedAt.toISOString() }))}
        />
      </main>
    </>
  );
}
