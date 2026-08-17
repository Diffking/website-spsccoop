import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, Check, ExternalLink, Sparkles, Wrench } from "lucide-react";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { DESIGNED_PAGES } from "@/lib/designedPages";
import DesignedExtraContent from "@/components/admin/DesignedExtraContent";

/**
 * หน้าออกแบบอัตโนมัติ — แยกออกจาก "หน้าเนื้อหา" เพราะทำงานคนละแบบ
 *
 * หน้าเนื้อหา = พิมพ์ HTML เอง ระบบเอาไปแสดงตามที่พิมพ์
 * หน้าออกแบบอัตโนมัติ = ระบบจัดหน้าให้เอง เจ้าหน้าที่แค่กรอกข้อมูลในหน้าตั้งค่า
 * ถ้าเอามาปนอยู่รายการเดียวกัน กดเข้าไปแล้วเจอช่อง HTML ว่าง ๆ จะงงว่าหน้าจริงมาจากไหน
 */

export const dynamic = "force-dynamic";

export default async function DesignedPagesAdmin() {
  const user = await currentUser();
  if (!user) redirect("/admin/");

  // หน้าเนื้อหาที่ slug ตรงกัน = ที่เก็บ "เนื้อหาเพิ่มเติม" ของหน้านั้น
  const rows = await db.page
    .findMany({
      where: { slug: { in: DESIGNED_PAGES.map((p) => p.slug) } },
      select: { id: true, slug: true, title: true, published: true },
    })
    .catch(() => []);

  return (
    <>
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3">
          <Link href="/admin/" className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <p className="font-semibold text-gray-800">หน้าออกแบบอัตโนมัติ</p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-4 px-4 py-5">
        <p className="rounded-2xl bg-brand-50 p-4 text-sm text-brand-900 ring-1 ring-brand-100">
          หน้าในนี้ระบบจัดหน้าให้เองทั้งหมด ไม่ต้องพิมพ์ HTML — แก้แค่ข้อมูล แล้วหน้าเว็บเปลี่ยนตาม
          <span className="mt-1 block text-brand-800/80">
            ที่ต้องทำแบบนี้เพราะมีของที่พิมพ์เป็นเนื้อหาไม่ได้ เช่นแผนที่ที่กดนำทางได้
            ปุ่มขอตำแหน่งปัจจุบัน และคิวอาร์ที่สร้างสดตอนกด
          </span>
        </p>

        {DESIGNED_PAGES.map((page) => {
          const row = rows.find((r) => r.slug === page.slug);

          return (
            <section
              key={page.slug}
              className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5"
            >
              <div className="flex flex-wrap items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
                  <Sparkles className="h-5 w-5" />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-800">{row?.title?.trim() || page.title}</p>
                  <p className="text-sm text-gray-500">{page.desc}</p>
                  <p className="mt-0.5 font-mono text-xs text-gray-400">{page.path}</p>
                </div>

                <a
                  href={page.path}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600 ring-1 ring-gray-200 transition hover:bg-gray-100"
                >
                  <ExternalLink className="h-4 w-4" /> เปิดดูหน้าเว็บ
                </a>
              </div>

              {/* ของที่ระบบทำให้เอง — กันเข้าใจผิดว่าต้องไปพิมพ์เอง */}
              <ul className="mt-4 grid gap-1.5 sm:grid-cols-2">
                {page.features.map((feature) => (
                  <li key={feature} className="flex gap-2 text-sm text-gray-600">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    {feature}
                  </li>
                ))}
              </ul>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {page.settings.map((setting) => (
                  <Link
                    key={setting.href}
                    href={setting.href}
                    className="flex items-start gap-2 rounded-xl bg-gray-50 p-3 ring-1 ring-gray-200 transition hover:bg-gray-100"
                  >
                    <Wrench className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-gray-800">
                        แก้{setting.label}
                      </span>
                      <span className="block text-xs text-gray-500">{setting.hint}</span>
                    </span>
                  </Link>
                ))}

                {/* เนื้อหาเพิ่มเติมยังเป็นหน้าเนื้อหาธรรมดา แค่ไปโผล่ต่อท้ายหน้าที่ออกแบบไว้ */}
                {page.acceptsExtraContent && (
                  <DesignedExtraContent
                    slug={page.slug}
                    title={page.title}
                    pageId={row?.id}
                    published={row?.published}
                  />
                )}
              </div>
            </section>
          );
        })}
      </main>
    </>
  );
}
