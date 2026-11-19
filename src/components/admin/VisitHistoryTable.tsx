"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";

type Row = {
  year: number;
  range: string;
  current: boolean;
  /** ยอดที่ระบบนับได้ · null = ไม่มีข้อมูล */
  system: number | null;
  /** ช่วงวันที่ที่ระบบมีข้อมูลจริง */
  coverage: string | null;
  /** ยอดที่ไอทีพิมพ์เอง */
  manual: number | null;
};

const fmt = (n: number) => n.toLocaleString("th-TH");

/** ตารางสถิติรายปี + ช่องพิมพ์ยอดเอง — บันทึกทีละปีตอนคลิกออกจากช่อง */
export default function VisitHistoryTable({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Record<number, string>>(() =>
    Object.fromEntries(rows.map((r) => [r.year, r.manual === null ? "" : fmt(r.manual)])),
  );
  const [busy, setBusy] = useState<number | null>(null);
  const [saved, setSaved] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(row: Row) {
    const text = (draft[row.year] ?? "").trim();
    const digits = text.replace(/[^\d]/g, "");
    if (text !== "" && digits === "") {
      setError(`ปีบัญชี ${row.year}: ใส่ได้เฉพาะตัวเลข`);
      return;
    }
    const value = digits === "" ? null : Number(digits);
    if (value === row.manual) return;

    setBusy(row.year);
    setError(null);
    const response = await fetch("/api/admin/visits/", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year: row.year, value }),
    });
    const data = await response.json().catch(() => ({}));
    setBusy(null);
    if (!response.ok) {
      setError(data.error ?? "บันทึกไม่สำเร็จ");
      return;
    }
    setDraft((d) => ({ ...d, [row.year]: value === null ? "" : fmt(value) }));
    setSaved(row.year);
    router.refresh();
  }

  return (
    <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
      <p className="border-b border-gray-100 px-5 py-3 text-xs text-gray-500">
        พิมพ์ยอดแล้วคลิกออกจากช่อง (หรือกด Enter) ระบบบันทึกให้เอง
      </p>
      {error && <p className="bg-red-50 px-5 py-2 text-sm text-red-700">{error}</p>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-sm">
          <thead className="bg-gray-50 text-left text-xs text-gray-500">
            <tr>
              <th className="px-5 py-2.5 font-medium">ปีบัญชี</th>
              <th className="px-3 py-2.5 text-right font-medium">ระบบนับได้</th>
              <th className="px-3 py-2.5 font-medium">ยอดที่กำหนดเอง</th>
              <th className="px-5 py-2.5 text-right font-medium">ยอดที่ใช้</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row) => {
              const shown = row.manual ?? row.system;
              return (
                <tr key={row.year} className={row.current ? "bg-brand-50/40" : ""}>
                  <td className="px-5 py-3 align-top">
                    <p className="font-semibold text-gray-800">
                      {row.year}
                      {row.current && (
                        <span className="ml-2 rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700">
                          ปีปัจจุบัน · แสดงท้ายเว็บ
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500">{row.range}</p>
                  </td>
                  <td className="px-3 py-3 text-right align-top tabular-nums">
                    {row.system === null ? (
                      <span className="text-gray-400">ไม่มีข้อมูล</span>
                    ) : (
                      <>
                        <span className="text-gray-800">{fmt(row.system)}</span>
                        {row.coverage && <p className="text-xs text-gray-500">{row.coverage}</p>}
                      </>
                    )}
                  </td>
                  <td className="px-3 py-3 align-top">
                    <div className="flex items-center gap-2">
                      <input
                        inputMode="numeric"
                        value={draft[row.year] ?? ""}
                        disabled={busy === row.year || row.current}
                        placeholder={row.current ? "นับจากระบบ" : "เว้นว่าง"}
                        title={row.current ? "ปีปัจจุบันใช้ยอดที่ระบบนับสด ๆ เสมอ" : undefined}
                        onChange={(e) => {
                          setSaved(null);
                          setDraft((d) => ({ ...d, [row.year]: e.target.value }));
                        }}
                        onBlur={() => save(row)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                        }}
                        className="w-36 rounded-lg border border-gray-300 px-2.5 py-1.5 text-right tabular-nums focus:border-brand-500 focus:outline-none disabled:bg-gray-50 disabled:text-gray-400"
                      />
                      {busy === row.year && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
                      {saved === row.year && busy !== row.year && (
                        <span className="flex items-center gap-1 text-xs text-green-700">
                          <Check className="h-3.5 w-3.5" /> บันทึกแล้ว
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right align-top font-semibold tabular-nums text-gray-800">
                    {shown === null ? <span className="font-normal text-gray-400">—</span> : fmt(shown)}
                    {row.manual !== null && <p className="text-xs font-normal text-gray-500">กำหนดเอง</p>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
