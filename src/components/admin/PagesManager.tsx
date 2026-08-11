"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, ChevronRight, Loader2, CircleDot, Circle } from "lucide-react";

export type PageRow = {
  id: string;
  slug: string;
  title: string;
  published: boolean;
  updatedAt: string;
};

export default function PagesManager({ pages }: { pages: PageRow[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);

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

      {pages.length === 0 ? (
        <p className="rounded-2xl bg-white p-6 text-center text-sm text-gray-500 shadow-sm ring-1 ring-black/5">
          ยังไม่มีหน้าเนื้อหา — กด &ldquo;เพิ่มหน้าใหม่&rdquo; เพื่อเริ่ม
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
          {pages.map((page) => (
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
                  <span className="block truncate font-mono text-xs text-gray-400">/{page.slug}/</span>
                </span>
                <span className="shrink-0 text-xs text-gray-400">
                  {page.published ? "เผยแพร่" : "ฉบับร่าง"}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
