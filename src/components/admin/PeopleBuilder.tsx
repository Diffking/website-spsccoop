"use client";

import { useRef, useState } from "react";
import { ChevronDown, ChevronUp, ImagePlus, Loader2, Plus, Trash2, Users } from "lucide-react";
import UploadProgress from "@/components/admin/UploadProgress";
import { findBlock, replaceBlock } from "@/lib/htmlBlocks";
import { uploadWithProgress, type UploadPhase } from "@/lib/uploadClient";

/**
 * ตัวจัดการ "ทำเนียบบุคลากร" ในหน้าเนื้อหา — กรอกชื่อ ตำแหน่ง อัปรูป โดยไม่ต้องแตะ HTML
 *
 * เนื้อหาหน้าเว็บยังเก็บเป็น HTML ก้อนเดียวเหมือนเดิม (ไม่ต้องเพิ่มตารางในฐาน)
 * คอมโพเนนต์นี้ทำหน้าที่อ่านก้อน <div class="people"> ออกมาเป็นรายชื่อให้แก้เป็นช่อง ๆ
 * แล้วประกอบกลับเป็น HTML ก้อนเดิม — ส่วนอื่นของหน้าไม่ถูกแตะเลย
 */

export type Person = { src: string; name: string; role: string };

const COLUMNS = [2, 3, 4, 5] as const;
const DEFAULT_COLUMNS = 4;

const escape = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** อ่านรายชื่อจากก้อน HTML — ใช้ DOMParser เพราะทำงานฝั่งเบราว์เซอร์อยู่แล้ว แม่นกว่า regex */
function parsePeople(html: string): { people: Person[]; columns: number } {
  const block = findBlock(html, "people");
  if (!block) return { people: [], columns: DEFAULT_COLUMNS };

  const columns = Number(/\bcols-(\d)\b/.exec(block.className)?.[1] ?? DEFAULT_COLUMNS);
  const doc = new DOMParser().parseFromString(`<div>${block.inner}</div>`, "text/html");

  const people = Array.from(doc.querySelectorAll(".person")).map((el) => ({
    src: el.querySelector("img")?.getAttribute("src") ?? "",
    name: el.querySelector(".person-name")?.textContent?.trim() ?? "",
    role: el.querySelector(".person-role")?.textContent?.trim() ?? "",
  }));

  return { people, columns: COLUMNS.includes(columns as 2) ? columns : DEFAULT_COLUMNS };
}

/** ประกอบรายชื่อกลับเป็น HTML — รูปแบบเดียวกับที่ .people ใน globals.css รองรับ */
function buildBlock(people: Person[], columns: number): string {
  const items = people
    .map(
      (p) =>
        `  <figure class="person">\n` +
        `    <img src="${escape(p.src)}" alt="${escape(p.name)}">\n` +
        `    <figcaption>\n` +
        `      <span class="person-name">${escape(p.name)}</span>\n` +
        (p.role ? `      <span class="person-role">${escape(p.role)}</span>\n` : "") +
        `    </figcaption>\n` +
        `  </figure>`,
    )
    .join("\n");

  return `<div class="people cols-${columns}">\n${items}\n</div>`;
}

export default function PeopleBuilder({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ phase: UploadPhase | null; percent: number; name: string }>(
    { phase: null, percent: 0, name: "" },
  );
  const [error, setError] = useState<string | null>(null);

  const { people, columns } = parsePeople(value);

  /** เขียนรายชื่อชุดใหม่กลับเข้าเนื้อหา — ส่วนอื่นของหน้าไม่ถูกแตะ */
  const write = (next: Person[], nextColumns = columns) =>
    onChange(replaceBlock(value, "people", buildBlock(next, nextColumns)));

  const patch = (index: number, change: Partial<Person>) =>
    write(people.map((p, i) => (i === index ? { ...p, ...change } : p)));

  const move = (index: number, step: number) => {
    const to = index + step;
    if (to < 0 || to >= people.length) return;
    const next = [...people];
    [next[index], next[to]] = [next[to], next[index]];
    write(next);
  };

  async function addPeople(files: File[]) {
    setError(null);
    setUploading(true);

    const added: Person[] = [];
    for (const [i, file] of files.entries()) {
      setProgress({
        phase: "upload",
        percent: 0,
        name: files.length > 1 ? `${file.name} (${i + 1}/${files.length})` : file.name,
      });

      const form = new FormData();
      form.append("file", file);
      form.append("folder", "page_images");
      const result = await uploadWithProgress<{ url: string }>("/api/admin/upload/", form, (percent, phase) =>
        setProgress((p) => ({ ...p, percent, phase })),
      );

      if (!result.ok) {
        setError(`${file.name}: ${result.error}`);
        break;
      }
      // ตั้งชื่อจากชื่อไฟล์ไปก่อน แก้ทีหลังได้ — ส่วนใหญ่ตั้งชื่อไฟล์เป็นชื่อคนอยู่แล้ว
      added.push({ src: result.data.url, name: file.name.replace(/\.[^.]+$/, ""), role: "" });
    }

    setUploading(false);
    if (added.length > 0) write([...people, ...added]);
  }

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length > 0) void addPeople(files);
          e.target.value = "";
        }}
      />

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 text-left"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
          <Users className="h-4.5 w-4.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-gray-800">ทำเนียบบุคลากร</span>
          <span className="block text-xs text-gray-500">
            {people.length > 0
              ? `${people.length} คน · ${columns} คอลัมน์ — กรอกชื่อและตำแหน่งได้เลย ไม่ต้องแก้ HTML`
              : "ยังไม่มีในหน้านี้ — กดเพื่อเพิ่มรูปพร้อมชื่อและตำแหน่ง"}
          </span>
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-gray-400" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
        )}
      </button>

      {open && (
        <div className="mt-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-600">แสดงกี่คนต่อแถว</span>
            {COLUMNS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => write(people, n)}
                className={`h-8 w-10 rounded-lg text-sm font-medium transition ${
                  columns === n
                    ? "bg-brand-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {n}
              </button>
            ))}
            <span className="text-xs text-gray-400">จอแคบจะลดคอลัมน์ให้เองอัตโนมัติ</span>
          </div>

          {people.length > 0 && (
            <ul className="mt-3 space-y-2">
              {people.map((person, i) => (
                <li
                  key={`${person.src}-${i}`}
                  className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 p-2"
                >
                  <span className="w-5 shrink-0 text-right text-xs tabular-nums text-gray-400">
                    {i + 1}
                  </span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={person.src}
                    alt=""
                    className="h-14 w-12 shrink-0 rounded-lg bg-gray-50 object-cover ring-1 ring-gray-200"
                  />

                  <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <input
                      value={person.name}
                      onChange={(e) => patch(i, { name: e.target.value })}
                      placeholder="ชื่อ-นามสกุล"
                      className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm font-medium outline-none focus:border-brand-400"
                    />
                    <input
                      value={person.role}
                      onChange={(e) => patch(i, { role: e.target.value })}
                      placeholder="ตำแหน่ง (เว้นว่างได้)"
                      className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm outline-none focus:border-brand-400"
                    />
                  </span>

                  <span className="flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => move(i, -1)}
                      disabled={i === 0}
                      title="เลื่อนขึ้น"
                      className="grid h-7 w-7 place-items-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:opacity-25"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(i, 1)}
                      disabled={i === people.length - 1}
                      title="เลื่อนลง"
                      className="grid h-7 w-7 place-items-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:opacity-25"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => write(people.filter((_, at) => at !== i))}
                      title="เอาคนนี้ออก"
                      className="grid h-7 w-7 place-items-center rounded-lg text-gray-400 transition hover:bg-red-50 hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-brand-700 disabled:opacity-60"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : people.length > 0 ? (
                <Plus className="h-4 w-4" />
              ) : (
                <ImagePlus className="h-4 w-4" />
              )}
              เพิ่มคน (เลือกได้หลายรูปพร้อมกัน)
            </button>
            <span className="text-xs text-gray-400">แก้แล้วอย่าลืมกดบันทึกด้านล่าง</span>
          </div>

          <UploadProgress phase={progress.phase} percent={progress.percent} fileName={progress.name} />
          {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
        </div>
      )}
    </section>
  );
}
