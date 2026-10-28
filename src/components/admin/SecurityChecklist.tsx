"use client";

import { useState } from "react";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";

type Item = { id: string; title: string; detail: string };
type State = Record<string, { done: boolean; by: string; at: string }>;

const when = (iso: string) =>
  new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "2-digit", timeZone: "Asia/Bangkok" }).format(
    new Date(iso),
  );

/** รายการค้างบนเครื่อง Windows — เว็บตรวจเองไม่ได้ ให้ ADMIN ติ๊กว่าจัดการแล้ว (บันทึกทันที) */
export default function SecurityChecklist({ items, initial }: { items: Item[]; initial: State }) {
  const [state, setState] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle(id: string) {
    const done = !state[id]?.done;
    setBusy(id);
    setError(null);
    const res = await fetch("/api/admin/security/checklist/", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, done }),
    }).catch(() => null);
    setBusy(null);
    const data = (await res?.json().catch(() => null)) as { item?: State[string]; error?: string } | null;
    if (!res?.ok || !data?.item) {
      setError(data?.error ?? "บันทึกไม่สำเร็จ");
      return;
    }
    setState((s) => ({ ...s, [id]: data.item! }));
  }

  return (
    <div>
      <ul className="grid grid-cols-1 divide-y divide-gray-100">
        {items.map((item) => {
          const s = state[item.id];
          return (
            <li key={item.id} className="flex min-w-0 items-start gap-3 py-3">
              <button
                type="button"
                onClick={() => void toggle(item.id)}
                disabled={busy !== null}
                aria-label={s?.done ? "ยกเลิกว่าจัดการแล้ว" : "ทำเครื่องหมายว่าจัดการแล้ว"}
                className="mt-0.5 shrink-0 disabled:opacity-50"
              >
                {busy === item.id ? (
                  <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                ) : s?.done ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                ) : (
                  <Circle className="h-5 w-5 text-amber-500" />
                )}
              </button>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium ${s?.done ? "text-gray-400 line-through" : "text-gray-800"}`}>{item.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-gray-500">{item.detail}</p>
                {s && (
                  <p className="mt-1 text-[11px] text-gray-400">
                    {s.done ? "จัดการแล้ว" : "ยกเลิกเครื่องหมาย"} โดย {s.by} · {when(s.at)}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
