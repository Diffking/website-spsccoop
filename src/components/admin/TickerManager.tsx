"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Eye, EyeOff, Loader2 } from "lucide-react";

export type TickerRow = { id: string; text: string; published: boolean };

export default function TickerManager({ items }: { items: TickerRow[] }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState("");

  async function add(event: React.FormEvent) {
    event.preventDefault();
    if (!text.trim()) return;
    setBusy("add");
    await fetch("/api/admin/ticker/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    setText("");
    setBusy("");
    router.refresh();
  }

  async function toggle(item: TickerRow) {
    setBusy(item.id);
    await fetch(`/api/admin/ticker/${item.id}/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published: !item.published }),
    });
    setBusy("");
    router.refresh();
  }

  async function remove(item: TickerRow) {
    if (!confirm(`ลบข่าววิ่ง "${item.text}" ?`)) return;
    setBusy(item.id);
    await fetch(`/api/admin/ticker/${item.id}/`, { method: "DELETE" });
    setBusy("");
    router.refresh();
  }

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <h2 className="font-semibold text-gray-800">ข้อความเพิ่มเติม</h2>
      <p className="mt-0.5 text-xs text-gray-500">
        วิ่งต่อท้ายประกาศที่ระบบดึงมาให้อัตโนมัติ
      </p>

      <form onSubmit={add} className="mt-3 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="พิมพ์ข้อความใหม่..."
          className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
        />
        <button
          type="submit"
          disabled={busy === "add"}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {busy === "add" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          เพิ่ม
        </button>
      </form>

      <ul className="mt-3 divide-y divide-gray-100">
        {items.length === 0 && <li className="py-3 text-sm text-gray-400">ยังไม่มีข่าววิ่ง</li>}
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-2 py-2.5">
            <span
              className={`min-w-0 flex-1 text-sm ${
                item.published ? "text-gray-700" : "text-gray-400 line-through"
              }`}
            >
              {item.text}
            </span>
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
        ))}
      </ul>
    </section>
  );
}
