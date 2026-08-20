"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  FileText,
  ImagePlus,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import RichText from "@/components/admin/RichText";
import { uploadWithProgress } from "@/lib/uploadClient";
import {
  ADDABLE,
  BLOCK_LABEL,
  type Block,
  type BlockKind,
  blockId,
  blocksToHtml,
  emptyBlock,
  htmlToBlocks,
  plainText,
} from "@/lib/pageBlocks";

/**
 * EditUI — แก้เนื้อหาหน้าเว็บโดยไม่ต้องอ่านโค้ดออก
 *
 * เนื้อหาหน้าหนึ่งถูกอ่านออกมาเป็น "ก้อน" เรียงจากบนลงล่างตามที่ปรากฏบนหน้าเว็บจริง
 * (หัวข้อ · ย่อหน้า · ตาราง · การ์ด PDF ฯลฯ) แต่ละก้อนมีช่องกรอกของตัวเอง
 * เลื่อนขึ้นลง ก๊อป ลบ ได้ทีละก้อน — ไม่ต้องไปนั่งนับ </div> เอง
 *
 * ทำงานบนเนื้อหาก้อนเดียวกับ EditCode สลับไปมาได้ตลอด: พิมพ์ที่นี่แล้วไปดู EditCode
 * ก็เห็น HTML ที่เพิ่งเปลี่ยน · แก้ที่ EditCode แล้วกลับมาที่นี่ก็อ่านของใหม่เข้ามา
 *
 * อะไรที่ระบบอ่านไม่ออกจะกลายเป็นก้อน "โค้ด HTML" ที่ยังแก้เป็นข้อความได้ตามเดิม
 * — ไม่มีทางที่เนื้อหาจะหายไปเพราะเปิดหน้าจอนี้
 */

type Props = {
  value: string;
  onChange: (next: string) => void;
  /** โฟลเดอร์ปลายทางของรูป/ไฟล์ที่อัปจากในนี้ */
  folder: string;
};

export default function VisualEditor({ value, onChange, folder }: Props) {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [ready, setReady] = useState(false);
  /** HTML ที่เราเพิ่งเขียนออกไปเอง — เจอค่านี้กลับเข้ามาก็ไม่ต้องอ่านใหม่ให้ก้อนกระพริบ */
  const written = useRef<string | null>(null);

  useEffect(() => {
    if (written.current === value) return;
    setBlocks(htmlToBlocks(value));
    written.current = value;
    setReady(true);
  }, [value]);

  /** บันทึกก้อนชุดใหม่แล้วส่ง HTML กลับให้หน้าแม่ทันที */
  const commit = (next: Block[]) => {
    setBlocks(next);
    const html = blocksToHtml(next);
    written.current = html;
    onChange(html);
  };

  const replaceAt = (index: number, block: Block) =>
    commit(blocks.map((b, i) => (i === index ? block : b)));

  const insertAt = (index: number, kind: BlockKind) =>
    commit([...blocks.slice(0, index), emptyBlock(kind), ...blocks.slice(index)]);

  const removeAt = (index: number) => commit(blocks.filter((_, i) => i !== index));

  const duplicateAt = (index: number) => {
    const copy = JSON.parse(JSON.stringify(blocks[index])) as Block;
    copy.id = blockId();
    commit([...blocks.slice(0, index + 1), copy, ...blocks.slice(index + 1)]);
  };

  const moveAt = (index: number, step: -1 | 1) => {
    const to = index + step;
    if (to < 0 || to >= blocks.length) return;
    const next = [...blocks];
    [next[index], next[to]] = [next[to], next[index]];
    commit(next);
  };

  if (!ready) {
    return (
      <p className="flex items-center gap-2 p-6 text-sm text-gray-400">
        <Loader2 className="h-4 w-4 animate-spin" /> กำลังอ่านเนื้อหา…
      </p>
    );
  }

  return (
    <div className="space-y-2 bg-gray-50/70 p-3">
      {blocks.length === 0 && (
        <p className="rounded-xl bg-white p-6 text-center text-sm text-gray-500 ring-1 ring-gray-200">
          หน้านี้ยังไม่มีเนื้อหา — กด “เพิ่มก้อนเนื้อหา” ด้านล่างเพื่อเริ่ม
        </p>
      )}

      {blocks.map((block, index) => (
        <BlockCard
          key={block.id}
          block={block}
          index={index}
          total={blocks.length}
          folder={folder}
          onChange={(next) => replaceAt(index, next)}
          onMove={(step) => moveAt(index, step)}
          onDuplicate={() => duplicateAt(index)}
          onRemove={() => removeAt(index)}
          onInsertBelow={(kind) => insertAt(index + 1, kind)}
        />
      ))}

      <AddMenu onPick={(kind) => insertAt(blocks.length, kind)} wide />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * เมนูเพิ่มก้อน
 * ------------------------------------------------------------------ */

function AddMenu({ onPick, wide = false }: { onPick: (kind: BlockKind) => void; wide?: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`relative ${wide ? "" : "inline-block"}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-gray-300 bg-white text-sm text-gray-500 transition hover:border-brand-400 hover:text-brand-700 ${
          wide ? "w-full py-3" : "px-2 py-1 text-xs"
        }`}
      >
        <Plus className={wide ? "h-4 w-4" : "h-3.5 w-3.5"} />
        {wide ? "เพิ่มก้อนเนื้อหา" : "แทรกด้านล่าง"}
      </button>

      {open && (
        <>
          {/* คลิกที่ไหนก็ได้เพื่อปิดเมนู */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 z-20 mt-1 grid w-64 grid-cols-2 gap-0.5 rounded-xl bg-white p-1.5 shadow-lg ring-1 ring-black/10">
            {ADDABLE.map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => {
                  onPick(kind);
                  setOpen(false);
                }}
                className="rounded-lg px-2.5 py-2 text-left text-sm text-gray-700 transition hover:bg-brand-50 hover:text-brand-800"
              >
                {BLOCK_LABEL[kind]}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * กรอบของก้อนหนึ่งก้อน
 * ------------------------------------------------------------------ */

function BlockCard({
  block,
  index,
  total,
  folder,
  onChange,
  onMove,
  onDuplicate,
  onRemove,
  onInsertBelow,
}: {
  block: Block;
  index: number;
  total: number;
  folder: string;
  onChange: (next: Block) => void;
  onMove: (step: -1 | 1) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onInsertBelow: (kind: BlockKind) => void;
}) {
  return (
    <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200">
      <div className="flex items-center gap-1.5 border-b border-gray-100 px-3 py-1.5">
        <span className="w-6 shrink-0 text-xs tabular-nums text-gray-300">{index + 1}</span>
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-gray-500">
          {BLOCK_LABEL[block.kind]}
          <BlockHint block={block} />
        </span>

        <button
          type="button"
          onClick={() => onMove(-1)}
          disabled={index === 0}
          title="เลื่อนขึ้น"
          className="rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
        >
          <ChevronUp className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onMove(1)}
          disabled={index === total - 1}
          title="เลื่อนลง"
          className="rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onDuplicate}
          title="ทำสำเนาก้อนนี้"
          className="rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
        >
          <Copy className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            if (confirm(`ลบก้อน “${BLOCK_LABEL[block.kind]}” นี้?`)) onRemove();
          }}
          title="ลบก้อนนี้"
          className="rounded-lg p-1 text-gray-400 transition hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="p-3">
        <BlockFields block={block} folder={folder} onChange={onChange} />
      </div>

      <div className="px-3 pb-2">
        <AddMenu onPick={onInsertBelow} />
      </div>
    </div>
  );
}

/** คำโปรยข้าง ๆ ชื่อชนิดก้อน — บอกให้รู้ว่าก้อนนี้คือก้อนไหนโดยไม่ต้องอ่านทั้งก้อน */
function BlockHint({ block }: { block: Block }) {
  const text = (() => {
    switch (block.kind) {
      case "heading":
        return `H${block.level} · ${plainText(block.html)}`;
      case "list":
        return `${block.items.length} รายการ`;
      case "table":
        return `${block.rows.length} แถว × ${block.head.length || block.rows[0]?.length || 0} คอลัมน์`;
      case "pdfCard":
        return block.name;
      case "cards":
        return `${block.cards.length} การ์ด`;
      case "people":
        return `${block.people.length} คน`;
      case "tabs":
        return block.tabs.map((t) => t.title).join(" · ");
      case "imageRow":
        return `${block.images.length} รูป`;
      default:
        return "";
    }
  })();

  return text ? <span className="ml-1.5 font-normal text-gray-400">— {text}</span> : null;
}

/* ------------------------------------------------------------------ *
 * ช่องกรอกของแต่ละชนิดก้อน
 * ------------------------------------------------------------------ */

const input =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500";
const smallLabel = "block text-xs text-gray-500";

function BlockFields({
  block,
  folder,
  onChange,
}: {
  block: Block;
  folder: string;
  onChange: (next: Block) => void;
}) {
  switch (block.kind) {
    case "heading":
      return (
        <div className="flex items-start gap-2">
          <select
            value={block.level}
            onChange={(e) => onChange({ ...block, level: Number(e.target.value) as 2 | 3 | 4 })}
            className="shrink-0 rounded-lg border border-gray-300 px-2 py-2 text-sm outline-none focus:border-brand-500"
          >
            <option value={2}>ใหญ่</option>
            <option value={3}>กลาง</option>
            <option value={4}>เล็ก</option>
          </select>
          <RichText
            singleLine
            value={block.html}
            onChange={(html) => onChange({ ...block, html })}
            placeholder="ข้อความหัวข้อ"
            className="flex-1"
          />
        </div>
      );

    case "paragraph":
    case "quote":
      return (
        <RichText
          value={block.html}
          onChange={(html) => onChange({ ...block, html })}
          placeholder={block.kind === "quote" ? "ข้อความที่ยกมา" : "พิมพ์ย่อหน้าที่นี่"}
        />
      );

    case "divider":
      return <hr className="my-2 border-gray-200" />;

    case "list":
      return <ListFields block={block} onChange={onChange} />;

    case "image":
      return <ImageFields block={block} folder={folder} onChange={onChange} />;

    case "imageRow":
      return <ImageRowFields block={block} folder={folder} onChange={onChange} />;

    case "table":
      return <TableFields block={block} onChange={onChange} />;

    case "pdfCard":
      return <PdfCardFields block={block} folder={folder} onChange={onChange} />;

    case "pdfIcon":
      return <PdfIconFields block={block} onChange={onChange} />;

    case "cards":
      return <CardsFields block={block} onChange={onChange} />;

    case "people":
      return <PeopleFields block={block} folder={folder} onChange={onChange} />;

    case "tabs":
      return <TabsFields block={block} folder={folder} onChange={onChange} />;

    case "html":
      return (
        <>
          <textarea
            value={block.html}
            onChange={(e) => onChange({ ...block, html: e.target.value })}
            rows={4}
            className={`${input} font-mono`}
          />
          <p className="mt-1 text-xs text-gray-400">
            ก้อนนี้ระบบแปลงเป็นช่องกรอกให้ไม่ได้ จึงแสดงเป็นโค้ดตามเดิม — ไม่แน่ใจอย่าแก้
          </p>
        </>
      );
  }
}

/* ---------- รายการ ---------- */

function ListFields({
  block,
  onChange,
}: {
  block: Extract<Block, { kind: "list" }>;
  onChange: (next: Block) => void;
}) {
  const setItem = (i: number, html: string) =>
    onChange({ ...block, items: block.items.map((v, n) => (n === i ? html : v)) });

  return (
    <div className="space-y-1.5">
      <div className="flex gap-1.5">
        {([false, true] as const).map((ordered) => (
          <button
            key={String(ordered)}
            type="button"
            onClick={() => onChange({ ...block, ordered })}
            className={`rounded-lg px-2.5 py-1 text-xs transition ${
              block.ordered === ordered
                ? "bg-brand-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {ordered ? "เลข 1. 2. 3." : "จุดนำหน้า"}
          </button>
        ))}
      </div>

      {block.items.map((item, i) => (
        <div key={i} className="flex items-start gap-2">
          <span className="w-5 shrink-0 pt-2 text-center text-xs text-gray-400">
            {block.ordered ? `${i + 1}.` : "•"}
          </span>
          <RichText
            singleLine
            value={item}
            onChange={(html) => setItem(i, html)}
            placeholder={`รายการที่ ${i + 1}`}
            className="flex-1"
          />
          <button
            type="button"
            onClick={() => onChange({ ...block, items: block.items.filter((_, n) => n !== i) })}
            className="shrink-0 rounded-lg p-2 text-gray-300 transition hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={() => onChange({ ...block, items: [...block.items, ""] })}
        className="rounded-lg px-2 py-1 text-xs text-brand-700 transition hover:bg-brand-50"
      >
        ＋ เพิ่มรายการ
      </button>
    </div>
  );
}

/* ---------- อัปไฟล์ ---------- */

/** อัปไฟล์หนึ่งไฟล์ขึ้นระบบ — คืน URL ที่เอาไปใส่เนื้อหาได้ หรือ null ถ้าไม่สำเร็จ */
async function uploadOne(
  file: File,
  folder: string,
  maxEdge: number | null,
  onPercent: (percent: number) => void,
): Promise<string | null> {
  const form = new FormData();
  form.append("file", file);
  form.append("folder", folder);
  if (maxEdge !== null) form.append("maxEdge", String(maxEdge));

  const result = await uploadWithProgress<{ url: string }>("/api/admin/upload/", form, (percent) =>
    onPercent(percent),
  );
  return result.ok ? result.data.url : null;
}

/** ปุ่มเลือกไฟล์ที่อัปให้เสร็จแล้วส่ง URL กลับมา — ใช้ซ้ำทั้งรูปและ PDF */
function UploadButton({
  label,
  accept,
  folder,
  maxEdge,
  multiple = false,
  onDone,
}: {
  label: string;
  accept: string;
  folder: string;
  maxEdge: number | null;
  multiple?: boolean;
  onDone: (files: { url: string; name: string }[]) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [percent, setPercent] = useState(0);
  const [error, setError] = useState("");

  return (
    <div>
      <label
        className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-xs text-gray-700 transition hover:bg-gray-200 ${
          busy ? "pointer-events-none opacity-60" : ""
        }`}
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : accept.includes("pdf") ? (
          <FileText className="h-3.5 w-3.5" />
        ) : (
          <ImagePlus className="h-3.5 w-3.5" />
        )}
        {busy ? `กำลังอัป ${percent}%` : label}
        <input
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          onChange={async (e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            if (files.length === 0) return;

            setBusy(true);
            setError("");
            const done: { url: string; name: string }[] = [];
            // อัปทีละไฟล์ ไม่ยิงพร้อมกัน — แถบความคืบหน้ามีอันเดียวและปลายทางก็รับทีละไฟล์อยู่ดี
            for (const file of files) {
              setPercent(0);
              const url = await uploadOne(file, folder, maxEdge, setPercent);
              if (!url) {
                setError(`อัป ${file.name} ไม่สำเร็จ`);
                break;
              }
              done.push({ url, name: file.name });
            }
            setBusy(false);
            if (done.length > 0) onDone(done);
          }}
        />
      </label>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

/* ---------- รูปภาพ ---------- */

const LAYOUTS = [
  { key: "", label: "เต็มความกว้าง" },
  { key: "small", label: "ขนาดเล็ก" },
  { key: "left", label: "ชิดซ้าย" },
  { key: "right", label: "ชิดขวา" },
] as const;

function ImageFields({
  block,
  folder,
  onChange,
}: {
  block: Extract<Block, { kind: "image" }>;
  folder: string;
  onChange: (next: Block) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-start gap-3">
        {block.src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={block.src}
            alt=""
            className="h-24 w-24 shrink-0 rounded-lg object-cover ring-1 ring-gray-200"
          />
        ) : (
          <span className="grid h-24 w-24 shrink-0 place-items-center rounded-lg bg-gray-100 text-gray-300">
            <ImagePlus className="h-6 w-6" />
          </span>
        )}

        <div className="min-w-0 flex-1 space-y-2">
          <UploadButton
            label={block.src ? "เปลี่ยนรูป" : "เลือกรูป"}
            accept="image/*"
            folder={folder}
            maxEdge={600}
            onDone={([file]) =>
              onChange({
                ...block,
                src: file.url,
                alt: block.alt || file.name.replace(/\.[^.]+$/, ""),
              })
            }
          />
          <label className={smallLabel}>
            คำอธิบายรูปสำหรับคนตาบอด
            <input
              value={block.alt}
              onChange={(e) => onChange({ ...block, alt: e.target.value })}
              placeholder="เช่น ภาพหมู่คณะกรรมการชุดที่ 45"
              className={`mt-0.5 ${input}`}
            />
          </label>
        </div>
      </div>

      <label className={smallLabel}>
        คำบรรยายใต้ภาพ (เว้นว่างได้)
        <RichText
          singleLine
          value={block.caption}
          onChange={(caption) => onChange({ ...block, caption })}
          placeholder="คำบรรยายใต้ภาพ"
          className="mt-0.5"
        />
      </label>

      <div className="flex flex-wrap gap-1.5">
        {LAYOUTS.map((l) => (
          <button
            key={l.key}
            type="button"
            onClick={() => onChange({ ...block, layout: l.key })}
            className={`rounded-lg px-2.5 py-1 text-xs transition ${
              block.layout === l.key
                ? "bg-brand-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ImageRowFields({
  block,
  folder,
  onChange,
}: {
  block: Extract<Block, { kind: "imageRow" }>;
  folder: string;
  onChange: (next: Block) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {block.images.map((img, i) => (
          <div key={i} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.src}
              alt={img.alt}
              className="h-20 w-20 rounded-lg object-cover ring-1 ring-gray-200"
            />
            <button
              type="button"
              onClick={() => onChange({ ...block, images: block.images.filter((_, n) => n !== i) })}
              className="absolute -right-1.5 -top-1.5 rounded-full bg-white p-1 text-gray-400 shadow ring-1 ring-gray-200 transition hover:text-red-600"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>

      <UploadButton
        label="เพิ่มรูปในแถว"
        accept="image/*"
        folder={folder}
        maxEdge={600}
        multiple
        onDone={(files) =>
          onChange({
            ...block,
            images: [
              ...block.images,
              ...files.map((f) => ({ url: f.url, name: f.name })).map((f) => ({
                src: f.url,
                alt: f.name.replace(/\.[^.]+$/, ""),
              })),
            ],
          })
        }
      />
    </div>
  );
}

/* ---------- ตาราง ---------- */

function TableFields({
  block,
  onChange,
}: {
  block: Extract<Block, { kind: "table" }>;
  onChange: (next: Block) => void;
}) {
  const cols = Math.max(block.head.length, ...block.rows.map((r) => r.length), 1);

  /** ทำให้ทุกแถวยาวเท่ากันเสมอ — แถวสั้นกว่าคนอื่นทำให้ตารางบนหน้าเว็บเบี้ยว */
  const pad = (row: string[], size: number) =>
    Array.from({ length: size }, (_, i) => row[i] ?? "");

  const setCell = (rowIndex: number, colIndex: number, html: string) =>
    onChange({
      ...block,
      rows: block.rows.map((r, n) =>
        n === rowIndex ? pad(r, cols).map((c, i) => (i === colIndex ? html : c)) : pad(r, cols),
      ),
    });

  const setHead = (colIndex: number, html: string) =>
    onChange({ ...block, head: pad(block.head, cols).map((c, i) => (i === colIndex ? html : c)) });

  const addCol = () =>
    onChange({
      ...block,
      head: [...pad(block.head, cols), `หัวข้อ ${cols + 1}`],
      rows: block.rows.map((r) => [...pad(r, cols), ""]),
    });

  const removeCol = (colIndex: number) =>
    onChange({
      ...block,
      head: pad(block.head, cols).filter((_, i) => i !== colIndex),
      rows: block.rows.map((r) => pad(r, cols).filter((_, i) => i !== colIndex)),
    });

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              {Array.from({ length: cols }, (_, c) => (
                <th key={c} className="border border-gray-200 bg-gray-50 p-1 align-top">
                  <RichText
                    singleLine
                    value={block.head[c] ?? ""}
                    onChange={(html) => setHead(c, html)}
                    placeholder={`หัวข้อ ${c + 1}`}
                  />
                  <button
                    type="button"
                    onClick={() => removeCol(c)}
                    title="ลบคอลัมน์นี้"
                    className="mt-0.5 w-full rounded text-[11px] text-gray-400 transition hover:bg-red-50 hover:text-red-600"
                  >
                    ลบคอลัมน์
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, r) => (
              <tr key={r}>
                {Array.from({ length: cols }, (_, c) => (
                  <td key={c} className="border border-gray-200 p-1 align-top">
                    <RichText
                      value={row[c] ?? ""}
                      onChange={(html) => setCell(r, c, html)}
                      placeholder="…"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => onChange({ ...block, rows: [...block.rows, Array(cols).fill("")] })}
          className="rounded-lg bg-gray-100 px-2.5 py-1 text-xs text-gray-700 transition hover:bg-gray-200"
        >
          ＋ เพิ่มแถว
        </button>
        <button
          type="button"
          onClick={addCol}
          className="rounded-lg bg-gray-100 px-2.5 py-1 text-xs text-gray-700 transition hover:bg-gray-200"
        >
          ＋ เพิ่มคอลัมน์
        </button>
        {block.rows.length > 1 && (
          <button
            type="button"
            onClick={() => onChange({ ...block, rows: block.rows.slice(0, -1) })}
            className="rounded-lg px-2.5 py-1 text-xs text-gray-500 transition hover:bg-red-50 hover:text-red-600"
          >
            ลบแถวสุดท้าย
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------- ไฟล์ PDF ---------- */

function PdfCardFields({
  block,
  folder,
  onChange,
}: {
  block: Extract<Block, { kind: "pdfCard" }>;
  folder: string;
  onChange: (next: Block) => void;
}) {
  return (
    <div className="space-y-2">
      <label className={smallLabel}>
        ชื่อไฟล์ที่แสดงบนการ์ด
        <input
          value={block.name}
          onChange={(e) => onChange({ ...block, name: e.target.value })}
          placeholder="เช่น ประกาศที่ 20-2569 จรรยาบรรณ.pdf"
          className={`mt-0.5 ${input}`}
        />
      </label>

      <UploadButton
        label={block.fileHref ? "เปลี่ยนไฟล์ PDF" : "เลือกไฟล์ PDF"}
        accept="application/pdf"
        folder={folder}
        maxEdge={null}
        onDone={([file]) =>
          onChange({
            ...block,
            name: file.name,
            fileHref: file.url,
            // ลิงก์อ่านในเว็บสร้างจากที่อยู่ไฟล์ + ชื่อ ให้เหมือนที่ EditCode เขียนทุกตัวอักษร
            readHref: `/read/?src=${encodeURIComponent(file.url)}&title=${encodeURIComponent(file.name)}`,
          })
        }
      />

      {block.fileHref ? (
        <p className="truncate font-mono text-[11px] text-gray-400">{block.fileHref}</p>
      ) : (
        <p className="text-xs text-amber-700">ยังไม่มีไฟล์ — การ์ดนี้จะกดอะไรไม่ได้บนหน้าเว็บ</p>
      )}
    </div>
  );
}

const ICON_COLORS = [
  { key: "", label: "แดง" },
  { key: "blue", label: "ฟ้า" },
  { key: "green", label: "เขียว" },
  { key: "amber", label: "ส้ม" },
  { key: "purple", label: "ม่วง" },
  { key: "gray", label: "เทา" },
];

function PdfIconFields({
  block,
  onChange,
}: {
  block: Extract<Block, { kind: "pdfIcon" }>;
  onChange: (next: Block) => void;
}) {
  return (
    <div className="space-y-2">
      <label className={smallLabel}>
        ชื่อไฟล์ (ขึ้นตอนเอาเมาส์ชี้ และโปรแกรมอ่านหน้าจออ่านให้คนตาบอด)
        <input
          value={block.label}
          onChange={(e) => onChange({ ...block, label: e.target.value })}
          className={`mt-0.5 ${input}`}
        />
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={block.read ? "read" : "download"}
          onChange={(e) => onChange({ ...block, read: e.target.value === "read" })}
          className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs outline-none focus:border-brand-500"
        >
          <option value="read">กดแล้วเปิดอ่านในเว็บ</option>
          <option value="download">กดแล้วโหลดไฟล์ทันที</option>
        </select>

        <select
          value={block.color}
          onChange={(e) => onChange({ ...block, color: e.target.value })}
          className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs outline-none focus:border-brand-500"
        >
          {ICON_COLORS.map((c) => (
            <option key={c.key} value={c.key}>
              สี{c.label}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-1.5 text-xs text-gray-500">
          ขนาด
          <input
            type="number"
            min={20}
            max={200}
            value={block.size}
            onChange={(e) => onChange({ ...block, size: Number(e.target.value) || 50 })}
            className="w-16 rounded-lg border border-gray-300 px-2 py-1.5 text-xs outline-none focus:border-brand-500"
          />
          px
        </label>
      </div>

      <p className="truncate font-mono text-[11px] text-gray-400">{block.href}</p>
    </div>
  );
}

/* ---------- การ์ดลิงก์ ---------- */

const CARD_COLORS = ["blue", "green", "amber", "pink", "purple", "teal"];

function CardsFields({
  block,
  onChange,
}: {
  block: Extract<Block, { kind: "cards" }>;
  onChange: (next: Block) => void;
}) {
  const setCard = (i: number, patch: Partial<(typeof block.cards)[number]>) =>
    onChange({ ...block, cards: block.cards.map((c, n) => (n === i ? { ...c, ...patch } : c)) });

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-xs text-gray-500">
        การ์ดต่อแถว
        <select
          value={block.cols}
          onChange={(e) => onChange({ ...block, cols: Number(e.target.value) })}
          className="rounded-lg border border-gray-300 px-2 py-1 text-xs outline-none focus:border-brand-500"
        >
          {[2, 3, 4].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>

      {block.cards.map((card, i) => (
        <div key={i} className="space-y-1.5 rounded-lg bg-gray-50 p-2 ring-1 ring-gray-200">
          <div className="flex items-center gap-1.5">
            <input
              value={card.title}
              onChange={(e) => setCard(i, { title: e.target.value })}
              placeholder="ชื่อหัวข้อ"
              className={input}
            />
            <button
              type="button"
              onClick={() => onChange({ ...block, cards: block.cards.filter((_, n) => n !== i) })}
              className="shrink-0 rounded-lg p-2 text-gray-300 transition hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <input
            value={card.sub}
            onChange={(e) => setCard(i, { sub: e.target.value })}
            placeholder="คำอธิบายสั้น ๆ"
            className={input}
          />
          <div className="flex flex-wrap gap-1.5">
            <input
              value={card.badge}
              onChange={(e) => setCard(i, { badge: e.target.value })}
              placeholder="ป้าย เช่น แผน"
              className={`${input} w-28 flex-none`}
            />
            <input
              value={card.href}
              onChange={(e) => setCard(i, { href: e.target.value })}
              placeholder="ลิงก์ เช่น /downloads/"
              className={`${input} min-w-0 flex-1 font-mono text-xs`}
            />
            <select
              value={card.color}
              onChange={(e) => setCard(i, { color: e.target.value })}
              className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs outline-none focus:border-brand-500"
            >
              {CARD_COLORS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={() =>
          onChange({
            ...block,
            cards: [
              ...block.cards,
              { color: "blue", badge: "", title: "ชื่อหัวข้อ", sub: "", href: "#" },
            ],
          })
        }
        className="rounded-lg px-2 py-1 text-xs text-brand-700 transition hover:bg-brand-50"
      >
        ＋ เพิ่มการ์ด
      </button>
    </div>
  );
}

/* ---------- ทำเนียบบุคลากร ---------- */

function PeopleFields({
  block,
  folder,
  onChange,
}: {
  block: Extract<Block, { kind: "people" }>;
  folder: string;
  onChange: (next: Block) => void;
}) {
  const setPerson = (i: number, patch: Partial<(typeof block.people)[number]>) =>
    onChange({ ...block, people: block.people.map((p, n) => (n === i ? { ...p, ...patch } : p)) });

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-xs text-gray-500">
        คนต่อแถว
        <select
          value={block.cols}
          onChange={(e) => onChange({ ...block, cols: Number(e.target.value) })}
          className="rounded-lg border border-gray-300 px-2 py-1 text-xs outline-none focus:border-brand-500"
        >
          {[2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>

      {block.people.map((person, i) => (
        <div key={i} className="flex items-start gap-2 rounded-lg bg-gray-50 p-2 ring-1 ring-gray-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={person.src}
            alt=""
            className="h-16 w-16 shrink-0 rounded-lg object-cover ring-1 ring-gray-200"
          />
          <div className="min-w-0 flex-1 space-y-1.5">
            <input
              value={person.name}
              onChange={(e) => setPerson(i, { name: e.target.value })}
              placeholder="ชื่อ-นามสกุล"
              className={input}
            />
            <input
              value={person.role}
              onChange={(e) => setPerson(i, { role: e.target.value })}
              placeholder="ตำแหน่ง"
              className={input}
            />
          </div>
          <button
            type="button"
            onClick={() => onChange({ ...block, people: block.people.filter((_, n) => n !== i) })}
            className="shrink-0 rounded-lg p-2 text-gray-300 transition hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}

      <UploadButton
        label="เพิ่มรูปบุคคล"
        accept="image/*"
        folder={folder}
        maxEdge={600}
        multiple
        onDone={(files) =>
          onChange({
            ...block,
            people: [
              ...block.people,
              ...files.map((f) => ({
                src: f.url,
                name: f.name.replace(/\.[^.]+$/, ""),
                role: "",
              })),
            ],
          })
        }
      />
    </div>
  );
}

/* ---------- แท็ปเมนู ---------- */

function TabsFields({
  block,
  folder,
  onChange,
}: {
  block: Extract<Block, { kind: "tabs" }>;
  folder: string;
  onChange: (next: Block) => void;
}) {
  const [active, setActive] = useState(0);
  const tab = block.tabs[active];

  const setTabs = (tabs: typeof block.tabs) => onChange({ ...block, tabs });

  const setBlocks = (blocks: Block[]) =>
    setTabs(block.tabs.map((t, i) => (i === active ? { ...t, blocks } : t)));

  if (!tab) return null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1">
        {block.tabs.map((t, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setActive(i)}
            className={`rounded-lg px-2.5 py-1 text-xs transition ${
              i === active ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {t.title || `หัวข้อที่ ${i + 1}`}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            setTabs([
              ...block.tabs,
              {
                title: `หัวข้อที่ ${block.tabs.length + 1}`,
                blocks: [{ id: blockId(), kind: "paragraph", html: "" }],
              },
            ]);
            setActive(block.tabs.length);
          }}
          className="rounded-lg px-2 py-1 text-xs text-brand-700 transition hover:bg-brand-50"
        >
          ＋ แท็บ
        </button>
      </div>

      <div className="flex items-center gap-2">
        <input
          value={tab.title}
          onChange={(e) =>
            setTabs(block.tabs.map((t, i) => (i === active ? { ...t, title: e.target.value } : t)))
          }
          placeholder="ชื่อบนปุ่มแท็บ"
          className={input}
        />
        {block.tabs.length > 1 && (
          <button
            type="button"
            onClick={() => {
              setTabs(block.tabs.filter((_, i) => i !== active));
              setActive(0);
            }}
            title="ลบแท็บนี้"
            className="shrink-0 rounded-lg p-2 text-gray-300 transition hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* เนื้อในแท็บก็เป็นก้อนเหมือนกัน — ใช้ตัวแก้ไขตัวเดียวกันซ้อนลงไปอีกชั้น */}
      <div className="rounded-lg ring-1 ring-gray-200">
        <NestedBlocks blocks={tab.blocks} folder={folder} onChange={setBlocks} />
      </div>
    </div>
  );
}

/** รายการก้อนที่อยู่ในแท็บ — ตัดปุ่มเพิ่มก้อนซ้อนชั้นลึกออก เหลือชนิดที่ใช้ในแท็บจริง ๆ */
function NestedBlocks({
  blocks,
  folder,
  onChange,
}: {
  blocks: Block[];
  folder: string;
  onChange: (next: Block[]) => void;
}) {
  const replaceAt = (index: number, block: Block) =>
    onChange(blocks.map((b, i) => (i === index ? block : b)));

  return (
    <div className="space-y-2 bg-gray-50/70 p-2">
      {blocks.map((block, index) => (
        <BlockCard
          key={block.id}
          block={block}
          index={index}
          total={blocks.length}
          folder={folder}
          onChange={(next) => replaceAt(index, next)}
          onMove={(step) => {
            const to = index + step;
            if (to < 0 || to >= blocks.length) return;
            const next = [...blocks];
            [next[index], next[to]] = [next[to], next[index]];
            onChange(next);
          }}
          onDuplicate={() => {
            const copy = JSON.parse(JSON.stringify(blocks[index])) as Block;
            copy.id = blockId();
            onChange([...blocks.slice(0, index + 1), copy, ...blocks.slice(index + 1)]);
          }}
          onRemove={() => onChange(blocks.filter((_, i) => i !== index))}
          onInsertBelow={(kind) =>
            onChange([...blocks.slice(0, index + 1), emptyBlock(kind), ...blocks.slice(index + 1)])
          }
        />
      ))}

      <AddMenu onPick={(kind) => onChange([...blocks, emptyBlock(kind)])} wide />
    </div>
  );
}
