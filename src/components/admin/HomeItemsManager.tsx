"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  Plus,
  Trash2,
  Eye,
  EyeOff,
  ChevronUp,
  ChevronDown,
  Loader2,
  ImagePlus,
  GripVertical,
} from "lucide-react";
import type { Item, Section } from "@/lib/homeItems";
import UploadProgress from "@/components/admin/UploadProgress";
import { uploadWithProgress, type UploadPhase } from "@/lib/uploadClient";

/**
 * ตัวจัดการรายการของหน้าแรก ใช้ตัวเดียวกับทุกส่วน — บอกว่าส่วนนี้ใช้ช่องไหนบ้าง
 * ผ่าน fields แล้วมันจะแสดงเฉพาะช่องนั้น (บางส่วนมีไอคอน บางส่วนมีรูป บางส่วนมีแค่ลิงก์)
 */

export type Field = "subtitle" | "icon" | "href" | "imageUrl" | "theme";

const FIELD_META: Record<Field, { label: string; hint?: string; placeholder?: string }> = {
  subtitle: { label: "คำอธิบาย" },
  icon: {
    label: "ไอคอน",
    hint: "ชื่อไอคอนภาษาอังกฤษ เช่น Users, FileText, HeartPulse",
    placeholder: "Users",
  },
  href: { label: "ลิงก์เมื่อคลิก", hint: "เว้นว่าง = ไม่ให้กดได้", placeholder: "/downloads" },
  imageUrl: { label: "รูป", hint: "อัปโหลดหรือวางที่อยู่รูป" },
  theme: { label: "สีการ์ด", hint: "blue / green / orange", placeholder: "blue" },
};

export default function HomeItemsManager({
  section,
  folder,
  items,
  fields,
  titleLabel = "ชื่อรายการ",
}: {
  section: Section;
  /** โฟลเดอร์ปลายทางฝั่ง FTP — ไม่ส่ง = โฟลเดอร์เริ่มต้น */
  folder?: string;
  items: Item[];
  fields: Field[];
  titleLabel?: string;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploadingFor, setUploadingFor] = useState<string | "new" | null>(null);
  const [progress, setProgress] = useState<{ phase: UploadPhase | null; percent: number; name: string }>(
    { phase: null, percent: 0, name: "" },
  );
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * ลำดับที่กำลังโชว์ — ลากแล้วสลับในนี้ก่อนให้เห็นผลทันที ปล่อยแล้วค่อยบันทึก
   * ฝั่งเซิร์ฟเวอร์ส่งชุดใหม่มาเมื่อไหร่ (เพิ่ม ลบ แก้ช่องอื่น) ให้ยึดของเซิร์ฟเวอร์เสมอ
   */
  const [list, setList] = useState(items);
  const [fromServer, setFromServer] = useState(() => JSON.stringify(items));
  const incoming = JSON.stringify(items);
  if (incoming !== fromServer) {
    setFromServer(incoming);
    setList(items);
  }
  const [dragId, setDragId] = useState<string | null>(null);
  /** id ของแถวที่กดค้างที่จุดจับ — ลากได้เฉพาะตอนนี้ ไม่งั้นแก้ช่องข้อความในแถวไม่ได้ */
  const [handleOn, setHandleOn] = useState<string | null>(null);

  function moveTo(id: string, toIndex: number) {
    setList((current) => {
      const from = current.findIndex((x) => x.id === id);
      if (from === -1 || from === toIndex) return current;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }

  /** บันทึกลำดับที่ลากไว้ — ล้มเหลวเมื่อไหร่ถอยกลับไปใช้ลำดับจากฐาน */
  async function saveOrder(next: Item[]) {
    setBusy(true);
    const response = await fetch("/api/admin/home-items/", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ section, order: next.map((x) => x.id) }),
    });
    const data = await response.json().catch(() => ({}));
    setBusy(false);

    if (!response.ok) {
      setList(items);
      setError(data.error ?? "จัดลำดับไม่สำเร็จ");
      return;
    }
    setError(null);
    router.refresh();
  }

  const set = (key: string, value: string) => setDraft((prev) => ({ ...prev, [key]: value }));

  async function call(url: string, init: RequestInit) {
    setBusy(true);
    setError(null);
    const response = await fetch(url, init);
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setError(data.error ?? "ทำรายการไม่สำเร็จ");
      return false;
    }
    router.refresh();
    return true;
  }

  const patch = (id: string, body: Record<string, unknown>) =>
    call(`/api/admin/home-items/${id}/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  async function upload(file: File, forId: string | "new") {
    setUploadingFor(forId);
    setProgress({ phase: "upload", percent: 0, name: file.name });

    const form = new FormData();
    form.append("file", file);
    if (folder) form.append("folder", folder);
    const result = await uploadWithProgress<{ url: string }>(
      "/api/admin/upload/",
      form,
      (percent, phase) => setProgress((p) => ({ ...p, percent, phase })),
    );
    setUploadingFor(null);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (forId === "new") set("imageUrl", result.data.url);
    else await patch(forId, { imageUrl: result.data.url });
  }

  async function add() {
    if (!draft.title?.trim()) {
      setError(`${titleLabel}ห้ามว่าง`);
      return;
    }
    const ok = await call("/api/admin/home-items/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ section, ...draft }),
    });
    if (ok) setDraft({});
  }

  return (
    <div className="space-y-4">
      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          const target = fileInput.current?.dataset.target;
          if (file && target) upload(file, target as string | "new");
          e.target.value = "";
        }}
      />

      {/* ฟอร์มเพิ่ม */}
      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <h2 className="font-semibold text-gray-800">เพิ่มรายการ</h2>

        <label className="mt-3 block">
          <span className="text-xs text-gray-500">{titleLabel}</span>
          <input
            value={draft.title ?? ""}
            onChange={(e) => set("title", e.target.value)}
            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
          />
        </label>

        {fields.map((field) =>
          field === "imageUrl" ? (
            <div key={field} className="mt-2.5">
              <span className="text-xs text-gray-500">{FIELD_META[field].label}</span>
              <div className="mt-1 flex items-center gap-2">
                <button
                  onClick={() => {
                    if (fileInput.current) fileInput.current.dataset.target = "new";
                    fileInput.current?.click();
                  }}
                  disabled={uploadingFor !== null}
                  className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-700 transition hover:bg-brand-100 disabled:opacity-60"
                >
                  {uploadingFor === "new" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ImagePlus className="h-4 w-4" />
                  )}
                  เลือกรูป
                </button>
                {draft.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={draft.imageUrl}
                    alt=""
                    className="h-10 w-14 rounded-lg bg-gray-50 object-cover ring-1 ring-gray-200"
                  />
                )}
              </div>
            </div>
          ) : (
            <label key={field} className="mt-2.5 block">
              <span className="text-xs text-gray-500">
                {FIELD_META[field].label}
                {FIELD_META[field].hint && (
                  <span className="ml-1 text-gray-400">({FIELD_META[field].hint})</span>
                )}
              </span>
              <input
                value={draft[field] ?? ""}
                onChange={(e) => set(field, e.target.value)}
                placeholder={FIELD_META[field].placeholder}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
              />
            </label>
          ),
        )}

        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={add}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-brand-700 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            เพิ่ม
          </button>
          {error && <span className="text-sm text-red-500">{error}</span>}
        </div>

        {/* ใช้กล่องเดียวกันทั้งรูปใหม่และรูปที่แก้ในรายการ — อัปได้ทีละไฟล์อยู่แล้ว */}
        <UploadProgress phase={progress.phase} percent={progress.percent} fileName={progress.name} />
      </section>

      {/* รายการที่มี */}
      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <h2 className="font-semibold text-gray-800">
          รายการทั้งหมด <span className="text-sm font-normal text-gray-400">({items.length})</span>
        </h2>

        {list.length === 0 ? (
          <p className="mt-4 rounded-xl bg-gray-50 py-8 text-center text-sm text-gray-400">
            ยังไม่มีรายการ
          </p>
        ) : (
          <>
          {list.length > 1 && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-gray-500">
              <GripVertical className="h-3.5 w-3.5 text-gray-400" />
              ลากที่จุดจับเพื่อจัดลำดับ — บนสุดขึ้นก่อนบนหน้าเว็บ
            </p>
          )}
          <ul className="mt-2 space-y-3">
            <AnimatePresence initial={false}>
              {list.map((item, i) => (
                <motion.li
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                  draggable={handleOn === item.id}
                  onDragStart={(e) => {
                    setDragId(item.id);
                    (e as unknown as React.DragEvent).dataTransfer?.setData("text/plain", item.id);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragId && dragId !== item.id) moveTo(dragId, i);
                  }}
                  onDragEnd={() => {
                    setDragId(null);
                    setHandleOn(null);
                    const before = items.map((x) => x.id).join();
                    const after = list.map((x) => x.id).join();
                    if (before !== after) void saveOrder(list);
                  }}
                  className={`rounded-xl border p-3 transition ${
                    item.published ? "border-gray-200" : "border-gray-200 bg-gray-50/70"
                  } ${dragId === item.id ? "opacity-40" : ""}`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      onMouseDown={() => setHandleOn(item.id)}
                      onMouseUp={() => setHandleOn(null)}
                      onTouchStart={() => setHandleOn(item.id)}
                      onTouchEnd={() => setHandleOn(null)}
                      title="ลากเพื่อจัดลำดับ"
                      aria-hidden="true"
                      className="-ml-1 shrink-0 cursor-grab rounded text-gray-300 transition hover:text-gray-500 active:cursor-grabbing"
                    >
                      <GripVertical className="h-4 w-4" />
                    </span>
                    <span className="w-5 shrink-0 text-right text-xs tabular-nums text-gray-400">
                      {i + 1}
                    </span>
                    {item.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.imageUrl}
                        alt=""
                        className="h-10 w-14 shrink-0 rounded-lg bg-gray-50 object-cover ring-1 ring-gray-200"
                      />
                    )}
                    <input
                      defaultValue={item.title}
                      onBlur={(e) =>
                        e.target.value.trim() !== item.title && patch(item.id, { title: e.target.value })
                      }
                      className={`min-w-0 flex-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm font-medium outline-none focus:border-brand-400 ${
                        item.published ? "" : "text-gray-400 line-through"
                      }`}
                    />

                    <button
                      onClick={() => patch(item.id, { move: "up" })}
                      disabled={busy || i === 0}
                      title="เลื่อนขึ้น"
                      className="shrink-0 rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => patch(item.id, { move: "down" })}
                      disabled={busy || i === list.length - 1}
                      title="เลื่อนลง"
                      className="shrink-0 rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => patch(item.id, { published: !item.published })}
                      disabled={busy}
                      title={item.published ? "ซ่อนจากหน้าเว็บ" : "แสดงบนหน้าเว็บ"}
                      className="shrink-0 rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-brand-600 disabled:opacity-50"
                    >
                      {item.published ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() =>
                        call(`/api/admin/home-items/${item.id}/`, { method: "DELETE" })
                      }
                      disabled={busy}
                      title="ลบ"
                      className="shrink-0 rounded-lg p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {fields.map((field) =>
                      field === "imageUrl" ? (
                        <button
                          key={field}
                          onClick={() => {
                            if (fileInput.current) fileInput.current.dataset.target = item.id;
                            fileInput.current?.click();
                          }}
                          disabled={uploadingFor !== null}
                          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-200 disabled:opacity-60"
                        >
                          {uploadingFor === item.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <ImagePlus className="h-3.5 w-3.5" />
                          )}
                          {item.imageUrl ? "เปลี่ยนรูป" : "เพิ่มรูป"}
                        </button>
                      ) : (
                        <label key={field} className="block">
                          <span className="text-[11px] text-gray-400">
                            {FIELD_META[field].label}
                          </span>
                          <input
                            defaultValue={item[field] ?? ""}
                            onBlur={(e) =>
                              e.target.value !== (item[field] ?? "") &&
                              patch(item.id, { [field]: e.target.value })
                            }
                            placeholder={FIELD_META[field].placeholder}
                            className="mt-0.5 w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm outline-none focus:border-brand-400"
                          />
                        </label>
                      ),
                    )}
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
          </>
        )}

        <p className="mt-3 text-xs text-gray-400">
          แก้ในช่องแล้วคลิกที่อื่นเพื่อบันทึกอัตโนมัติ
        </p>
      </section>
    </div>
  );
}
