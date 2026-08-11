import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import PageEditor from "@/components/admin/PageEditor";

export default async function EditPagePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/admin/");

  const { id } = await params;
  const page = await db.page.findUnique({ where: { id } });
  if (!page) notFound();

  return (
    <>
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3">
          <Link href="/admin/pages/" className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <p className="truncate font-semibold text-gray-800">{page.title}</p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-5">
        <PageEditor
          page={{
            id: page.id,
            slug: page.slug,
            title: page.title,
            body: page.body,
            published: page.published,
          }}
        />
      </main>
    </>
  );
}
