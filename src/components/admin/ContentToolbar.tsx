"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import {
  Bold,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Loader2,
  Minus,
  Quote,
  Table,
} from "lucide-react";
import UploadProgress from "@/components/admin/UploadProgress";
import { uploadWithProgress, type UploadPhase } from "@/lib/uploadClient";

/**
 * แถบเครื่องมือจัดข้อความสำหรับช่องเนื้อหา HTML — ใช้ซ้ำได้ทุกที่ที่พิมพ์เนื้อหาเป็น HTML
 *
 * เจ้าหน้าที่ไม่ต้องจำแท็ก — เลือกข้อความแล้วกดปุ่ม ระบบครอบแท็กให้
 * ไม่ได้เลือกอะไรไว้ก็แทรกโครงเปล่าพร้อมข้อความตัวอย่าง แล้วไฮไลต์ไว้ให้พิมพ์ทับได้เลย
 *
 * จงใจไม่ทำเป็น rich text editor เต็มรูปแบบ เพราะเนื้อหาจริงมักก๊อปมาจาก Word
 * ตัวแก้ไขแบบนั้นจะพา style ขยะติดมาด้วย สู้เห็น HTML ตรง ๆ แล้วคุมเองได้ชัดกว่า
 */

type Props = {
  textarea: RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (next: string) => void;
  /** โฟลเดอร์ปลายทางของรูปที่แทรก */
  folder?: string;
};

/**
 * การวางรูปในเนื้อหา — ค่าที่ใส่คือ class ของ <figure> (สไตล์อยู่ที่ .prose-page ใน globals.css)
 * ต้องตรงกับ ALLOWED_CLASSES ใน src/lib/pageHtml.ts ไม่งั้นตัวกรองจะตัดทิ้งตอน AI จัดรูปแบบ
 */
const LAYOUTS = [
  { key: "", label: "เต็มความกว้าง" },
  { key: "small", label: "ขนาดเล็ก" },
  { key: "left", label: "ชิดซ้าย ข้อความไหลรอบ" },
  { key: "right", label: "ชิดขวา ข้อความไหลรอบ" },
] as const;

type Tool =
  | { icon: typeof Bold; title: string; kind: "wrap"; before: string; after: string; sample: string }
  | { icon: typeof Bold; title: string; kind: "block"; block: string };

/** ปุ่มบนแถบเครื่องมือ — เก็บเป็นข้อมูลล้วน ไม่ผูกกับ state ของคอมโพเนนต์ */
const TOOLS: Tool[] = [
  { icon: Heading2, title: "หัวข้อใหญ่", kind: "wrap", before: "<h2>", after: "</h2>", sample: "หัวข้อใหญ่" },
  { icon: Heading3, title: "หัวข้อย่อย", kind: "wrap", before: "<h3>", after: "</h3>", sample: "หัวข้อย่อย" },
  { icon: Bold, title: "ตัวหนา", kind: "wrap", before: "<strong>", after: "</strong>", sample: "ข้อความ" },
  { icon: Italic, title: "ตัวเอียง", kind: "wrap", before: "<em>", after: "</em>", sample: "ข้อความ" },
  {
    icon: Link2,
    title: "ลิงก์",
    kind: "wrap",
    before: '<a href="https://">',
    after: "</a>",
    sample: "ข้อความลิงก์",
  },
  {
    icon: List,
    title: "รายการแบบจุด",
    kind: "block",
    block: "<ul>\n  <li>รายการที่ 1</li>\n  <li>รายการที่ 2</li>\n</ul>",
  },
  {
    icon: ListOrdered,
    title: "รายการแบบตัวเลข",
    kind: "block",
    block: "<ol>\n  <li>ข้อที่ 1</li>\n  <li>ข้อที่ 2</li>\n</ol>",
  },
  {
    icon: Quote,
    title: "ยกคำพูด",
    kind: "wrap",
    before: "<blockquote>",
    after: "</blockquote>",
    sample: "ข้อความที่ยกมา",
  },
  {
    icon: Table,
    title: "ตาราง",
    kind: "block",
    block:
      "<table>\n  <thead>\n    <tr><th>หัวข้อ 1</th><th>หัวข้อ 2</th></tr>\n  </thead>\n  <tbody>\n    <tr><td>ข้อมูล</td><td>ข้อมูล</td></tr>\n  </tbody>\n</table>",
  },
  { icon: Minus, title: "เส้นคั่น", kind: "block", block: "<hr>" },
];

export default function ContentToolbar({ textarea, value, onChange, folder = "page_images" }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ phase: UploadPhase | null; percent: number; name: string }>(
    { phase: null, percent: 0, name: "" },
  );
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [layout, setLayout] = useState<string>("");

  /**
   * ตำแหน่งเคอร์เซอร์ล่าสุดในช่องพิมพ์ — null = ยังไม่เคยคลิกในช่องเลย
   *
   * ตอนกดปุ่มบนแถบเครื่องมือ โฟกัสอยู่ที่ปุ่ม ไม่ใช่ช่องพิมพ์ ถ้าอ่าน selectionStart
   * ตรง ๆ จะได้ 0 เสมอ ของที่แทรกเลยไปโผล่บนสุดของบทความแบบไม่มีใครคาดคิด
   */
  const caret = useRef<number | null>(null);

  useEffect(() => {
    const el = textarea.current;
    if (!el) return;
    const remember = () => {
      caret.current = el.selectionStart;
    };
    for (const event of ["keyup", "mouseup", "blur", "input"]) {
      el.addEventListener(event, remember);
    }
    return () => {
      for (const event of ["keyup", "mouseup", "blur", "input"]) {
        el.removeEventListener(event, remember);
      }
    };
  }, [textarea]);

  /** ช่วงที่จะเขียนทับ — ไม่เคยแตะช่องพิมพ์เลยถือว่าอยากต่อท้าย */
  function range() {
    const el = textarea.current;
    if (!el) return { start: value.length, end: value.length };
    const untouched = caret.current === null && el.selectionStart === 0 && el.selectionEnd === 0;
    if (untouched) return { start: value.length, end: value.length };
    return { start: el.selectionStart, end: el.selectionEnd };
  }

  /** ครอบข้อความที่เลือกไว้ด้วยแท็ก — ไม่ได้เลือกอะไรก็ใส่ข้อความตัวอย่างแล้วไฮไลต์ให้ */
  function wrap(before: string, after: string, sample: string) {
    const el = textarea.current;
    if (!el) return;

    const { start, end } = range();
    const picked = value.slice(start, end) || sample;
    const next = `${value.slice(0, start)}${before}${picked}${after}${value.slice(end)}`;
    onChange(next);

    // ต้องรอให้ React วาดค่าใหม่ลง textarea ก่อน ถึงจะเลื่อนเคอร์เซอร์ได้ถูกตำแหน่ง
    requestAnimationFrame(() => {
      el.focus();
      const from = start + before.length;
      el.setSelectionRange(from, from + picked.length);
    });
  }

  /** แทรกโครงหลายบรรทัด (ตาราง เส้นคั่น รูป) ที่ตำแหน่งเคอร์เซอร์ */
  function insert(block: string) {
    const el = textarea.current;
    if (!el) return;

    const at = range().start;
    const before = value.slice(0, at);
    const lead = before && !before.endsWith("\n") ? "\n" : "";
    const next = `${before}${lead}${block}\n${value.slice(at)}`;
    onChange(next);

    requestAnimationFrame(() => {
      el.focus();
      const to = at + lead.length + block.length;
      el.setSelectionRange(to, to);
      caret.current = to;
      // เลื่อนช่องพิมพ์ไปตรงที่เพิ่งแทรก ไม่งั้นแทรกท้ายบทความยาว ๆ แล้วไม่เห็นว่าอะไรเกิดขึ้น
      el.blur();
      el.focus();
    });
  }

  /** โครง <figure> ของรูปหนึ่งใบ — alt ตั้งจากชื่อไฟล์ไปก่อน แก้ทีหลังได้ */
  function figureOf(url: string, name: string, cls: string, indent = "  ") {
    const attr = cls ? ` class="${cls}"` : "";
    const alt = name.replace(/\.[^.]+$/, "").replace(/"/g, "");
    return (
      `<figure${attr}>\n${indent}  <img src="${url}" alt="${alt}">\n` +
      `${indent}  <figcaption>คำบรรยายภาพ</figcaption>\n${indent}</figure>`
    );
  }

  /**
   * อัปได้ทีละหลายไฟล์ — เลือกไฟล์เดียวได้รูปเดี่ยว เลือกหลายไฟล์ได้แถวรูปเรียงข้างกัน
   * อัปเรียงทีละไฟล์ ไม่ยิงพร้อมกัน เพราะแถบความคืบหน้ามีอันเดียวและ FTP ก็รับทีละไฟล์อยู่ดี
   */
  async function uploadMany(files: File[]) {
    setError(null);
    setHint(null);
    setUploading(true);

    const done: { url: string; name: string }[] = [];
    for (const [i, file] of files.entries()) {
      setProgress({
        phase: "upload",
        percent: 0,
        name: files.length > 1 ? `${file.name} (${i + 1}/${files.length})` : file.name,
      });

      const form = new FormData();
      form.append("file", file);
      form.append("folder", folder);
      const result = await uploadWithProgress<{ url: string }>("/api/admin/upload/", form, (percent, phase) =>
        setProgress((p) => ({ ...p, percent, phase })),
      );

      if (!result.ok) {
        setUploading(false);
        setError(`${file.name}: ${result.error}`);
        if (done.length === 0) return;
        break;
      }
      done.push({ url: result.data.url, name: file.name });
    }
    setUploading(false);
    if (done.length === 0) return;

    // ใส่เป็น figure เพื่อให้มีที่เขียนคำบรรยายใต้ภาพ · alt มีไว้ให้คนใช้โปรแกรมอ่านหน้าจอ
    const block =
      done.length === 1
        ? figureOf(done[0].url, done[0].name, layout)
        : `<div class="image-row">\n  ${done
            .map((d) => figureOf(d.url, d.name, "", "  "))
            .join("\n  ")}\n</div>`;

    insert(block);
    setHint(
      done.length === 1
        ? "แทรกรูปลงในเนื้อหาแล้ว — ต้องกดบันทึกด้านล่างด้วย รูปถึงจะขึ้นบนหน้าเว็บจริง"
        : `แทรก ${done.length} รูปเรียงเป็นแถวแล้ว — ต้องกดบันทึกด้านล่างด้วย`,
    );
  }

  return (
    <div className="border-b border-gray-100 bg-gray-50 px-2 py-1.5">
      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length > 0) void uploadMany(files);
          e.target.value = "";
        }}
      />

      <div className="flex flex-wrap items-center gap-0.5">
        {TOOLS.map((tool) => (
          <button
            key={tool.title}
            type="button"
            title={tool.title}
            aria-label={tool.title}
            onClick={() =>
              tool.kind === "wrap"
                ? wrap(tool.before, tool.after, tool.sample)
                : insert(tool.block)
            }
            className="grid h-8 w-8 place-items-center rounded-lg text-gray-500 transition hover:bg-white hover:text-brand-600 hover:shadow-sm"
          >
            <tool.icon className="h-4 w-4" />
          </button>
        ))}

        <span className="mx-1 h-5 w-px bg-gray-200" />

        <select
          value={layout}
          onChange={(e) => setLayout(e.target.value)}
          aria-label="การวางรูป"
          title="เลือกก่อนกดแทรกรูป — เลือกหลายไฟล์พร้อมกันจะได้แถวรูปเรียงข้างกันแทน"
          className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-600 outline-none focus:border-brand-400"
        >
          {LAYOUTS.map((l) => (
            <option key={l.key} value={l.key}>
              {l.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs font-medium text-brand-700 transition hover:bg-brand-100 disabled:opacity-60"
        >
          {uploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ImagePlus className="h-3.5 w-3.5" />
          )}
          แทรกรูป
        </button>
      </div>

      <UploadProgress phase={progress.phase} percent={progress.percent} fileName={progress.name} />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      {hint && <p className="mt-1 text-xs font-medium text-emerald-700">{hint}</p>}
    </div>
  );
}
