"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  ImagePlus,
  Link2,
  Loader2,
  Settings2,
  Sparkles,
  Trash2,
} from "lucide-react";
import AssetImage from "@/components/admin/AssetImage";
import RichText from "@/components/admin/RichText";
import ThaiDatePicker from "@/components/admin/ThaiDatePicker";
import UploadProgress from "@/components/admin/UploadProgress";
import { uploadWithProgress, type UploadPhase } from "@/lib/uploadClient";

/**
 * แบนเนอร์สไลด์ — แก้บนหน้าตาจริงของสไลด์
 *
 * ของเดิมเป็นรายการบรรทัดเล็ก ๆ ที่มีช่องวันที่สี่ช่องกางค้างไว้ทุกแถว และ
 * **แก้หัวข้อกับคำอธิบายของสไลด์ที่มีอยู่แล้วไม่ได้เลย** ต้องลบทิ้งแล้วทำใหม่
 *
 * ตอนนี้แต่ละสไลด์วาดเป็นกรอบ 16:10 วางข้อความซ้าย-ภาพขวา แบบเดียวกับที่ขึ้นหน้าแรกจริง
 * (ดู src/components/home/Hero.tsx) คลิกที่หัวข้อหรือคำอธิบายแล้วพิมพ์ทับได้เลย
 * ส่วนวันที่/ลิงก์/ปฏิทิน ซ่อนไว้ใต้ปุ่มตั้งค่า เปิดดูเฉพาะตอนต้องใช้
 *
 * ใช้คลาส .edit-* ชุดเดียวกับ EditUI ของหน้าเนื้อหา เพื่อให้สองที่นี้ใช้งานเหมือนกัน
 */

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
  /** วันจัดกิจกรรม — ใส่แล้วสไลด์นี้จะไปโผล่บนปฏิทินหน้าแรกด้วย */
  eventDate: string;
  /** ประเภทบนปฏิทิน mobile | project | seminar — "" = โครงการ */
  eventType: string;
};

/** ประเภทกิจกรรมบนปฏิทิน — ชื่อ/สีเดียวกับที่เมนูปฏิทินสหกรณ์ใช้ */
const EVENT_TYPES = [
  { key: "project", label: "โครงการ" },
  { key: "mobile", label: "รถโมบาย" },
  { key: "seminar", label: "สัมมนา" },
] as const;

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

const thaiToday = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());

/** ตอนนี้สไลด์นี้ขึ้นบนหน้าเว็บจริงไหม — เงื่อนไขเดียวกับที่ getSlides() ใช้กรอง */
function isLive(slide: SlideRow): boolean {
  if (!slide.published) return false;
  const today = thaiToday();
  if (slide.startsAt && today < slide.startsAt) return false;
  if (slide.endsAt && today > slide.endsAt) return false;
  return true;
}

/** ป้ายบอกสถานะบนมุมสไลด์ — ทำไมถึงยังไม่ขึ้น หรือจะขึ้นถึงเมื่อไหร่ */
function scheduleState(slide: SlideRow): { label: string; tone: string } {
  if (!slide.published) return { label: "ซ่อนอยู่", tone: "bg-gray-700/85 text-white" };

  const today = thaiToday();
  if (slide.startsAt && today < slide.startsAt) {
    return { label: `รอถึง ${readable(slide.startsAt)}`, tone: "bg-amber-500/90 text-white" };
  }
  if (slide.endsAt && today > slide.endsAt) {
    return { label: `หมดอายุ ${readable(slide.endsAt)}`, tone: "bg-red-500/90 text-white" };
  }
  if (slide.endsAt) {
    return { label: `แสดงถึง ${readable(slide.endsAt)}`, tone: "bg-emerald-600/90 text-white" };
  }
  return { label: "กำลังแสดง", tone: "bg-emerald-600/90 text-white" };
}

export default function SlidesManager({ items, aiReady }: { items: SlideRow[]; aiReady: boolean }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState<null | "upload" | "ai" | "row">(null);
  const [progress, setProgress] = useState<{
    phase: UploadPhase | null;
    percent: number;
    fileName: string;
  }>({ phase: null, percent: 0, fileName: "" });
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  /** สไลด์ที่กางแถบตั้งค่าอยู่ — ทีละอันพอ ไม่งั้นหน้ายาวเป็นหางว่าว */
  const [openId, setOpenId] = useState<string | null>(null);

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

  /**
   * อัปรูปแล้วสร้างสไลด์ให้เลย — ไม่ต้องกรอกฟอร์มก่อนถึงจะได้เห็นอะไร
   * มีคีย์ AI ก็ให้อ่านหัวข้อ/คำอธิบาย/ช่วงวันที่จากภาพมาใส่ให้ก่อน แล้วค่อยแก้ทับบนสไลด์
   */
  async function addFromFile(file: File) {
    setStatus(null);
    setBusy("upload");
    setProgress({ phase: "upload", percent: 0, fileName: file.name });

    const upload = new FormData();
    upload.append("file", file);
    upload.append("folder", "banner_slide");
    const result = await uploadWithProgress<{ url: string }>("/api/admin/upload/", upload, (percent, phase) =>
      setProgress((p) => ({ ...p, percent, phase })),
    );

    if (!result.ok) {
      setBusy(null);
      setStatus({ kind: "error", text: result.error });
      return;
    }

    let read: { title?: string; caption?: string; startsAt?: string; endsAt?: string } = {};
    /*
      บอกให้ได้ว่า AI ทำอะไรไปบ้าง — ของเดิมขึ้นว่า "AI เติมหัวข้อให้" ทุกกรณี
      แม้ตอนที่เรียก AI ไม่สำเร็จเลย เจ้าหน้าที่จึงแยกไม่ออกระหว่าง
      "AI พัง" กับ "AI อ่านแล้วแต่ในภาพไม่ได้เขียนวันที่ไว้" — สองอย่างนี้แก้คนละทาง
    */
    let aiNote = "";
    if (aiReady) {
      // ให้เซิร์ฟเวอร์ไปหยิบไฟล์ที่เพิ่งอัปเอง จะได้ไม่ต้องส่งซ้ำรอบสอง
      setBusy("ai");
      setProgress((p) => ({ ...p, phase: "ai" }));
      const form = new FormData();
      form.append("url", result.data.url);
      form.append("target", "slide");
      const response = await fetch("/api/admin/ai/read-image/", { method: "POST", body: form });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        read = data.data ?? {};
        // ในภาพไม่ได้เขียนวันไว้ก็ตอบ "" มา (prompt สั่งห้ามเดา) ไม่ใช่อาการเสีย
        aiNote =
          read.startsAt || read.endsAt
            ? "AI เติมหัวข้อและช่วงเวลาเผยแพร่ให้แล้ว"
            : "AI เติมหัวข้อให้ · ในภาพไม่ได้ระบุวันที่ ตั้งช่วงเวลาเผยแพร่เองได้ที่ช่องด้านล่าง";
      } else {
        aiNote = `AI อ่านภาพไม่สำเร็จ (${data.error ?? "ไม่ทราบสาเหตุ"}) — พิมพ์หัวข้อเองได้`;
      }
    }

    const created = await fetch("/api/admin/slides/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageUrl: result.data.url,
        // AI อ่านไม่ออกก็ต้องมีหัวข้ออะไรสักอย่าง ไม่งั้น API ปฏิเสธ — แก้ทับบนสไลด์ได้เลย
        title: read.title?.trim() || file.name.replace(/\.[^.]+$/, ""),
        caption: read.caption ?? "",
        startsAt: read.startsAt ?? "",
        endsAt: read.endsAt ?? "",
      }),
    });
    const data = await created.json().catch(() => ({}));

    setBusy(null);
    setProgress({ phase: "done", percent: 100, fileName: file.name });

    if (!created.ok) {
      setStatus({ kind: "error", text: data.error ?? "เพิ่มสไลด์ไม่สำเร็จ" });
      return;
    }
    setStatus({
      // AI พลาดไม่ใช่เรื่องใหญ่ สไลด์ถูกสร้างแล้ว เหลือแค่พิมพ์เอง — แต่ต้องบอกให้รู้
      kind: aiNote.startsWith("AI อ่านภาพไม่สำเร็จ") ? "error" : "ok",
      text: aiNote
        ? `เพิ่มสไลด์แล้ว · ${aiNote}`
        : "เพิ่มสไลด์แล้ว — คลิกที่ข้อความบนสไลด์เพื่อพิมพ์หัวข้อ",
    });
    router.refresh();
  }

  async function row(id: string, init: RequestInit) {
    setBusy("row");
    const response = await fetch(`/api/admin/slides/${id}/`, init);
    setBusy(null);
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setStatus({ kind: "error", text: data.error ?? "บันทึกไม่สำเร็จ" });
      return;
    }
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

  return (
    <section className="space-y-3">
      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void addFromFile(file);
          e.target.value = "";
        }}
      />

      {/*
        บอกให้ชัดว่าหน้านี้บันทึกให้เอง — หน้าเนื้อหาต้องกดบันทึกเอง สองหน้าทำงานคนละแบบ
        ถ้าไม่เขียนไว้ คนจะเผลอนั่งหาปุ่มบันทึกในหน้านี้ หรือไปรอกดบันทึกในหน้าโน้นแล้วลืม
      */}
      <p className="flex items-center gap-2 rounded-lg bg-brand-50/70 px-3 py-2 text-xs text-brand-900">
        <Check className="h-3.5 w-3.5 shrink-0" />
        หน้านี้ <b>บันทึกให้เองทันที</b> ที่แก้เสร็จ — คลิกที่หัวข้อหรือคำอธิบายบนสไลด์แล้วพิมพ์ทับได้เลย
        ไม่ต้องหาปุ่มบันทึก
      </p>

      {status && (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            status.kind === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
          }`}
        >
          {status.text}
        </p>
      )}

      {progress.phase && <UploadProgress {...progress} showAi={aiReady} />}

      {list.length === 0 && (
        <p className="rounded-xl bg-gray-50 py-8 text-center text-sm text-gray-400">
          ยังไม่มีสไลด์ — หน้าเว็บจะใช้ภาพชุดเดิมที่ติดมากับโค้ดไปก่อน
        </p>
      )}

      <AnimatePresence initial={false}>
        {list.map((slide, i) => (
          <motion.div
            key={slide.id}
            layout
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="edit-block"
          >
            <SlideCard
              slide={slide}
              position={positions[i]}
              onChange={(body) => patch(slide.id, body)}
            />

            {/* ปุ่มจัดการ — โผล่ตอนเอาเมาส์ชี้ที่สไลด์ เหมือน EditUI ของหน้าเนื้อหา */}
            <div className="edit-tools">
              <button
                type="button"
                title="เลื่อนขึ้น"
                disabled={busy !== null || i === 0}
                onClick={() => patch(slide.id, { move: "up" })}
                className="rounded p-1 transition hover:bg-white/15 disabled:opacity-25"
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                title="เลื่อนลง"
                disabled={busy !== null || i === list.length - 1}
                onClick={() => patch(slide.id, { move: "down" })}
                className="rounded p-1 transition hover:bg-white/15 disabled:opacity-25"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                title={slide.published ? "ซ่อนจากหน้าเว็บ" : "แสดงบนหน้าเว็บ"}
                disabled={busy !== null}
                onClick={() => patch(slide.id, { published: !slide.published })}
                className="rounded p-1 transition hover:bg-white/15"
              >
                {slide.published ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              </button>
              <button
                type="button"
                title="ลิงก์ วันที่ และปฏิทิน"
                onClick={() => setOpenId(openId === slide.id ? null : slide.id)}
                className={`rounded p-1 transition hover:bg-white/15 ${
                  openId === slide.id ? "bg-white/20" : ""
                }`}
              >
                <Settings2 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                title="ลบสไลด์นี้"
                disabled={busy !== null}
                onClick={() => {
                  if (confirm(`ลบสไลด์ “${slide.title}” ถาวร?`))
                    void row(slide.id, { method: "DELETE" });
                }}
                className="rounded p-1 transition hover:bg-red-500 hover:text-white"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>

            {openId === slide.id && (
              <SlideSettings
                slide={slide}
                onChange={(body) => patch(slide.id, body)}
                onReplaceImage={(url) => patch(slide.id, { imageUrl: url })}
              />
            )}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* เพิ่มสไลด์ — อัปรูปแล้วได้สไลด์เลย ไม่ต้องกรอกฟอร์มก่อน */}
      <button
        type="button"
        onClick={() => fileInput.current?.click()}
        disabled={busy !== null}
        className="flex w-full flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-gray-300 bg-white py-8 text-gray-500 transition hover:border-brand-400 hover:text-brand-700 disabled:opacity-60"
      >
        {busy === "upload" || busy === "ai" ? (
          <Loader2 className="h-6 w-6 animate-spin" />
        ) : aiReady ? (
          <Sparkles className="h-6 w-6" />
        ) : (
          <ImagePlus className="h-6 w-6" />
        )}
        <span className="text-sm font-medium">
          {busy === "upload"
            ? "กำลังอัปโหลด…"
            : busy === "ai"
              ? "AI กำลังอ่านภาพ…"
              : "เพิ่มสไลด์ — เลือกภาพประกาศ"}
        </span>
        <span className="text-xs text-gray-400">
          {aiReady
            ? "AI จะอ่านหัวข้อกับช่วงวันที่จากภาพมาใส่ให้ แล้วแก้ทับบนสไลด์ได้เลย"
            : "อัปแล้วคลิกที่ข้อความบนสไลด์เพื่อพิมพ์หัวข้อ"}
        </span>
      </button>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * ตัวสไลด์ — วางเหมือนที่ขึ้นหน้าแรกจริง (ข้อความซ้าย · ภาพขวา · 16:10)
 * ------------------------------------------------------------------ */

function SlideCard({
  slide,
  position,
  onChange,
}: {
  slide: SlideRow;
  position: number | null;
  onChange: (body: Record<string, unknown>) => void;
}) {
  const state = scheduleState(slide);

  return (
    <div
      className={`edit-frame relative grid aspect-[16/10] grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] items-center gap-4 overflow-hidden rounded-3xl bg-gradient-to-br from-white via-sky-50 to-brand-50 p-6 shadow-sm ring-1 ring-brand-100 sm:gap-7 sm:p-9 ${
        isLive(slide) ? "" : "opacity-60"
      }`}
    >
      {/* แสงนุ่มหลังภาพ — ต้องเหมือนหน้าแรกจริง (ดู src/components/home/Hero.tsx) */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-20 top-1/2 h-[130%] w-2/3 -translate-y-1/2 rounded-full bg-gradient-to-br from-brand-200/70 via-sky-100/60 to-transparent blur-2xl"
      />

      {/* ข้อความด้านซ้าย — คลิกแล้วพิมพ์ทับได้ทั้งสองบรรทัด */}
      <div className="relative min-w-0 text-left">
        {/* ⚠️ ลำดับต้องตรงกับ Hero.tsx เป๊ะ: หัวข้อ → แถบสีคั่น → คำอธิบาย */}
        <RichText
          plain
          singleLine
          value={slide.title}
          onChange={(title) => {
            if (title.trim() && title !== slide.title) onChange({ title });
          }}
          placeholder="พิมพ์หัวข้อสไลด์"
          className="text-lg font-bold leading-snug tracking-tight text-brand-800 sm:text-xl md:text-2xl"
        />
        <span className="mt-3 block h-1 w-16 rounded-full bg-gradient-to-r from-brand-600 to-brand-400 sm:mt-3.5" />
        <RichText
          plain
          value={slide.caption ?? ""}
          onChange={(caption) => {
            if (caption !== (slide.caption ?? "")) onChange({ caption });
          }}
          placeholder="คำอธิบายใต้หัวข้อ (เว้นว่างได้)"
          className="mt-3 text-sm leading-relaxed text-gray-700 sm:mt-3.5 sm:text-base"
        />
      </div>

      {/* ภาพด้านขวา — วางแบบเดียวกับหน้าแรก (object-contain ชิดขวา) */}
      <div className="relative h-full">
        <AssetImage
          src={slide.imageUrl}
          alt={slide.title}
          className="h-full w-full object-contain object-right drop-shadow-[0_14px_28px_rgb(15_83_144_/_.28)]"
        />
      </div>

      <span
        title={
          position ? `ขึ้นเป็นลำดับที่ ${position} บนหน้าเว็บ` : "ยังไม่ขึ้นบนหน้าเว็บ จึงไม่นับลำดับ"
        }
        className={`absolute left-3 top-3 grid h-6 w-6 place-items-center rounded-full text-xs font-bold shadow ${
          position ? "bg-brand-600 text-white" : "bg-gray-300 text-gray-600"
        }`}
      >
        {position ?? "–"}
      </span>

      <span
        className={`absolute right-3 top-3 rounded-full px-2.5 py-0.5 text-[11px] font-medium shadow ${state.tone}`}
      >
        {state.label}
      </span>

      {slide.href && (
        <span className="absolute bottom-2 left-3 inline-flex max-w-[60%] items-center gap-1 truncate rounded-full bg-white/80 px-2 py-0.5 text-[11px] text-gray-500">
          <Link2 className="h-3 w-3 shrink-0" /> {slide.href}
        </span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * แถบตั้งค่าของสไลด์ — ของที่พิมพ์ทับบนภาพไม่ได้
 * ------------------------------------------------------------------ */

function SlideSettings({
  slide,
  onChange,
  onReplaceImage,
}: {
  slide: SlideRow;
  onChange: (body: Record<string, unknown>) => void;
  onReplaceImage: (url: string) => void;
}) {
  const [busy, setBusy] = useState(false);

  return (
    <div className="mt-2 space-y-3 rounded-xl bg-gray-50 p-3 ring-1 ring-gray-200">
      <label className="block">
        <span className="text-xs text-gray-500">ลิงก์เมื่อคลิกสไลด์ (เว้นว่าง = ไม่ลิงก์ไปไหน)</span>
        <input
          defaultValue={slide.href ?? ""}
          onBlur={(e) => {
            if (e.target.value !== (slide.href ?? "")) onChange({ href: e.target.value });
          }}
          placeholder="เช่น /downloads/ หรือ https://..."
          className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <span className="text-xs text-gray-500">วันเริ่มแสดง</span>
          <ThaiDatePicker
            value={slide.startsAt}
            onChange={(startsAt) => onChange({ startsAt })}
            placeholder="แสดงทันที"
            className="mt-1"
          />
        </div>
        <div>
          <span className="text-xs text-gray-500">วันสิ้นสุด</span>
          <ThaiDatePicker
            value={slide.endsAt}
            onChange={(endsAt) => onChange({ endsAt })}
            placeholder="ไม่มีกำหนด"
            className="mt-1"
          />
        </div>
      </div>

      <p className="text-xs text-gray-400">
        ใส่วันสิ้นสุดไว้ พอเลยวันแล้วสไลด์จะหายจากหน้าเว็บเอง ไม่ต้องมาคอยลบ
      </p>

      <div className="grid gap-3 border-t border-gray-200 pt-3 sm:grid-cols-2">
        <div>
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <CalendarDays className="h-3.5 w-3.5" /> วันจัดกิจกรรม (ขึ้นปฏิทินหน้าแรก)
          </span>
          <ThaiDatePicker
            value={slide.eventDate}
            onChange={(eventDate) => onChange({ eventDate })}
            placeholder="ไม่ขึ้นปฏิทิน"
            className="mt-1"
          />
        </div>
        <label className="block">
          <span className="text-xs text-gray-500">ประเภทบนปฏิทิน</span>
          <select
            defaultValue={slide.eventType || "project"}
            disabled={!slide.eventDate}
            onChange={(e) => onChange({ eventType: e.target.value })}
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400 disabled:bg-gray-100 disabled:text-gray-400"
          >
            {EVENT_TYPES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs text-gray-700 ring-1 ring-gray-200 transition hover:bg-gray-100">
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
        เปลี่ยนรูปสไลด์นี้
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;

            setBusy(true);
            const form = new FormData();
            form.append("file", file);
            form.append("folder", "banner_slide");
            const result = await uploadWithProgress<{ url: string }>(
              "/api/admin/upload/",
              form,
              () => {},
            );
            setBusy(false);
            if (result.ok) onReplaceImage(result.data.url);
          }}
        />
      </label>
    </div>
  );
}
