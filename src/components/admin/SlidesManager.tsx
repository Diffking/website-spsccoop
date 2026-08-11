"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Loader2,
  ChevronUp,
  ChevronDown,
  ImagePlus,
  Sparkles,
  Images,
} from "lucide-react";
import type { UpdateMode } from "@/lib/settings";
import ModeSwitch from "./ModeSwitch";

export type SlideRow = {
  id: string;
  imageUrl: string;
  title: string;
  caption: string | null;
  href: string | null;
  published: boolean;
};

export default function SlidesManager({
  items,
  mode,
  aiReady,
}: {
  items: SlideRow[];
  mode: UpdateMode;
  aiReady: boolean;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);

  const [imageUrl, setImageUrl] = useState("");
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [href, setHref] = useState("");
  const [busy, setBusy] = useState<null | "upload" | "ai" | "save" | "row">(null);
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  /** อัปรูปขึ้นเซิร์ฟเวอร์ และถ้าอยู่โหมด AI ก็ให้ AI อ่านรูปเดียวกันนั้นต่อเลย */
  async function handleFile(file: File) {
    setStatus(null);
    setBusy("upload");

    const upload = new FormData();
    upload.append("file", file);
    const uploaded = await fetch("/api/admin/upload/", { method: "POST", body: upload });
    const uploadData = await uploaded.json().catch(() => ({}));

    if (!uploaded.ok) {
      setBusy(null);
      setStatus({ kind: "error", text: uploadData.error ?? "อัปโหลดไม่สำเร็จ" });
      return;
    }
    setImageUrl(uploadData.url);

    if (mode !== "ai") {
      setBusy(null);
      return;
    }

    setBusy("ai");
    const read = new FormData();
    read.append("file", file);
    read.append("target", "slide");
    const response = await fetch("/api/admin/ai/read-image/", { method: "POST", body: read });
    const data = await response.json().catch(() => ({}));
    setBusy(null);

    if (!response.ok) {
      setStatus({ kind: "error", text: data.error ?? "AI อ่านภาพไม่สำเร็จ" });
      return;
    }
    setTitle(data.data?.title ?? "");
    setCaption(data.data?.caption ?? "");
    setStatus({ kind: "ok", text: "AI อ่านให้แล้ว — ตรวจข้อความก่อนกดเพิ่ม" });
  }

  async function add() {
    if (!imageUrl || !title.trim()) {
      setStatus({ kind: "error", text: "ต้องมีรูปและหัวข้อ" });
      return;
    }
    setBusy("save");
    const response = await fetch("/api/admin/slides/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrl, title, caption, href }),
    });
    const data = await response.json().catch(() => ({}));
    setBusy(null);

    if (!response.ok) {
      setStatus({ kind: "error", text: data.error ?? "เพิ่มไม่สำเร็จ" });
      return;
    }
    setImageUrl("");
    setTitle("");
    setCaption("");
    setHref("");
    setStatus({ kind: "ok", text: "เพิ่มสไลด์แล้ว" });
    router.refresh();
  }

  async function row(id: string, init: RequestInit) {
    setBusy("row");
    await fetch(`/api/admin/slides/${id}/`, init);
    setBusy(null);
    router.refresh();
  }

  const patch = (id: string, body: Record<string, unknown>) =>
    row(id, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
            <Images className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-semibold text-gray-800">แบนเนอร์สไลด์</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              ภาพใหญ่ที่เลื่อนอยู่บนสุดของหน้าแรก ({items.length} รายการ)
            </p>
          </div>
        </div>
        <ModeSwitch component="slides" value={mode} aiReady={aiReady} />
      </div>

      {/* ฟอร์มเพิ่มสไลด์ */}
      <div className="mt-4 rounded-xl border border-dashed border-gray-300 p-3">
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => fileInput.current?.click()}
            disabled={busy !== null}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3.5 py-2 text-sm font-medium text-brand-700 transition hover:bg-brand-100 disabled:opacity-60"
          >
            {busy === "upload" || busy === "ai" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : mode === "ai" ? (
              <Sparkles className="h-4 w-4" />
            ) : (
              <ImagePlus className="h-4 w-4" />
            )}
            {busy === "upload"
              ? "กำลังอัปโหลด..."
              : busy === "ai"
                ? "AI กำลังอ่านภาพ..."
                : mode === "ai"
                  ? "เลือกภาพประกาศ ให้ AI อ่าน"
                  : "เลือกรูปแบนเนอร์"}
          </button>

          {mode === "ai" && (
            <span className="text-xs text-gray-500">
              AI จะเติมหัวข้อและคำอธิบายให้ — ตรวจก่อนกดเพิ่มเสมอ
            </span>
          )}
        </div>

        {imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt=""
            className="mt-3 h-32 w-auto rounded-lg bg-gray-50 object-contain ring-1 ring-gray-200"
          />
        )}

        <div className="mt-3 space-y-2.5">
          <label className="block">
            <span className="text-xs text-gray-500">หัวข้อ</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="เช่น สวัสดิการใหม่สำหรับสมาชิก"
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
            />
          </label>
          <label className="block">
            <span className="text-xs text-gray-500">คำอธิบาย (เว้นว่างได้)</span>
            <input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
            />
          </label>
          <label className="block">
            <span className="text-xs text-gray-500">ลิงก์เมื่อคลิก (เว้นว่างได้)</span>
            <input
              value={href}
              onChange={(e) => setHref(e.target.value)}
              placeholder="/downloads"
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
            />
          </label>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={add}
            disabled={busy !== null}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-brand-700 disabled:opacity-60"
          >
            {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            เพิ่มสไลด์
          </button>
          {status && (
            <span className={`text-sm ${status.kind === "ok" ? "text-emerald-600" : "text-red-500"}`}>
              {status.text}
            </span>
          )}
        </div>
      </div>

      {/* รายการสไลด์ */}
      {items.length === 0 ? (
        <p className="mt-4 rounded-xl bg-gray-50 py-8 text-center text-sm text-gray-400">
          ยังไม่มีสไลด์ — หน้าเว็บจะใช้ภาพชุดเดิมที่ติดมากับโค้ดไปก่อน
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-gray-100">
          <AnimatePresence initial={false}>
            {items.map((slide, i) => (
              <motion.li
                key={slide.id}
                layout
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="flex items-center gap-3 py-3"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={slide.imageUrl}
                  alt=""
                  className="h-12 w-16 shrink-0 rounded-lg bg-gray-50 object-cover ring-1 ring-gray-200"
                />
                <span className="min-w-0 flex-1">
                  <span
                    className={`block truncate text-sm font-medium ${
                      slide.published ? "text-gray-800" : "text-gray-400 line-through"
                    }`}
                  >
                    {slide.title}
                  </span>
                  {slide.caption && (
                    <span className="mt-0.5 block truncate text-xs text-gray-500">
                      {slide.caption}
                    </span>
                  )}
                </span>

                <span className="flex shrink-0 items-center">
                  <button
                    onClick={() => patch(slide.id, { move: "up" })}
                    disabled={busy !== null || i === 0}
                    title="เลื่อนขึ้น"
                    className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => patch(slide.id, { move: "down" })}
                    disabled={busy !== null || i === items.length - 1}
                    title="เลื่อนลง"
                    className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => patch(slide.id, { published: !slide.published })}
                    disabled={busy !== null}
                    title={slide.published ? "ซ่อนจากหน้าเว็บ" : "แสดงบนหน้าเว็บ"}
                    className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-brand-600 disabled:opacity-50"
                  >
                    {slide.published ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={() => row(slide.id, { method: "DELETE" })}
                    disabled={busy !== null}
                    title="ลบ"
                    className="rounded-lg p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </span>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </section>
  );
}
