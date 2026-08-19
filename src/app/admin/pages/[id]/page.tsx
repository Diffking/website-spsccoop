import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { AI_READY } from "@/lib/ai";
import PageEditor from "@/components/admin/PageEditor";
import { pageFolder } from "@/lib/ftp";
import { usedCategories } from "@/lib/pageGroups";

export default async function EditPagePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/admin/");

  const { id } = await params;
  // สวิตช์ AI ที่ผู้ใช้เลือกไว้ครั้งก่อน — ไม่เคยเลือก ถือว่าเปิด
  const aiFormatDefault = (await cookies()).get("spsc_page_ai_format")?.value !== "0";
  const page = await db.page.findUnique({ where: { id } });
  if (!page) notFound();

  // หมวดที่หน้าอื่นใช้อยู่ — ให้เลือกซ้ำได้ จะได้ไม่มีหมวดชื่อคล้ายกันแต่สะกดต่างกัน
  const others = await db.page
    .findMany({ select: { slug: true, category: true } })
    .catch(() => []);

  return (
    <>
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3">
          <Link href="/admin/pages/" className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <p className="truncate font-semibold text-gray-800">{page.title}</p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-5">
        <PageEditor
          page={{
            id: page.id,
            slug: page.slug,
            title: page.title,
            body: page.body,
            published: page.published,
            // หน้าเก่าที่สร้างก่อนมีช่องนี้ ยังไม่มีค่าในฐาน — คำนวณจาก slug ให้ไปก่อน
            assetFolder: page.assetFolder ?? pageFolder(page.slug),
            category: page.category ?? "",
          }}
          categories={usedCategories(others)}
          aiReady={AI_READY}
          aiFormatDefault={aiFormatDefault}
        />
      </main>
    </>
  );
}
