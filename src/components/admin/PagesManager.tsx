"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, ChevronRight, Loader2, CircleDot, Circle, Search, FolderOpen } from "lucide-react";
import { groupPages } from "@/lib/pageGroups";

export type PageRow = {
  id: string;
  slug: string;
  title: string;
  published: boolean;
  updatedAt: string;
  /** หมวดที่ตั้งเอง — ไม่ตั้งก็จัดกลุ่มตามที่อยู่หน้าให้ (ดู src/lib/pageGroups.ts) */
  category?: string | null;
};

export default function PagesManager({ pages }: { pages: PageRow[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  /** คำค้นในรายการ — พิมพ์ชื่อหน้าหรือที่อยู่ก็เจอ ไม่ต้องกวาดตาทีละบรรทัด */
  const [find, setFind] = useState("");

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");

    const response = await fetch("/api/admin/pages/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, slug }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(data.error ?? "สร้างหน้าไม่สำเร็จ");
      setBusy(false);
      return;
    }
    setTitle("");
    setSlug("");
    setAdding(false);
    setBusy(false);
    router.push(`/admin/pages/${data.page.id}/`);
  }

  const keyword = find.trim().toLowerCase();
  const matched = keyword
    ? pages.filter((page) =>
        [page.title, page.slug, page.category ?? ""].some((field) =>
          field.toLowerCase().includes(keyword),
        ),
      )
    : pages;
  const groups = groupPages(matched);

  return (
    <div className="space-y-4">
      {adding ? (
        <form onSubmit={create} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
          <p className="font-medium text-gray-800">เพิ่มหน้าใหม่</p>

          <label className="mt-3 block text-sm text-gray-600">
            ชื่อหน้า
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="เช่น ประวัติความเป็นมา"
              required
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-base outline-none focus:border-brand-500"
            />
          </label>

          <label className="mt-3 block text-sm text-gray-600">
            ที่อยู่หน้า (ต่อท้าย URL)
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="about/history"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm outline-none focus:border-brand-500"
            />
            <span className="mt-1 block text-xs text-gray-400">เว้นว่างได้ ระบบจะตั้งให้จากชื่อหน้า</span>
          </label>

          {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} สร้าง
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
            >
              ยกเลิก
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" /> เพิ่มหน้าใหม่
        </button>
      )}

      {/* ช่องค้นหา — หน้าเยอะแล้วกวาดตาหาทีละบรรทัดช้ากว่าพิมพ์สองสามตัวอักษร */}
      {pages.length > 6 && (
        <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-sm ring-1 ring-black/5">
          <Search className="h-4 w-4 shrink-0 text-gray-400" />
          <input
            value={find}
            onChange={(e) => setFind(e.target.value)}
            placeholder="ค้นหาจากชื่อหน้า ที่อยู่ หรือหมวด"
            className="w-full border-0 text-sm outline-none placeholder:text-gray-400"
          />
          {find && (
            <button
              type="button"
              onClick={() => setFind("")}
              className="shrink-0 rounded-lg px-2 py-1 text-xs text-gray-500 transition hover:bg-gray-100"
            >
              ล้าง
            </button>
          )}
        </div>
      )}

      {pages.length === 0 ? (
        <p className="rounded-2xl bg-white p-6 text-center text-sm text-gray-500 shadow-sm ring-1 ring-black/5">
          ยังไม่มีหน้าเนื้อหา — กด &ldquo;เพิ่มหน้าใหม่&rdquo; เพื่อเริ่ม
        </p>
      ) : groups.length === 0 ? (
        <p className="rounded-2xl bg-white p-6 text-center text-sm text-gray-500 shadow-sm ring-1 ring-black/5">
          ไม่เจอหน้าที่ตรงกับ &ldquo;{find}&rdquo;
        </p>
      ) : (
        groups.map((group) => (
          <section key={group.key} className="space-y-1.5">
            {/* หัวข้อกลุ่ม — ไม่ใช่ลำดับ แค่ชั้นวางให้หาเจอ */}
            <p className="flex items-center gap-1.5 px-1 text-xs font-semibold text-gray-500">
              <FolderOpen className="h-3.5 w-3.5 text-gray-400" />
              {group.key}
              <span className="font-normal text-gray-400">({group.pages.length})</span>
            </p>

            <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
              {group.pages.map((page) => (
                <li key={page.id}>
                  <Link
                    href={`/admin/pages/${page.id}/`}
                    className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-gray-50"
                  >
                    {page.published ? (
                      <CircleDot className="h-4 w-4 shrink-0 text-emerald-500" />
                    ) : (
                      <Circle className="h-4 w-4 shrink-0 text-gray-300" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-gray-800">{page.title}</span>
                      <span className="block truncate font-mono text-xs text-gray-400">
                        /{page.slug}/
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-gray-400">
                      {page.published ? "เผยแพร่" : "ฉบับร่าง"}
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

    </div>
  );
}
