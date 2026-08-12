"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import UploadProgress from "@/components/admin/UploadProgress";
import { uploadWithProgress, type UploadPhase } from "@/lib/uploadClient";
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
  GripVertical,
} from "lucide-react";

export type SlideRow = {
  id: string;
  imageUrl: string;
  title: string;
  caption: string | null;
  href: string | null;
  published: boolean;
  /** "YYYY-MM-DD" หรือ "" = ไม่จำกัด */
  startsAt: string;
  endsAt: string;
};

const thaiDate = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Bangkok",
});

const readable = (value: string) => {
  const d = new Date(`${value}T00:00:00+07:00`);
  return Number.isNaN(d.getTime()) ? value : thaiDate.format(d);
};

const thaiToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());

/** ตอนนี้สไลด์นี้ขึ้นบนหน้าเว็บจริงไหม — เงื่อนไขเดียวกับที่ getSlides() ใช้กรอง */
function isLive(slide: SlideRow): boolean {
  if (!slide.published) return false;
  const today = thaiToday();
  if (slide.startsAt && today < slide.startsAt) return false;
  if (slide.endsAt && today > slide.endsAt) return false;
  return true;
}

/** สถานะการเผยแพร่ตามช่วงวันที่ — เทียบกับวันนี้ตามเวลาไทย */
function scheduleState(slide: SlideRow): { label: string; tone: string } | null {
  if (!slide.published) return null;
  const today = thaiToday();

  if (slide.startsAt && today < slide.startsAt) {
    return { label: `รอถึง ${readable(slide.startsAt)}`, tone: "bg-amber-50 text-amber-700 ring-amber-200" };
  }
  if (slide.endsAt && today > slide.endsAt) {
    return { label: `หมดอายุ ${readable(slide.endsAt)}`, tone: "bg-red-50 text-red-600 ring-red-200" };
  }
  if (slide.endsAt) {
    return { label: `แสดงถึง ${readable(slide.endsAt)}`, tone: "bg-emerald-50 text-emerald-700 ring-emerald-200" };
  }
  return { label: "กำลังแสดง", tone: "bg-emerald-50 text-emerald-700 ring-emerald-200" };
}

export default function SlidesManager({
  items,
  aiReady,
}: {
  items: SlideRow[];
  aiReady: boolean;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);

  const [imageUrl, setImageUrl] = useState("");
  const [imageNote, setImageNote] = useState("");
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [href, setHref] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [busy, setBusy] = useState<null | "upload" | "ai" | "save" | "row">(null);
  const [progress, setProgress] = useState<{ phase: UploadPhase | null; percent: number; name: string }>(
    { phase: null, percent: 0, name: "" },
  );
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  /**
   * ลำดับที่กำลังโชว์อยู่ — ลากแล้วสลับในนี้ก่อนเพื่อให้เห็นผลทันที ค่อยส่งไปบันทึก
   * ถ้าฝั่งเซิร์ฟเวอร์ส่งข้อมูลชุดใหม่มา (แก้ช่องอื่น เพิ่ม ลบ) ให้ยึดของเซิร์ฟเวอร์เสมอ
   */
  const [list, setList] = useState(items);
  const [fromServer, setFromServer] = useState(() => JSON.stringify(items));
  const incoming = JSON.stringify(items);
  if (incoming !== fromServer) {
    setFromServer(incoming);
    setList(items);
  }

  const [dragId, setDragId] = useState<string | null>(null);
  /** id ของแถวที่กดค้างอยู่ที่จุดจับ — แถวจะลากได้เฉพาะตอนนี้ ไม่งั้นเลือกข้อความในแถวไม่ได้ */
  const [handleOn, setHandleOn] = useState<string | null>(null);

  /** อัปรูปขึ้นเซิร์ฟเวอร์ และถ้าอยู่โหมด AI ก็ให้ AI อ่านรูปเดียวกันนั้นต่อเลย */
  async function handleFile(file: File) {
    setStatus(null);
    setBusy("upload");
    setProgress({ phase: "upload", percent: 0, name: file.name });

    const upload = new FormData();
    upload.append("file", file);
    upload.append("folder", "banner_slide");
    const result = await uploadWithProgress<{
      url: string;
      width: number;
      height: number;
      originalBytes: number;
      storedBytes: number;
    }>("/api/admin/upload/", upload, (percent, phase) =>
      setProgress((p) => ({ ...p, percent, phase })),
    );

    if (!result.ok) {
      setBusy(null);
      setStatus({ kind: "error", text: result.error });
      return;
    }
    const uploadData = result.data;
    setImageUrl(uploadData.url);
    setImageNote(
      uploadData.width
        ? `ย่อเหลือ ${uploadData.width}×${uploadData.height} px · ${(uploadData.storedBytes / 1024).toFixed(0)} KB (จาก ${(uploadData.originalBytes / 1024 / 1024).toFixed(1)} MB)`
        : "",
    );

    // ไม่มีคีย์ AI ก็จบแค่อัปรูป — ที่เหลือพิมพ์เอง
    if (!aiReady) {
      setBusy(null);
      return;
    }

    // ให้เซิร์ฟเวอร์ไปหยิบไฟล์ที่เพิ่งอัปเอง จะได้ไม่ต้องส่งซ้ำรอบสอง
    setBusy("ai");
    setProgress((p) => ({ ...p, phase: "ai" }));
    const read = new FormData();
    read.append("url", uploadData.url);
    read.append("target", "slide");
    const response = await fetch("/api/admin/ai/read-image/", { method: "POST", body: read });
    const data = await response.json().catch(() => ({}));
    setBusy(null);
    setProgress((p) => ({ ...p, phase: "done" }));

    if (!response.ok) {
      setStatus({ kind: "error", text: data.error ?? "AI อ่านภาพไม่สำเร็จ" });
      return;
    }
    setTitle(data.data?.title ?? "");
    setCaption(data.data?.caption ?? "");
    setStartsAt(data.data?.startsAt ?? "");
    setEndsAt(data.data?.endsAt ?? "");

    const gotDates = Boolean(data.data?.startsAt || data.data?.endsAt);
    setStatus({
      kind: "ok",
      text: gotDates
        ? "AI อ่านให้แล้ว รวมถึงช่วงวันที่ — ตรวจให้ครบก่อนกดเพิ่ม"
        : "AI อ่านให้แล้ว แต่ในภาพไม่ได้ระบุวันหมดเขต ใส่วันสิ้นสุดเองได้",
    });
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
      body: JSON.stringify({ imageUrl, title, caption, href, startsAt, endsAt }),
    });
    const data = await response.json().catch(() => ({}));
    setBusy(null);

    if (!response.ok) {
      setStatus({ kind: "error", text: data.error ?? "เพิ่มไม่สำเร็จ" });
      return;
    }
    setImageUrl("");
    setImageNote("");
    setProgress({ phase: null, percent: 0, name: "" });
    setTitle("");
    setCaption("");
    setHref("");
    setStartsAt("");
    setEndsAt("");
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

  /**
   * เลขลำดับที่จะขึ้นบนหน้าเว็บ — นับเฉพาะตัวที่แสดงอยู่จริง
   * ตัวที่ถูกซ่อน/ยังไม่ถึงวัน/หมดอายุ ได้ null เพราะคนเข้าเว็บไม่เห็นมันเลย นับไปก็ทำให้เข้าใจผิด
   */
  let live = 0;
  const positions = list.map((slide) => (isLive(slide) ? ++live : null));

  /** ย้ายแถวไปอยู่ตำแหน่งใหม่ในรายการที่โชว์อยู่ (ยังไม่บันทึก) */
  function moveTo(id: string, toIndex: number) {
    setList((current) => {
      const from = current.findIndex((s) => s.id === id);
      if (from === -1 || from === toIndex) return current;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }

  /** บันทึกลำดับที่ลากไว้ — ล้มเหลวเมื่อไหร่ถอยกลับไปใช้ลำดับจากเซิร์ฟเวอร์ */
  async function saveOrder(next: SlideRow[]) {
    setBusy("row");
    const response = await fetch("/api/admin/slides/", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: next.map((s) => s.id) }),
    });
    const data = await response.json().catch(() => ({}));
    setBusy(null);

    if (!response.ok) {
      setList(items);
      setStatus({ kind: "error", text: data.error ?? "จัดลำดับไม่สำเร็จ" });
      return;
    }
    setStatus({ kind: "ok", text: "จัดลำดับใหม่แล้ว" });
    router.refresh();
  }

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
            ) : aiReady ? (
              <Sparkles className="h-4 w-4" />
            ) : (
              <ImagePlus className="h-4 w-4" />
            )}
            {busy === "upload"
              ? "กำลังอัปโหลด..."
              : busy === "ai"
                ? "AI กำลังอ่านภาพ..."
                : "เลือกภาพประกาศ"}
          </button>

          <span className="text-xs text-gray-500">
            {aiReady
              ? "อัปแล้ว AI จะอ่านภาพและเติมหัวข้อ คำอธิบาย และช่วงวันที่ให้ — ตรวจก่อนกดเพิ่มเสมอ"
              : "ยังไม่ได้ตั้งค่าคีย์ AI จึงต้องพิมพ์เอง (ใส่ OPENROUTER_API_KEY ใน .env แล้วรีสตาร์ต)"}
          </span>
        </div>

        <UploadProgress
          phase={progress.phase}
          percent={progress.percent}
          fileName={progress.name}
          showAi={aiReady}
          message={progress.phase === "done" ? imageNote : ""}
        />

        {imageUrl && (
          <div className="mt-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt=""
              className="h-32 w-auto rounded-lg bg-gray-50 object-contain ring-1 ring-gray-200"
            />
            {imageNote && <p className="mt-1 text-[11px] text-gray-400">{imageNote}</p>}
          </div>
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

          <div className="grid gap-2.5 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs text-gray-500">วันเริ่มแสดง (เว้นว่าง = แสดงทันที)</span>
              <input
                type="date"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
              />
            </label>
            <label className="block">
              <span className="text-xs text-gray-500">วันสิ้นสุด (เว้นว่าง = แสดงตลอด)</span>
              <input
                type="date"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
              />
            </label>
          </div>
          <p className="text-xs text-gray-400">
            ใส่วันสิ้นสุดไว้ พอเลยวันแล้วสไลด์จะหายจากหน้าเว็บเอง ไม่ต้องมาคอยลบ
          </p>
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
      {list.length === 0 ? (
        <p className="mt-4 rounded-xl bg-gray-50 py-8 text-center text-sm text-gray-400">
          ยังไม่มีสไลด์ — หน้าเว็บจะใช้ภาพชุดเดิมที่ติดมากับโค้ดไปก่อน
        </p>
      ) : (
        <>
          <div className="mt-4 rounded-xl bg-brand-50/60 px-3 py-2 text-xs text-gray-600">
            <p className="flex items-center gap-1.5">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-600 text-[11px] font-bold text-white">
                1
              </span>
              เลขคือลำดับที่ขึ้นบนหน้าเว็บ — <strong className="font-semibold">1 คือสไลด์แรกที่คนเห็น</strong>{" "}
              แล้วไล่ไปเรื่อย ๆ
            </p>
            <p className="mt-1.5 flex items-center gap-1.5">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-gray-200 text-[11px] font-bold text-gray-400">
                –
              </span>
              ขีดคือยังไม่ขึ้น (ถูกซ่อน · ยังไม่ถึงวันเริ่ม · หรือหมดอายุแล้ว) จึงไม่นับลำดับ
            </p>
            <p className="mt-1.5 flex items-center gap-1.5">
              <GripVertical className="h-4 w-4 shrink-0 text-gray-400" />
              ลากที่จุดจับเพื่อสลับลำดับ (บนมือถือใช้ปุ่มลูกศรแทน)
            </p>
          </div>
          <ul className="mt-2 divide-y divide-gray-100">
          <AnimatePresence initial={false}>
            {list.map((slide, i) => (
              <motion.li
                key={slide.id}
                layout
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="py-3"
              >
                {/* ตัวลาก: วางไว้ชั้นในเพราะ motion.li มี prop ชื่อ onDrag* ของตัวเองอยู่แล้ว */}
                <div
                  draggable={handleOn === slide.id}
                  onDragStart={(e) => {
                    setDragId(slide.id);
                    // Firefox ไม่เริ่มลากถ้าไม่ได้ตั้ง dataTransfer
                    e.dataTransfer.setData("text/plain", slide.id);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragId && dragId !== slide.id) moveTo(dragId, i);
                  }}
                  onDragEnd={() => {
                    setDragId(null);
                    setHandleOn(null);
                    // ลากแล้วลำดับไม่เปลี่ยนก็ไม่ต้องยิงไปบันทึก
                    const changed = list.some((s, idx) => s.id !== items[idx]?.id);
                    if (changed) void saveOrder(list);
                  }}
                  className={`transition ${dragId === slide.id ? "opacity-40" : ""}`}
                >
                <div className="flex items-center gap-3">
                  <span
                    onMouseDown={() => setHandleOn(slide.id)}
                    onMouseUp={() => setHandleOn(null)}
                    onTouchStart={() => setHandleOn(slide.id)}
                    onTouchEnd={() => setHandleOn(null)}
                    title="ลากเพื่อสลับลำดับ"
                    aria-hidden="true"
                    className="-ml-1 shrink-0 cursor-grab rounded-lg p-1 text-gray-300 transition hover:text-gray-500 active:cursor-grabbing"
                  >
                    <GripVertical className="h-4 w-4" />
                  </span>

                  <span
                    title={
                      positions[i]
                        ? `ขึ้นเป็นลำดับที่ ${positions[i]} บนหน้าเว็บ`
                        : "ยังไม่ขึ้นบนหน้าเว็บ จึงไม่นับลำดับ"
                    }
                    className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${
                      positions[i]
                        ? "bg-brand-600 text-white"
                        : "bg-gray-200 text-gray-400"
                    }`}
                  >
                    {positions[i] ?? "–"}
                  </span>

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
                  {(() => {
                    const state = scheduleState(slide);
                    return state ? (
                      <span
                        className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${state.tone}`}
                      >
                        {state.label}
                      </span>
                    ) : null;
                  })()}
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
                    disabled={busy !== null || i === list.length - 1}
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
                </div>

                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-[11px] text-gray-400">วันเริ่มแสดง</span>
                    <input
                      type="date"
                      defaultValue={slide.startsAt}
                      onChange={(e) => patch(slide.id, { startsAt: e.target.value })}
                      className="mt-0.5 w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm outline-none focus:border-brand-400"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[11px] text-gray-400">วันสิ้นสุด</span>
                    <input
                      type="date"
                      defaultValue={slide.endsAt}
                      onChange={(e) => patch(slide.id, { endsAt: e.target.value })}
                      className="mt-0.5 w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm outline-none focus:border-brand-400"
                    />
                  </label>
                </div>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
          </ul>
        </>
      )}
    </section>
  );
}
