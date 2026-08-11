"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Eye, EyeOff, Loader2, Save, X } from "lucide-react";

export type AnnouncementRow = {
  id: string;
  number: string;
  title: string;
  publishedAt: string; // YYYY-MM-DD
  fileUrl: string | null;
  published: boolean;
};

const empty = { number: "", title: "", publishedAt: "", fileUrl: "" };

/** วันที่แบบไทย เช่น 30 มิ.ย. 2569 */
function thaiDate(iso: string): string {
  const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${months[m - 1]} ${y + 543}`;
}

export default function AnnouncementsManager({ items }: { items: AnnouncementRow[] }) {
  const router = useRouter();
  const [form, setForm] = useState(empty);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function send(url: string, method: string, body?: unknown) {
    const response = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? "ดำเนินการไม่สำเร็จ");
      return false;
    }
    setError("");
    return true;
  }

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setBusy("add");
    if (await send("/api/admin/announcements/", "POST", form)) {
      setForm(empty);
      setAdding(false);
      router.refresh();
    }
    setBusy("");
  }

  async function saveEdit(id: string) {
    setBusy(id);
    if (await send(`/api/admin/announcements/${id}/`, "PATCH", form)) {
      setEditingId("");
      setForm(empty);
      router.refresh();
    }
    setBusy("");
  }

  async function toggle(item: AnnouncementRow) {
    setBusy(item.id);
    await send(`/api/admin/announcements/${item.id}/`, "PATCH", { published: !item.published });
    setBusy("");
    router.refresh();
  }

  async function remove(item: AnnouncementRow) {
    if (!confirm(`ลบประกาศที่ ${item.number} "${item.title}" ?`)) return;
    setBusy(item.id);
    await send(`/api/admin/announcements/${item.id}/`, "DELETE");
    setBusy("");
    router.refresh();
  }

  const fields = (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          value={form.number}
          onChange={(e) => setForm({ ...form, number: e.target.value })}
          placeholder="เลขที่ เช่น 19/2569"
          className="w-40 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
        />
        <input
          type="date"
          value={form.publishedAt}
          onChange={(e) => setForm({ ...form, publishedAt: e.target.value })}
          className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
        />
      </div>
      <input
        value={form.title}
        onChange={(e) => setForm({ ...form, title: e.target.value })}
        placeholder="ชื่อเรื่องประกาศ"
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
      />
      <input
        value={form.fileUrl}
        onChange={(e) => setForm({ ...form, fileUrl: e.target.value })}
        placeholder="ลิงก์ไฟล์ PDF (เว้นว่างได้)"
        className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs outline-none focus:border-brand-500"
      />
    </div>
  );

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <h2 className="font-semibold text-gray-800">ประกาศสหกรณ์</h2>
      <p className="mt-0.5 text-xs text-gray-500">การ์ดประกาศบนหน้าแรก</p>

      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {adding ? (
        <form onSubmit={create} className="mt-3 rounded-xl bg-gray-50 p-3">
          {fields}
          <div className="mt-3 flex gap-2">
            <button
              type="submit"
              disabled={busy === "add"}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {busy === "add" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              เพิ่มประกาศ
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setForm(empty);
              }}
              className="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100"
            >
              ยกเลิก
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => {
            setAdding(true);
            setForm(empty);
            setEditingId("");
          }}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" /> เพิ่มประกาศ
        </button>
      )}

      <ul className="mt-3 divide-y divide-gray-100">
        {items.length === 0 && <li className="py-3 text-sm text-gray-400">ยังไม่มีประกาศ</li>}
        {items.map((item) =>
          editingId === item.id ? (
            <li key={item.id} className="py-3">
              <div className="rounded-xl bg-gray-50 p-3">
                {fields}
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => saveEdit(item.id)}
                    disabled={busy === item.id}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                  >
                    {busy === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    บันทึก
                  </button>
                  <button
                    onClick={() => setEditingId("")}
                    className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100"
                  >
                    <X className="h-4 w-4" /> ยกเลิก
                  </button>
                </div>
              </div>
            </li>
          ) : (
            <li key={item.id} className="flex items-start gap-2 py-2.5">
              <button
                onClick={() => {
                  setEditingId(item.id);
                  setAdding(false);
                  setForm({
                    number: item.number,
                    title: item.title,
                    publishedAt: item.publishedAt,
                    fileUrl: item.fileUrl ?? "",
                  });
                }}
                className="min-w-0 flex-1 text-left"
              >
                <span
                  className={`block truncate text-sm ${
                    item.published ? "text-gray-700" : "text-gray-400 line-through"
                  }`}
                >
                  ประกาศที่ {item.number} {item.title}
                </span>
                <span className="block text-xs text-gray-400">{thaiDate(item.publishedAt)}</span>
              </button>
              <button
                onClick={() => toggle(item)}
                disabled={busy === item.id}
                title={item.published ? "ซ่อนจากหน้าเว็บ" : "แสดงบนหน้าเว็บ"}
                className="shrink-0 rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
              >
                {item.published ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </button>
              <button
                onClick={() => remove(item)}
                disabled={busy === item.id}
                className="shrink-0 rounded-lg p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ),
        )}
      </ul>
    </section>
  );
}
