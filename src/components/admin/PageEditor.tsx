"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Trash2, Loader2, Eye, Pencil } from "lucide-react";

type Props = {
  page: { id: string; slug: string; title: string; body: string; published: boolean };
};

export default function PageEditor({ page }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(page.title);
  const [slug, setSlug] = useState(page.slug);
  const [content, setContent] = useState(page.body);
  const [published, setPublished] = useState(page.published);
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setStatus(null);

    const response = await fetch(`/api/admin/pages/${page.id}/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, slug, content, published }),
    });
    const data = await response.json().catch(() => ({}));

    if (response.ok) {
      setStatus({ kind: "ok", text: "บันทึกแล้ว" });
      setSlug(data.page.slug);
      router.refresh();
    } else {
      setStatus({ kind: "error", text: data.error ?? "บันทึกไม่สำเร็จ" });
    }
    setBusy(false);
  }

  async function remove() {
    if (!confirm(`ลบหน้า "${title}" ถาวร?\nเนื้อหาที่พิมพ์ไว้จะหายทั้งหมด`)) return;
    setBusy(true);
    await fetch(`/api/admin/pages/${page.id}/`, { method: "DELETE" });
    router.push("/admin/pages/");
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <label className="block text-sm text-gray-600">
          ชื่อหน้า
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-base outline-none focus:border-brand-500"
          />
        </label>

        <label className="mt-3 block text-sm text-gray-600">
          ที่อยู่หน้า
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm outline-none focus:border-brand-500"
          />
        </label>

        <label className="mt-4 flex items-center gap-2.5 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300"
          />
          เผยแพร่หน้านี้บนเว็บไซต์
          <span className="text-xs text-gray-400">(ไม่ติ๊ก = เก็บเป็นฉบับร่าง คนนอกไม่เห็น)</span>
        </label>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
        <div className="flex border-b border-gray-100">
          {(
            [
              ["edit", "แก้ไข", Pencil],
              ["preview", "ดูตัวอย่าง", Eye],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm transition ${
                tab === key
                  ? "border-b-2 border-brand-500 font-medium text-brand-700"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>

        {tab === "edit" ? (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={16}
            placeholder="พิมพ์เนื้อหาที่นี่ ใส่แท็ก HTML ได้ เช่น <h2>หัวข้อ</h2> <p>ย่อหน้า</p>"
            className="w-full resize-y p-4 font-mono text-sm leading-relaxed outline-none"
          />
        ) : (
          <div
            className="prose-page min-h-[16rem] p-4"
            dangerouslySetInnerHTML={{ __html: content }}
          />
        )}
      </div>

      {status && (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            status.kind === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
          }`}
        >
          {status.text}
        </p>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={save}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          บันทึก
        </button>
        <button
          onClick={remove}
          disabled={busy}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-red-600 transition hover:bg-red-50"
        >
          <Trash2 className="h-4 w-4" /> ลบหน้านี้
        </button>
      </div>
    </div>
  );
}
