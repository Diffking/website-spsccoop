"use client";

import { useState } from "react";
import { Save, Loader2, Plus, Trash2, Eye, GripVertical } from "lucide-react";
import type { SplashContent, SplashOccasion } from "@/content/splash";

const BLANK: SplashOccasion = {
  id: "",
  name: "",
  enabled: true,
  from: "",
  to: "",
  image: "",
  alt: "",
  headline: "",
  subtext: "",
};

/** "MM-DD" หรือ "YYYY-MM-DD" เท่านั้น — เช็คฝั่งหน้าจอก่อนจะได้บอกทันทีไม่ต้องรอเซิร์ฟเวอร์ */
function badDate(value: string): boolean {
  return !/^(?:\d{4}-)?\d{2}-\d{2}$/.test(value.trim());
}

export default function SplashManager({ initial }: { initial: SplashContent }) {
  const [content, setContent] = useState<SplashContent>(initial);
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  function setOccasion(index: number, patch: Partial<SplashOccasion>) {
    setContent((prev) => ({
      ...prev,
      occasions: prev.occasions.map((o, i) => (i === index ? { ...o, ...patch } : o)),
    }));
  }

  function addOccasion() {
    setContent((prev) => ({
      ...prev,
      occasions: [...prev.occasions, { ...BLANK, id: `occasion-${Date.now()}` }],
    }));
  }

  function removeOccasion(index: number) {
    setContent((prev) => ({
      ...prev,
      occasions: prev.occasions.filter((_, i) => i !== index),
    }));
  }

  async function save() {
    const broken = content.occasions.find(
      (o) => !o.id.trim() || !o.name.trim() || !o.image.trim() || badDate(o.from) || badDate(o.to),
    );
    if (broken) {
      setStatus({
        kind: "error",
        text: `"${broken.name || broken.id || "วันสำคัญใหม่"}" กรอกไม่ครบ — ต้องมีชื่อ, รูป และวันที่รูปแบบ MM-DD หรือ YYYY-MM-DD`,
      });
      return;
    }

    setBusy(true);
    setStatus(null);

    const response = await fetch("/api/admin/splash/", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(content),
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
        <h2 className="font-semibold text-gray-800">สวิตช์ใหญ่</h2>
        <p className="mt-0.5 text-xs text-gray-500">
          ปิดแล้วหน้า splash จะไม่เด้งเลย ไม่ว่าวันสำคัญจะตรงวันหรือไม่
        </p>

        <label className="mt-3 flex items-center gap-3 rounded-xl bg-gray-50 p-3">
          <input
            type="checkbox"
            checked={content.enabled}
            onChange={(e) => setContent((prev) => ({ ...prev, enabled: e.target.checked }))}
            className="h-4 w-4 accent-brand-500"
          />
          <span className="text-sm text-gray-700">
            {content.enabled ? "เปิดใช้งานหน้าวันสำคัญ" : "ปิดอยู่ — ผู้เข้าเว็บจะเข้าหน้าแรกตรงๆ"}
          </span>
        </label>

        <label className="mt-3 block">
          <span className="text-sm text-gray-600">ข้อความบนปุ่มเข้าเว็บ</span>
          <input
            value={content.buttonText}
            onChange={(e) => setContent((prev) => ({ ...prev, buttonText: e.target.value }))}
            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
          />
        </label>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-gray-800">วันสำคัญ</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              ใส่ช่วงวันที่ไว้ล่วงหน้าได้ พอถึงวันเว็บจะแสดงเอง เลยวันแล้วก็หยุดเอง
            </p>
          </div>
          <button
            onClick={addOccasion}
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-500 px-3 py-1.5 text-sm font-medium text-white shadow transition hover:bg-brand-600"
          >
            <Plus className="h-4 w-4" /> เพิ่ม
          </button>
        </div>

        {content.occasions.length === 0 && (
          <p className="mt-4 rounded-xl bg-gray-50 py-8 text-center text-sm text-gray-400">
            ยังไม่มีวันสำคัญ — กด “เพิ่ม” เพื่อเริ่ม
          </p>
        )}

        <div className="mt-3 space-y-3">
          {content.occasions.map((o, i) => (
            <div key={i} className="rounded-xl border border-gray-200 p-3">
              <div className="flex items-center gap-2">
                <GripVertical className="h-4 w-4 shrink-0 text-gray-300" />
                <input
                  value={o.name}
                  onChange={(e) => setOccasion(i, { name: e.target.value })}
                  placeholder="ชื่อวันสำคัญ (ใช้ในหลังบ้านเท่านั้น)"
                  className="min-w-0 flex-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm font-medium outline-none focus:border-brand-400"
                />
                <label className="flex shrink-0 items-center gap-1.5 text-xs text-gray-500">
                  <input
                    type="checkbox"
                    checked={o.enabled}
                    onChange={(e) => setOccasion(i, { enabled: e.target.checked })}
                    className="h-4 w-4 accent-brand-500"
                  />
                  เปิด
                </label>
                <a
                  href={`/splash/?preview=${encodeURIComponent(o.id)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="ดูตัวอย่าง (เปิดแท็บใหม่)"
                  className="shrink-0 rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-brand-600"
                >
                  <Eye className="h-4 w-4" />
                </a>
                <button
                  onClick={() => removeOccasion(i)}
                  title="ลบ"
                  className="shrink-0 rounded-lg p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs text-gray-500">ตั้งแต่วันที่</span>
                  <input
                    value={o.from}
                    onChange={(e) => setOccasion(i, { from: e.target.value })}
                    placeholder="10-13 (ทุกปี) หรือ 2569-10-13"
                    className={`mt-1 w-full rounded-lg border px-2.5 py-1.5 text-sm outline-none focus:border-brand-400 ${
                      o.from && badDate(o.from) ? "border-red-300 bg-red-50" : "border-gray-200"
                    }`}
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-gray-500">ถึงวันที่</span>
                  <input
                    value={o.to}
                    onChange={(e) => setOccasion(i, { to: e.target.value })}
                    placeholder="10-13"
                    className={`mt-1 w-full rounded-lg border px-2.5 py-1.5 text-sm outline-none focus:border-brand-400 ${
                      o.to && badDate(o.to) ? "border-red-300 bg-red-50" : "border-gray-200"
                    }`}
                  />
                </label>
              </div>

              <label className="mt-2.5 block">
                <span className="text-xs text-gray-500">
                  ที่อยู่รูป — วางไฟล์ไว้ใน public แล้วใส่เส้นทาง เช่น /content/splash/ชื่อไฟล์.jpg
                </span>
                <input
                  value={o.image}
                  onChange={(e) => setOccasion(i, { image: e.target.value })}
                  placeholder="/content/splash/remembrance.jpg"
                  className="mt-1 w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm outline-none focus:border-brand-400"
                />
              </label>

              {o.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={o.image}
                  alt=""
                  className="mt-2 h-28 w-auto rounded-lg bg-gray-900 object-contain ring-1 ring-gray-200"
                />
              )}

              <label className="mt-2.5 block">
                <span className="text-xs text-gray-500">คำอธิบายรูป (สำหรับคนตาบอด/ตอนรูปโหลดไม่ขึ้น)</span>
                <input
                  value={o.alt}
                  onChange={(e) => setOccasion(i, { alt: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm outline-none focus:border-brand-400"
                />
              </label>

              <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs text-gray-500">หัวข้อใต้ภาพ (เว้นว่างได้)</span>
                  <input
                    value={o.headline}
                    onChange={(e) => setOccasion(i, { headline: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm outline-none focus:border-brand-400"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-gray-500">ข้อความเสริม (เว้นว่างได้)</span>
                  <input
                    value={o.subtext}
                    onChange={(e) => setOccasion(i, { subtext: e.target.value })}
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
          บันทึกหน้าวันสำคัญ
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
