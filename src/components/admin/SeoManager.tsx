"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Save, Loader2, Plus, Trash2, Search, SearchX, Globe } from "lucide-react";
import type { SeoSettings, SeoPage } from "@/lib/seo";

const BLANK: SeoPage = { path: "", label: "", indexed: true, title: "", description: "" };

export default function SeoManager({ initial }: { initial: SeoSettings }) {
  const [seo, setSeo] = useState<SeoSettings>(initial);
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (patch: Partial<SeoSettings>) => setSeo((prev) => ({ ...prev, ...patch }));

  const setPage = (index: number, patch: Partial<SeoPage>) =>
    setSeo((prev) => ({
      ...prev,
      pages: prev.pages.map((p, i) => (i === index ? { ...p, ...patch } : p)),
    }));

  async function save() {
    setBusy(true);
    setStatus(null);
    const response = await fetch("/api/admin/seo/", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(seo),
    });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    setStatus(
      response.ok
        ? { kind: "ok", text: "บันทึกแล้ว" }
        : { kind: "error", text: data.error ?? "บันทึกไม่สำเร็จ" },
    );
  }

  const indexedCount = seo.pages.filter((p) => p.indexed).length;

  return (
    <div className="space-y-4">
      {/* สวิตช์ใหญ่ */}
      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <div className="flex items-start gap-3">
          <span
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
              seo.enabled ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-400"
            }`}
          >
            {seo.enabled ? <Search className="h-5 w-5" /> : <SearchX className="h-5 w-5" />}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-gray-800">เปิดให้เครื่องมือค้นหาเก็บข้อมูล</h2>
            <p className="mt-0.5 text-xs leading-relaxed text-gray-500">
              สวิตช์ใหญ่ของทั้งเว็บ — ปิดแล้ว Google จะไม่เก็บหน้าไหนเลย ไม่ว่ารายหน้าจะตั้งไว้อย่างไร
              (ใช้ตอนเว็บยังไม่พร้อมเปิดจริง)
            </p>
          </div>

          <button
            onClick={() => set({ enabled: !seo.enabled })}
            role="switch"
            aria-checked={seo.enabled}
            aria-label="เปิด/ปิดการเก็บข้อมูลของเครื่องมือค้นหา"
            className={`relative h-7 w-12 shrink-0 rounded-full transition ${
              seo.enabled ? "bg-emerald-500" : "bg-gray-300"
            }`}
          >
            <motion.span
              layout
              transition={{ type: "spring", stiffness: 500, damping: 34 }}
              className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow ${
                seo.enabled ? "right-1" : "left-1"
              }`}
            />
          </button>
        </div>

        {!seo.enabled && (
          <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
            ปิดอยู่ — ไฟล์ robots.txt จะสั่งห้ามเก็บทั้งเว็บ และ sitemap.xml จะว่างเปล่า
            หน้าเว็บยังเปิดดูได้ตามปกติ แค่ไม่ขึ้นในผลการค้นหา
          </p>
        )}
      </section>

      {/* ค่ากลาง */}
      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <h2 className="font-semibold text-gray-800">ค่ากลางของเว็บ</h2>
        <p className="mt-0.5 text-xs text-gray-500">
          หน้าไหนไม่ได้กรอกหัวข้อ/คำอธิบายของตัวเอง จะใช้ค่าตรงนี้แทน
        </p>

        <div className="mt-3 space-y-3">
          <label className="block">
            <span className="text-sm text-gray-600">ที่อยู่เว็บไซต์</span>
            <span className="ml-1 text-xs text-gray-400">
              ใช้สร้างลิงก์ใน sitemap และ canonical
            </span>
            <div className="mt-1 flex items-center gap-2 rounded-xl border border-gray-200 px-3 focus-within:border-brand-400">
              <Globe className="h-4 w-4 shrink-0 text-gray-400" />
              <input
                value={seo.siteUrl}
                onChange={(e) => set({ siteUrl: e.target.value })}
                placeholder="https://www.spsccoop.com"
                className="w-full py-2 text-sm outline-none"
              />
            </div>
          </label>

          <label className="block">
            <span className="text-sm text-gray-600">ชื่อเว็บไซต์</span>
            <input
              value={seo.siteName}
              onChange={(e) => set({ siteName: e.target.value })}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
            />
          </label>

          <label className="block">
            <span className="text-sm text-gray-600">หัวข้อตั้งต้น</span>
            <input
              value={seo.defaultTitle}
              onChange={(e) => set({ defaultTitle: e.target.value })}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
            />
            <span className="mt-1 block text-xs text-gray-400">
              ยาว {seo.defaultTitle.length} ตัวอักษร — Google แสดงราว 60 ตัว
            </span>
          </label>

          <label className="block">
            <span className="text-sm text-gray-600">คำอธิบายตั้งต้น</span>
            <textarea
              value={seo.defaultDescription}
              onChange={(e) => set({ defaultDescription: e.target.value })}
              rows={3}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
            />
            <span className="mt-1 block text-xs text-gray-400">
              ยาว {seo.defaultDescription.length} ตัวอักษร — Google แสดงราว 155 ตัว
            </span>
          </label>

          <label className="block">
            <span className="text-sm text-gray-600">คำค้น</span>
            <span className="ml-1 text-xs text-gray-400">คั่นด้วยเครื่องหมายจุลภาค</span>
            <input
              value={seo.keywords.join(", ")}
              onChange={(e) =>
                set({ keywords: e.target.value.split(",").map((k) => k.trim()).filter(Boolean) })
              }
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
            />
          </label>
        </div>
      </section>

      {/* รายหน้า */}
      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-gray-800">กำหนดรายหน้า</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              เปิดให้เก็บ {indexedCount} จาก {seo.pages.length} หน้า ·
              หน้าที่ไม่ได้อยู่ในรายการนี้จะไม่ถูกเก็บโดยอัตโนมัติ
            </p>
          </div>
          <button
            onClick={() => setSeo((prev) => ({ ...prev, pages: [...prev.pages, { ...BLANK }] }))}
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-500 px-3 py-1.5 text-sm font-medium text-white shadow transition hover:bg-brand-600"
          >
            <Plus className="h-4 w-4" /> เพิ่มหน้า
          </button>
        </div>

        <div className="mt-3 space-y-3">
          {seo.pages.map((page, i) => (
            <div
              key={i}
              className={`rounded-xl border p-3 transition ${
                page.indexed && seo.enabled
                  ? "border-gray-200"
                  : "border-gray-200 bg-gray-50/60"
              }`}
            >
              <div className="flex items-center gap-2">
                <input
                  value={page.label}
                  onChange={(e) => setPage(i, { label: e.target.value })}
                  placeholder="ชื่อหน้า (ใช้ในหลังบ้าน)"
                  className="min-w-0 flex-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm font-medium outline-none focus:border-brand-400"
                />

                <button
                  onClick={() => setPage(i, { indexed: !page.indexed })}
                  role="switch"
                  aria-checked={page.indexed}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium transition ${
                    page.indexed
                      ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                      : "bg-gray-100 text-gray-500 ring-1 ring-gray-200"
                  }`}
                >
                  {page.indexed ? <Search className="h-3.5 w-3.5" /> : <SearchX className="h-3.5 w-3.5" />}
                  {page.indexed ? "เก็บ" : "ไม่เก็บ"}
                </button>

                <button
                  onClick={() =>
                    setSeo((prev) => ({ ...prev, pages: prev.pages.filter((_, x) => x !== i) }))
                  }
                  title="ลบออกจากรายการ"
                  className="shrink-0 rounded-lg p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <label className="mt-2.5 block">
                <span className="text-xs text-gray-500">เส้นทางของหน้า เช่น / หรือ /about/history</span>
                <input
                  value={page.path}
                  onChange={(e) => setPage(i, { path: e.target.value })}
                  placeholder="/"
                  className="mt-1 w-full rounded-lg border border-gray-200 px-2.5 py-1.5 font-mono text-sm outline-none focus:border-brand-400"
                />
              </label>

              <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs text-gray-500">หัวข้อ (เว้นว่าง = ใช้ค่ากลาง)</span>
                  <input
                    value={page.title}
                    onChange={(e) => setPage(i, { title: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm outline-none focus:border-brand-400"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-gray-500">คำอธิบาย (เว้นว่าง = ใช้ค่ากลาง)</span>
                  <input
                    value={page.description}
                    onChange={(e) => setPage(i, { description: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm outline-none focus:border-brand-400"
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-brand-700 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          บันทึกการตั้งค่า SEO
        </button>
        {status && (
          <span className={`text-sm ${status.kind === "ok" ? "text-emerald-600" : "text-red-500"}`}>
            {status.text}
          </span>
        )}
        <a
          href="/robots.txt"
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto text-xs text-gray-400 underline-offset-2 hover:text-brand-600 hover:underline"
        >
          ดู robots.txt
        </a>
        <a
          href="/sitemap.xml"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-gray-400 underline-offset-2 hover:text-brand-600 hover:underline"
        >
          ดู sitemap.xml
        </a>
      </div>
    </div>
  );
}
