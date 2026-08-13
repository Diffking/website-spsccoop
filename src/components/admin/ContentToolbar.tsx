"use client";

import { useRef, useState, type RefObject } from "react";
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

export default function ContentToolbar({ textarea, value, onChange, folder = "page_images" }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ phase: UploadPhase | null; percent: number; name: string }>(
    { phase: null, percent: 0, name: "" },
  );
  const [error, setError] = useState<string | null>(null);

  /** ครอบข้อความที่เลือกไว้ด้วยแท็ก — ไม่ได้เลือกอะไรก็ใส่ข้อความตัวอย่างแล้วไฮไลต์ให้ */
  function wrap(before: string, after: string, sample: string) {
    const el = textarea.current;
    if (!el) return;

    const start = el.selectionStart;
    const end = el.selectionEnd;
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

    const at = el.selectionStart;
    const before = value.slice(0, at);
    const lead = before && !before.endsWith("\n") ? "\n" : "";
    const next = `${before}${lead}${block}\n${value.slice(at)}`;
    onChange(next);

    requestAnimationFrame(() => {
      el.focus();
      const to = at + lead.length + block.length;
      el.setSelectionRange(to, to);
    });
  }

  async function upload(file: File) {
    setError(null);
    setUploading(true);
    setProgress({ phase: "upload", percent: 0, name: file.name });

    const form = new FormData();
    form.append("file", file);
    form.append("folder", folder);
    const result = await uploadWithProgress<{ url: string }>("/api/admin/upload/", form, (percent, phase) =>
      setProgress((p) => ({ ...p, percent, phase })),
    );
    setUploading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    // ใส่เป็น figure เพื่อให้มีที่เขียนคำบรรยายใต้ภาพ · alt ต้องกรอกเองเพื่อคนใช้โปรแกรมอ่านหน้าจอ
    insert(
      `<figure>\n  <img src="${result.data.url}" alt="${file.name.replace(/\.[^.]+$/, "")}">\n  <figcaption>คำบรรยายภาพ</figcaption>\n</figure>`,
    );
  }

  const tools = [
    { icon: Heading2, title: "หัวข้อใหญ่", run: () => wrap("<h2>", "</h2>", "หัวข้อใหญ่") },
    { icon: Heading3, title: "หัวข้อย่อย", run: () => wrap("<h3>", "</h3>", "หัวข้อย่อย") },
    { icon: Bold, title: "ตัวหนา", run: () => wrap("<strong>", "</strong>", "ข้อความ") },
    { icon: Italic, title: "ตัวเอียง", run: () => wrap("<em>", "</em>", "ข้อความ") },
    { icon: Link2, title: "ลิงก์", run: () => wrap('<a href="https://">', "</a>", "ข้อความลิงก์") },
    {
      icon: List,
      title: "รายการแบบจุด",
      run: () => insert("<ul>\n  <li>รายการที่ 1</li>\n  <li>รายการที่ 2</li>\n</ul>"),
    },
    {
      icon: ListOrdered,
      title: "รายการแบบตัวเลข",
      run: () => insert("<ol>\n  <li>ข้อที่ 1</li>\n  <li>ข้อที่ 2</li>\n</ol>"),
    },
    { icon: Quote, title: "ยกคำพูด", run: () => wrap("<blockquote>", "</blockquote>", "ข้อความที่ยกมา") },
    {
      icon: Table,
      title: "ตาราง",
      run: () =>
        insert(
          "<table>\n  <thead>\n    <tr><th>หัวข้อ 1</th><th>หัวข้อ 2</th></tr>\n  </thead>\n  <tbody>\n    <tr><td>ข้อมูล</td><td>ข้อมูล</td></tr>\n  </tbody>\n</table>",
        ),
    },
    { icon: Minus, title: "เส้นคั่น", run: () => insert("<hr>") },
  ];

  return (
    <div className="border-b border-gray-100 bg-gray-50 px-2 py-1.5">
      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
          e.target.value = "";
        }}
      />

      <div className="flex flex-wrap items-center gap-0.5">
        {tools.map((tool) => (
          <button
            key={tool.title}
            type="button"
            title={tool.title}
            aria-label={tool.title}
            onClick={tool.run}
            className="grid h-8 w-8 place-items-center rounded-lg text-gray-500 transition hover:bg-white hover:text-brand-600 hover:shadow-sm"
          >
            <tool.icon className="h-4 w-4" />
          </button>
        ))}

        <span className="mx-1 h-5 w-px bg-gray-200" />

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
    </div>
  );
}
