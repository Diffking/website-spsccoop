"use client";

import { useState } from "react";
import { Save, Loader2, Plus, Trash2 } from "lucide-react";
import type { BankAccount, SiteInfo } from "@/lib/settings";

/** ช่องที่เป็นข้อความบรรทัดเดียว — เลขบัญชีเป็นรายการ จัดการแยกด้านล่าง */
const FIELDS: { key: keyof SiteInfo; label: string; hint?: string }[] = [
  { key: "address", label: "ที่อยู่สหกรณ์" },
  { key: "phone", label: "เบอร์โทรศัพท์" },
  { key: "fax", label: "โทรสาร", hint: "เว้นว่างได้" },
  { key: "email", label: "อีเมล" },
  { key: "memberCount", label: "จำนวนสมาชิก", hint: "ใส่ตัวเลขพร้อมคอมมา เช่น 220,031" },
  { key: "facebook", label: "ลิงก์เฟซบุ๊ก", hint: "เว้นว่าง = ซ่อนปุ่มเฟซบุ๊กที่ท้ายเว็บ" },
  { key: "line", label: "ลิงก์เพิ่มเพื่อนไลน์", hint: "เช่น https://lin.ee/xxxx" },
  { key: "lineId", label: "ไอดีไลน์ที่โชว์", hint: "เช่น @spsc-coop" },
  {
    key: "mapPoint",
    label: "พิกัดสำนักงาน",
    hint: "ละติจูด,ลองจิจูด เช่น 7.0123,100.4567 — เว้นว่าง = ใช้ที่อยู่ค้นแทน",
  },
];

/** บัญชีเปล่าไว้กดเพิ่มแถวใหม่ */
const EMPTY_ACCOUNT: BankAccount = { bank: "", branch: "", name: "", number: "" };

export default function SiteInfoForm({ initial }: { initial: SiteInfo }) {
  const [siteInfo, setSiteInfo] = useState(initial);
  const [accounts, setAccounts] = useState<BankAccount[]>(initial.bankAccounts ?? []);
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setStatus(null);

    const response = await fetch("/api/admin/home/", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      // ตัดบัญชีที่กรอกไม่ครบทิ้ง จะได้ไม่ไปโผล่เป็นการ์ดว่างที่หน้าติดต่อเรา
      body: JSON.stringify({
        siteInfo: {
          ...siteInfo,
          bankAccounts: accounts.filter((a) => a.bank.trim() && a.number.trim()),
        },
      }),
    });
    const data = await response.json().catch(() => ({}));

    setStatus(
      response.ok
        ? { kind: "ok", text: "บันทึกแล้ว" }
        : { kind: "error", text: data.error ?? "บันทึกไม่สำเร็จ" },
    );
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <h2 className="font-semibold text-gray-800">ข้อมูลสหกรณ์</h2>
        <p className="mt-0.5 text-xs text-gray-500">แสดงที่ส่วนติดต่อเราและท้ายเว็บ</p>

        <div className="mt-3 space-y-3">
          {FIELDS.map((field) => (
            <label key={field.key} className="block text-sm text-gray-600">
              {field.label}
              {field.hint && <span className="ml-1 text-xs text-gray-400">({field.hint})</span>}
              <input
                value={(siteInfo[field.key] as string) ?? ""}
                onChange={(e) => setSiteInfo({ ...siteInfo, [field.key]: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-base outline-none focus:border-brand-500"
              />
            </label>
          ))}
        </div>
      </section>

      {/* เลขที่บัญชีธนาคาร — โชว์ที่หน้าติดต่อเรา ให้สมาชิกกดคัดลอกเลขได้ */}
      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <h2 className="font-semibold text-gray-800">เลขที่บัญชีธนาคาร</h2>
        <p className="mt-0.5 text-xs text-gray-500">
          แสดงที่หน้าติดต่อเรา — สมาชิกกดคัดลอกเลขบัญชีไปวางในแอปธนาคารได้เลย
        </p>

        <div className="mt-3 space-y-3">
          {accounts.map((account, i) => (
            <div key={i} className="rounded-xl bg-gray-50 p-3 ring-1 ring-gray-200">
              <div className="grid gap-2 sm:grid-cols-2">
                {(
                  [
                    ["bank", "ธนาคาร"],
                    ["branch", "สาขา"],
                    ["number", "เลขที่บัญชี"],
                    ["name", "ชื่อบัญชี"],
                  ] as [keyof BankAccount, string][]
                ).map(([key, label]) => (
                  <label key={key} className="block text-xs text-gray-500">
                    {label}
                    <input
                      value={account[key]}
                      onChange={(e) =>
                        setAccounts(
                          accounts.map((a, j) => (i === j ? { ...a, [key]: e.target.value } : a)),
                        )
                      }
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
                    />
                  </label>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setAccounts(accounts.filter((_, j) => j !== i))}
                className="mt-2 inline-flex items-center gap-1 text-xs text-red-500 transition hover:text-red-600"
              >
                <Trash2 className="h-3.5 w-3.5" /> ลบบัญชีนี้
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={() => setAccounts([...accounts, { ...EMPTY_ACCOUNT }])}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700 transition hover:bg-brand-100"
          >
            <Plus className="h-4 w-4" /> เพิ่มบัญชี
          </button>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-brand-700 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          บันทึกข้อมูลสหกรณ์
        </button>
        {status && (
          <span className={`text-sm ${status.kind === "ok" ? "text-emerald-600" : "text-red-500"}`}>
            {status.text}
          </span>
        )}
      </div>
    </div>
  );
}
