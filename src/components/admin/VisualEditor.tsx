"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronDown,
  ChevronUp,
  Code2,
  Copy,
  FileText,
  FileType2,
  Heading,
  ImagePlus,
  Images,
  LayoutGrid,
  Loader2,
  Minus,
  PanelsTopLeft,
  Pilcrow,
  Plus,
  Quote,
  Table2,
  Trash2,
  UserSquare2,
} from "lucide-react";
import RichText from "@/components/admin/RichText";
import { uploadWithProgress } from "@/lib/uploadClient";
import {
  ADDABLE,
  BLOCK_HINT,
  BLOCK_LABEL,
  type Block,
  type BlockKind,
  type Card,
  type Person,
  blockId,
  blocksToHtml,
  emptyBlock,
  htmlToBlocks,
} from "@/lib/pageBlocks";

/**
 * EditUI — แก้หน้าเว็บบนหน้าเว็บ
 *
 * สิ่งที่เห็นในนี้ **คือหน้าเว็บจริง** ไม่ใช่ฟอร์มที่แทนหน้าเว็บ — ใช้ CSS ชุดเดียวกับที่
 * สมาชิกเห็น (`.prose-page` ใน globals.css) หัวข้อจึงใหญ่เท่าของจริง ตารางมีเส้นเหมือนของจริง
 * การ์ด PDF หน้าตาเหมือนของจริง · จะแก้ตรงไหนก็คลิกที่ตัวหนังสือนั้นแล้วพิมพ์ทับได้เลย
 *
 * ปุ่มจัดการ (เลื่อนขึ้นลง · ทำสำเนา · ลบ) ซ่อนไว้จนกว่าจะเอาเมาส์ชี้ที่ก้อนนั้น
 * ของที่ตั้งค่าด้วยการพิมพ์ไม่ได้ (ขนาดรูป สีการ์ด จำนวนคอลัมน์) โผล่เป็นแถบเล็ก ๆ
 * เมื่อคลิกเลือกก้อนนั้น — ไม่ได้กางทุกช่องค้างไว้ให้รก
 *
 * แก้เนื้อหาก้อนเดียวกับ EditCode สลับไปมาได้ตลอด · ก้อนที่ระบบอ่านไม่ออกยังเก็บไว้ครบ
 * (ดู src/lib/pageBlocks.ts และตัวตรวจ npm run check:blocks)
 */

/** ไอคอนประจำเนื้อหาแต่ละชนิด — คนอ่านช้าจะได้กวาดตาหาเจอโดยไม่ต้องอ่านทุกบรรทัด */
const BLOCK_ICON: Record<BlockKind, typeof Plus> = {
  heading: Heading,
  paragraph: Pilcrow,
  list: FileText,
  quote: Quote,
  divider: Minus,
  image: ImagePlus,
  imageRow: Images,
  table: Table2,
  pdfCard: FileType2,
  pdfIcon: FileType2,
  cards: LayoutGrid,
  people: UserSquare2,
  tabs: PanelsTopLeft,
  html: Code2,
};

type Props = {
  value: string;
  onChange: (next: string) => void;
  /** โฟลเดอร์ปลายทางของรูป/ไฟล์ที่อัปจากในนี้ */
  folder: string;
};

export default function VisualEditor({ value, onChange, folder }: Props) {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [ready, setReady] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  /** HTML ที่เราเพิ่งเขียนออกไปเอง — เจอค่านี้กลับเข้ามาก็ไม่ต้องอ่านใหม่ให้ก้อนกระพริบ */
  const written = useRef<string | null>(null);

  useEffect(() => {
    if (written.current === value) return;
    setBlocks(htmlToBlocks(value));
    written.current = value;
    setReady(true);
  }, [value]);

  const commit = (next: Block[]) => {
    setBlocks(next);
    const html = blocksToHtml(next);
    written.current = html;
    onChange(html);
  };

  if (!ready) {
    return (
      <p className="flex items-center gap-2 p-8 text-sm text-gray-400">
        <Loader2 className="h-4 w-4 animate-spin" /> กำลังเปิดหน้าเว็บ…
      </p>
    );
  }

  return (
    <div className="bg-gray-100 p-4 sm:p-6">
      {/* กระดาษหน้าเว็บ — กว้างเท่าของจริงและใช้สไตล์ชุดเดียวกัน */}
      <div className="mx-auto max-w-3xl rounded-xl bg-white p-6 shadow-sm sm:p-10">
        <BlockList
          blocks={blocks}
          folder={folder}
          picked={picked}
          onPick={setPicked}
          onChange={commit}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * รายการก้อน — ใช้ซ้ำได้ทั้งหน้าหลักและเนื้อในแท็ปเมนู
 * ------------------------------------------------------------------ */

function BlockList({
  blocks,
  folder,
  picked,
  onPick,
  onChange,
  nested = false,
}: {
  blocks: Block[];
  folder: string;
  picked: string | null;
  onPick: (id: string | null) => void;
  onChange: (next: Block[]) => void;
  nested?: boolean;
}) {
  const replaceAt = (i: number, block: Block) =>
    onChange(blocks.map((b, n) => (n === i ? block : b)));

  const insertAt = (i: number, kind: BlockKind) => {
    const block = emptyBlock(kind);
    onChange([...blocks.slice(0, i), block, ...blocks.slice(i)]);
    onPick(block.id);
  };

  const move = (i: number, step: -1 | 1) => {
    const to = i + step;
    if (to < 0 || to >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[to]] = [next[to], next[i]];
    onChange(next);
  };

  const duplicate = (i: number) => {
    const copy = JSON.parse(JSON.stringify(blocks[i])) as Block;
    copy.id = blockId();
    onChange([...blocks.slice(0, i + 1), copy, ...blocks.slice(i + 1)]);
  };

  return (
    <div className={`prose-page prose-edit ${nested ? "" : "min-h-[50vh]"}`}>
      <InsertLine onPick={(kind) => insertAt(0, kind)} first />

      {blocks.length === 0 && (
        <p className="edit-hint">
          หน้านี้ยังไม่มีเนื้อหา
          <span>กดปุ่ม “เพิ่มเนื้อหา” ด้านล่างเพื่อเริ่ม</span>
        </p>
      )}

      {blocks.map((block, i) => (
        <div key={block.id} data-block className="edit-block">
          <div
            className={`edit-frame ${picked === block.id ? "is-picked" : ""}`}
            onMouseDown={() => onPick(block.id)}
          >
            <BlockView
              block={block}
              folder={folder}
              picked={picked === block.id}
              onChange={(next) => replaceAt(i, next)}
              onPick={onPick}
            />
          </div>

          {/*
            แถบเครื่องมือของเนื้อหาชิ้นนี้ — โผล่ตอนเอาเมาส์ชี้ "หรือตอนคลิกเลือก"
            เพราะคนที่ไม่ชินคอมพิวเตอร์จะไม่รู้ว่าต้องเอาเมาส์ไปชี้ถึงจะมีปุ่ม
            พอคลิกที่เนื้อหาแล้วปุ่มค้างไว้ ก็หาเจอแน่นอน
          */}
          <div className={`edit-tools ${picked === block.id ? "is-open" : ""}`}>
            <span className="edit-kind">
              {(() => {
                const Icon = BLOCK_ICON[block.kind];
                return <Icon className="h-3 w-3" />;
              })()}
              {BLOCK_LABEL[block.kind]}
            </span>
            <Tool icon={ChevronUp} title="ย้ายขึ้นข้างบน" disabled={i === 0} onClick={() => move(i, -1)} />
            <Tool
              icon={ChevronDown}
              title="ย้ายลงข้างล่าง"
              disabled={i === blocks.length - 1}
              onClick={() => move(i, 1)}
            />
            <Tool icon={Copy} title="คัดลอกอีกชุด" onClick={() => duplicate(i)} />
            <Tool
              icon={Trash2}
              title="ลบทิ้ง"
              danger
              onClick={() => {
                if (confirm(`ลบ “${BLOCK_LABEL[block.kind]}” นี้ออกจากหน้าเว็บ?`))
                  onChange(blocks.filter((_, n) => n !== i));
              }}
            />
          </div>

          <InsertLine onPick={(kind) => insertAt(i + 1, kind)} />
        </div>
      ))}

      {/*
        ปุ่มก้อนใหญ่ที่เห็นตลอดเวลา — เส้น ＋ ระหว่างเนื้อหาโผล่เฉพาะตอนเอาเมาส์ชี้
        ซึ่งคนที่ไม่ชินคอมพิวเตอร์จะหาไม่เจอ ต้องมีทางที่มองเห็นได้เสมออย่างน้อยหนึ่งทาง
      */}
      <div className="edit-add-end">
        <InsertLine onPick={(kind) => insertAt(blocks.length, kind)} big />
      </div>
    </div>
  );
}

function Tool({
  icon: Icon,
  title,
  onClick,
  disabled = false,
  danger = false,
}: {
  icon: typeof Copy;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`rounded p-1 transition disabled:opacity-25 ${
        danger ? "hover:bg-red-500 hover:text-white" : "hover:bg-white/15"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

/* ------------------------------------------------------------------ *
 * เส้นแทรกก้อนใหม่ — เส้นบาง ๆ ระหว่างก้อน กดแล้วเลือกว่าจะใส่อะไร
 * ------------------------------------------------------------------ */

/** ความกว้าง/สูงของเมนูเลือกชนิดเนื้อหา (px) — ต้องตรงกับ .edit-insert-menu ใน globals.css */
const MENU_W = 336;
const MENU_MAX_H = 384;

function InsertLine({
  onPick,
  first = false,
  big = false,
}: {
  onPick: (kind: BlockKind) => void;
  first?: boolean;
  /** true = ปุ่มก้อนใหญ่ที่เห็นตลอด (ท้ายหน้า) · false = เส้นบาง ๆ ที่โผล่ตอนชี้ (ระหว่างเนื้อหา) */
  big?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  /** ตำแหน่งจริงบนจอของเมนู — คิดตอนกดเปิด (ดูเหตุผลที่ต้องทำแบบนี้ด้านล่าง) */
  const [spot, setSpot] = useState<{ left: number; top: number; height: number } | null>(null);

  /*
    ⚠️ เมนูนี้ต้องลอยอยู่นอกการ์ด ไม่งั้นโดนตัดหาย

    การ์ดแต่ละส่วนในหน้าแก้ไขใช้ `overflow-hidden` เพื่อให้มุมมนไม่มีอะไรล้นออกมา
    เมนูที่วางแบบ absolute อยู่ข้างในจึงถูกตัดตามขอบการ์ด — ปุ่ม "เพิ่มเนื้อหา"
    อยู่ล่างสุดของการ์ดพอดี เมนูเลยโผล่มาแค่สองสามบรรทัดแล้วโดนตัด
    (เจ้าของเว็บเจอเอง 24 ส.ค. 2026)

    แก้ด้วยการยกเมนูไปแขวนที่ <body> แล้ววางด้วยพิกัดจริงของปุ่ม —
    ไม่มีการ์ดไหนมาตัดได้อีก · ที่ไม่พอด้านล่างก็พลิกขึ้นไปข้างบนปุ่มแทน
  */
  const place = () => {
    const r = button.current?.getBoundingClientRect();
    if (!r) return;

    const below = window.innerHeight - r.bottom - 12;
    const above = r.top - 12;
    const down = below >= Math.min(MENU_MAX_H, above);
    const height = Math.min(MENU_MAX_H, Math.max(below, above));

    setSpot({
      // กันเมนูล้นขอบซ้าย/ขวาของจอ (จอแคบหรือปุ่มอยู่ริม)
      left: Math.max(8, Math.min(window.innerWidth - MENU_W - 8, r.left + r.width / 2 - MENU_W / 2)),
      top: down ? r.bottom + 8 : Math.max(8, r.top - 8 - height),
      height,
    });
    setOpen(true);
  };

  // เลื่อนหน้าจอตอนเมนูเปิดอยู่ = เมนูจะลอยค้างผิดที่ (มันอิงพิกัดจอ) — ปิดไปเลย
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  return (
    <div className={`edit-insert ${first ? "is-first" : ""} ${big ? "is-big" : ""}`}>
      <button
        ref={button}
        type="button"
        onClick={() => (open ? setOpen(false) : place())}
        className="edit-insert-button"
      >
        <Plus className={big ? "h-4 w-4" : "h-3.5 w-3.5"} />
        <span>{big ? "เพิ่มเนื้อหา" : "เพิ่มเนื้อหาตรงนี้"}</span>
      </button>

      {open && spot && createPortal(
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} />
          <div
            className="edit-insert-menu"
            style={{
              position: "fixed",
              left: spot.left,
              top: spot.top,
              maxHeight: spot.height,
              transform: "none",
              zIndex: 61,
            }}
          >
            <p className="edit-menu-head">เลือกสิ่งที่จะใส่ตรงนี้</p>
            {ADDABLE.map((kind) => {
              const Icon = BLOCK_ICON[kind];
              return (
                <button
                  key={kind}
                  type="button"
                  onClick={() => {
                    onPick(kind);
                    setOpen(false);
                  }}
                >
                  <Icon className="edit-menu-icon" />
                  <span>
                    <b>{BLOCK_LABEL[kind]}</b>
                    <i>{BLOCK_HINT[kind]}</i>
                  </span>
                </button>
              );
            })}
          </div>
        </>,
        document.body,
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * แถบตั้งค่าของก้อนที่เลือก — เฉพาะของที่พิมพ์เป็นข้อความไม่ได้
 * ------------------------------------------------------------------ */

function Options({ children }: { children: React.ReactNode }) {
  return <div className="edit-options">{children}</div>;
}

function Choice({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={active ? "is-on" : ""}
    >
      {label}
    </button>
  );
}

/* ------------------------------------------------------------------ *
 * อัปไฟล์
 * ------------------------------------------------------------------ */

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
    <>
      <label className={`edit-upload ${busy ? "is-busy" : ""}`}>
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
            // อัปทีละไฟล์ ไม่ยิงพร้อมกัน — ปลายทางรับทีละไฟล์อยู่แล้ว
            for (const file of files) {
              setPercent(0);
              const form = new FormData();
              form.append("file", file);
              form.append("folder", folder);
              if (maxEdge !== null) form.append("maxEdge", String(maxEdge));

              const result = await uploadWithProgress<{ url: string }>(
                "/api/admin/upload/",
                form,
                (p) => setPercent(p),
              );
              if (!result.ok) {
                setError(`อัป ${file.name} ไม่สำเร็จ`);
                break;
              }
              done.push({ url: result.data.url, name: file.name });
            }
            setBusy(false);
            if (done.length > 0) onDone(done);
          }}
        />
      </label>
      {error && <span className="edit-error">{error}</span>}
    </>
  );
}

/* ------------------------------------------------------------------ *
 * ก้อนแต่ละชนิด — วาดด้วยแท็กจริงของหน้าเว็บ
 * ------------------------------------------------------------------ */

/*
 * คำบรรยายใต้ภาพเก็บเป็น HTML (ใส่ตัวหนา/ลิงก์ได้) แต่ช่องกรอกในแถบเครื่องมือ
 * เป็นข้อความล้วน — สองตัวนี้แปลงกลับไปมาให้ตรงกัน
 *
 * ที่ต้องมีช่องกรอกด้วยทั้งที่คลิกพิมพ์ทับที่ใต้รูปได้อยู่แล้ว เพราะคำบรรยายเป็น
 * ตัวหนังสือเล็ก ๆ ใต้รูป คนใหม่มองไม่ออกว่ากดพิมพ์ได้ แล้วไปพิมพ์ผิดช่อง
 * (เจ้าของเว็บติดตรงนี้เอง 24 ส.ค. 2026 — สับสนกับช่อง "ข้อความแทนรูป")
 */
const toText = (html: string) =>
  html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");

const toHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** คำบรรยายที่ใส่ตัวหนา/ลิงก์ไว้ — แก้ผ่านช่องกรอกจะทำให้รูปแบบหาย ต้องพิมพ์ที่ใต้รูปแทน */
const isRichCaption = (html: string) => /<[a-z]/i.test(html);

const IMAGE_LAYOUTS = [
  { key: "", label: "เต็มความกว้าง" },
  { key: "small", label: "เล็ก" },
  { key: "left", label: "ชิดซ้าย" },
  { key: "right", label: "ชิดขวา" },
] as const;

const CARD_COLORS = ["blue", "green", "amber", "pink", "purple", "teal"];
const ICON_COLORS = [
  { key: "", label: "แดง" },
  { key: "blue", label: "ฟ้า" },
  { key: "green", label: "เขียว" },
  { key: "amber", label: "ส้ม" },
  { key: "purple", label: "ม่วง" },
  { key: "gray", label: "เทา" },
];

function BlockView({
  block,
  folder,
  picked,
  onChange,
  onPick,
}: {
  block: Block;
  folder: string;
  picked: boolean;
  onChange: (next: Block) => void;
  onPick: (id: string | null) => void;
}) {
  switch (block.kind) {
    case "heading":
      return (
        <>
          <RichText
            singleLine
            as={`h${block.level}` as "h2" | "h3" | "h4"}
            value={block.html}
            onChange={(html) => onChange({ ...block, html })}
            placeholder="พิมพ์หัวข้อ"
          />
          {picked && (
            <Options>
              <span>ขนาดตัวหนังสือ</span>
              {([2, 3, 4] as const).map((level) => (
                <Choice
                  key={level}
                  label={level === 2 ? "ใหญ่" : level === 3 ? "กลาง" : "เล็ก"}
                  active={block.level === level}
                  onClick={() => onChange({ ...block, level })}
                />
              ))}
            </Options>
          )}
        </>
      );

    case "paragraph":
      return (
        <RichText
          as="p"
          value={block.html}
          onChange={(html) => onChange({ ...block, html })}
          placeholder="พิมพ์ข้อความที่นี่"
        />
      );

    case "quote":
      return (
        <RichText
          as="blockquote"
          value={block.html}
          onChange={(html) => onChange({ ...block, html })}
          placeholder="ข้อความที่ยกมา"
        />
      );

    case "divider":
      return <hr />;

    case "list":
      return <ListView block={block} picked={picked} onChange={onChange} />;

    case "image":
      return (
        <>
          <figure className={block.layout || undefined}>
            {block.src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={block.src} alt={block.alt} />
            ) : (
              <span className="edit-placeholder">
                <ImagePlus className="h-6 w-6" /> ยังไม่ได้เลือกรูป
              </span>
            )}
            <RichText
              as="figcaption"
              singleLine
              value={block.caption}
              onChange={(caption) => onChange({ ...block, caption })}
              placeholder="คลิกตรงนี้เพื่อใส่คำบรรยายใต้ภาพ (เว้นว่างได้)"
            />
          </figure>
          {picked && (
            <Options>
              <UploadButton
                label={block.src ? "เปลี่ยนรูป" : "เลือกรูป"}
                accept="image/*"
                folder={folder}
                // ⚠️ 600 คือเพดานของทั้งเว็บ ห้ามขยับขึ้น — เจ้าของเว็บสั่งไว้ว่าอะไรที่
                // เกี่ยวกับรูป/ไฟล์ต้องจำกัดขนาดไม่ให้ใหญ่เกินจำเป็น (ย้ำอีกครั้ง 24 ส.ค. 2026)
                // ความ "ขนาดไม่เท่ากัน" แก้ที่กรอบแสดงผลใน globals.css แทน ไม่ใช่ที่ขนาดไฟล์
                maxEdge={600}
                onDone={([f]) =>
                  onChange({
                    ...block,
                    src: f.url,
                    alt: block.alt || f.name.replace(/\.[^.]+$/, ""),
                  })
                }
              />
              <span>ขนาดและตำแหน่งรูป</span>
              {IMAGE_LAYOUTS.map((l) => (
                <Choice
                  key={l.key}
                  label={l.label}
                  active={block.layout === l.key}
                  onClick={() => onChange({ ...block, layout: l.key })}
                />
              ))}
              {/* คำบรรยายใต้ภาพ — ตัวที่คนอ่านเห็นจริง อยู่ก่อนเสมอ */}
              {isRichCaption(block.caption) ? (
                <span>คำบรรยายใต้ภาพ: มีตัวหนา/ลิงก์อยู่ — พิมพ์แก้ที่ข้อความใต้รูปได้เลย</span>
              ) : (
                <label className="edit-field">
                  คำบรรยายใต้ภาพ (คนอ่านเห็น)
                  <input
                    value={toText(block.caption)}
                    onChange={(e) => onChange({ ...block, caption: toHtml(e.target.value) })}
                    placeholder="เช่น โซล่าเซลล์ ดาดฟ้า"
                  />
                </label>
              )}
              <label className="edit-field">
                ข้อความแทนรูป (สำหรับคนตาบอด)
                <input
                  value={block.alt}
                  onChange={(e) => onChange({ ...block, alt: e.target.value })}
                  placeholder="เช่น ภาพหมู่คณะกรรมการ"
                />
              </label>
            </Options>
          )}
        </>
      );

    case "imageRow":
      return (
        <>
          <div className="image-row">
            {block.images.map((img, i) => (
              <figure key={i} className="edit-removable">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.src} alt={img.alt} />
                <button
                  type="button"
                  title="เอารูปนี้ออก"
                  onClick={() =>
                    onChange({ ...block, images: block.images.filter((_, n) => n !== i) })
                  }
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </figure>
            ))}
            {block.images.length === 0 && (
              <span className="edit-placeholder">ยังไม่มีรูปในแถวนี้ — กด “เพิ่มรูปในแถว” ด้านล่าง</span>
            )}
          </div>
          {picked && (
            <Options>
              <UploadButton
                label="เพิ่มรูปในแถว"
                accept="image/*"
                folder={folder}
                // ⚠️ 600 คือเพดานของทั้งเว็บ ห้ามขยับขึ้น — เจ้าของเว็บสั่งไว้ว่าอะไรที่
                // เกี่ยวกับรูป/ไฟล์ต้องจำกัดขนาดไม่ให้ใหญ่เกินจำเป็น (ย้ำอีกครั้ง 24 ส.ค. 2026)
                // ความ "ขนาดไม่เท่ากัน" แก้ที่กรอบแสดงผลใน globals.css แทน ไม่ใช่ที่ขนาดไฟล์
                maxEdge={600}
                multiple
                onDone={(files) =>
                  onChange({
                    ...block,
                    images: [
                      ...block.images,
                      ...files.map((f) => ({ src: f.url, alt: f.name.replace(/\.[^.]+$/, "") })),
                    ],
                  })
                }
              />
            </Options>
          )}
        </>
      );

    case "table":
      return <TableView block={block} picked={picked} onChange={onChange} />;

    case "pdfCard":
      return (
        <>
          <div className="ebook">
            <span className="ebook-name">{block.name || "ยังไม่ได้เลือกไฟล์ PDF"}</span>
            {block.readHref && <a href={block.readHref}>เปิดอ่านแบบ E-Book</a>}
            {block.fileHref && <a href={block.fileHref}>ดาวน์โหลด PDF</a>}
          </div>
          {picked && (
            <Options>
              <UploadButton
                label={block.fileHref ? "เปลี่ยนไฟล์ PDF" : "เลือกไฟล์ PDF"}
                accept="application/pdf"
                folder={folder}
                maxEdge={null}
                onDone={([f]) =>
                  onChange({
                    ...block,
                    name: f.name,
                    fileHref: f.url,
                    readHref: `/read/?src=${encodeURIComponent(f.url)}&title=${encodeURIComponent(f.name)}`,
                  })
                }
              />
              <label className="edit-field">
                ชื่อไฟล์ที่คนอ่านจะเห็น
                <input
                  value={block.name}
                  onChange={(e) => onChange({ ...block, name: e.target.value })}
                  placeholder="เช่น ประกาศที่ 20-2569.pdf"
                />
              </label>
            </Options>
          )}
        </>
      );

    case "pdfIcon":
      return (
        <>
          <a
            className={`pdf-icon${block.read ? " read" : ""}${block.color ? ` ${block.color}` : ""}`}
            style={{ ["--pdf-size" as string]: `${block.size}px` }}
            title={block.label}
            onClick={(e) => e.preventDefault()}
          />
          {picked && (
            <Options>
              <span>กดไอคอนแล้ว</span>
              <Choice
                label="เปิดอ่านในเว็บ"
                active={block.read}
                onClick={() => onChange({ ...block, read: true })}
              />
              <Choice
                label="โหลดไฟล์"
                active={!block.read}
                onClick={() => onChange({ ...block, read: false })}
              />
              <span>สีไอคอน</span>
              {ICON_COLORS.map((c) => (
                <Choice
                  key={c.key}
                  label={c.label}
                  active={block.color === c.key}
                  onClick={() => onChange({ ...block, color: c.key })}
                />
              ))}
              <label className="edit-field">
                ขนาดไอคอน (จุด)
                <input
                  type="number"
                  min={20}
                  max={200}
                  value={block.size}
                  onChange={(e) => onChange({ ...block, size: Number(e.target.value) || 50 })}
                />
              </label>
            </Options>
          )}
        </>
      );

    case "cards":
      return <CardsView block={block} picked={picked} onChange={onChange} />;

    case "people":
      return <PeopleView block={block} picked={picked} folder={folder} onChange={onChange} />;

    case "tabs":
      return <TabsView block={block} folder={folder} onChange={onChange} onPick={onPick} />;

    case "html":
      return <HtmlView block={block} picked={picked} onChange={onChange} />;
  }
}

/* ---------- รายการ ---------- */

function ListView({
  block,
  picked,
  onChange,
}: {
  block: Extract<Block, { kind: "list" }>;
  picked: boolean;
  onChange: (next: Block) => void;
}) {
  const Tag = block.ordered ? "ol" : "ul";

  return (
    <>
      <Tag>
        {block.items.map((item, i) => (
          <RichText
            key={i}
            as="li"
            singleLine
            value={item}
            onChange={(html) =>
              onChange({ ...block, items: block.items.map((v, n) => (n === i ? html : v)) })
            }
            placeholder={`ข้อ ${i + 1}`}
          />
        ))}
      </Tag>
      {picked && (
        <Options>
          <span>ขึ้นต้นแต่ละข้อด้วย</span>
          <Choice
            label="จุดนำหน้า"
            active={!block.ordered}
            onClick={() => onChange({ ...block, ordered: false })}
          />
          <Choice
            label="เลข 1. 2. 3."
            active={block.ordered}
            onClick={() => onChange({ ...block, ordered: true })}
          />
          <button type="button" onClick={() => onChange({ ...block, items: [...block.items, ""] })}>
            ＋ เพิ่มอีกข้อ
          </button>
          {block.items.length > 1 && (
            <button type="button" onClick={() => onChange({ ...block, items: block.items.slice(0, -1) })}>
              ลบข้อล่างสุด
            </button>
          )}
        </Options>
      )}
    </>
  );
}

/* ---------- ตาราง ---------- */

function TableView({
  block,
  picked,
  onChange,
}: {
  block: Extract<Block, { kind: "table" }>;
  picked: boolean;
  onChange: (next: Block) => void;
}) {
  const cols = Math.max(block.head.length, ...block.rows.map((r) => r.length), 1);
  /** ทำให้ทุกแถวยาวเท่ากันเสมอ — แถวสั้นกว่าคนอื่นทำให้ตารางบนหน้าเว็บเบี้ยว */
  const pad = (row: string[]) => Array.from({ length: cols }, (_, i) => row[i] ?? "");

  return (
    <>
      <div className="table-scroll">
        <table>
          {block.head.length > 0 && (
            <thead>
              <tr>
                {pad(block.head).map((cell, c) => (
                  <RichText
                    key={c}
                    as="th"
                    singleLine
                    value={cell}
                    onChange={(html) =>
                      onChange({
                        ...block,
                        head: pad(block.head).map((v, i) => (i === c ? html : v)),
                      })
                    }
                    placeholder={`ชื่อคอลัมน์ ${c + 1}`}
                  />
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {block.rows.map((row, r) => (
              <tr key={r}>
                {pad(row).map((cell, c) => (
                  <RichText
                    key={c}
                    as="td"
                    value={cell}
                    onChange={(html) =>
                      onChange({
                        ...block,
                        rows: block.rows.map((v, i) =>
                          i === r ? pad(v).map((x, n) => (n === c ? html : x)) : pad(v),
                        ),
                      })
                    }
                    placeholder="…"
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {picked && (
        <Options>
          <button
            type="button"
            onClick={() => onChange({ ...block, rows: [...block.rows, Array(cols).fill("")] })}
          >
            ＋ เพิ่มแถว (บรรทัดล่าง)
          </button>
          <button
            type="button"
            onClick={() =>
              onChange({
                ...block,
                head: [...pad(block.head), `ชื่อคอลัมน์ ${cols + 1}`],
                rows: block.rows.map((r) => [...pad(r), ""]),
              })
            }
          >
            ＋ เพิ่มคอลัมน์ (ช่องขวา)
          </button>
          {block.rows.length > 1 && (
            <button type="button" onClick={() => onChange({ ...block, rows: block.rows.slice(0, -1) })}>
              ลบแถวล่างสุด
            </button>
          )}
          {cols > 1 && (
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...block,
                  head: pad(block.head).slice(0, -1),
                  rows: block.rows.map((r) => pad(r).slice(0, -1)),
                })
              }
            >
              ลบคอลัมน์ขวาสุด
            </button>
          )}
        </Options>
      )}
    </>
  );
}

/* ---------- การ์ดลิงก์ ---------- */

function CardsView({
  block,
  picked,
  onChange,
}: {
  block: Extract<Block, { kind: "cards" }>;
  picked: boolean;
  onChange: (next: Block) => void;
}) {
  const [openCard, setOpenCard] = useState<number | null>(null);
  const set = (i: number, patch: Partial<Card>) =>
    onChange({ ...block, cards: block.cards.map((c, n) => (n === i ? { ...c, ...patch } : c)) });

  return (
    <>
      <div className={`cards cols-${block.cols}`}>
        {block.cards.map((card, i) => (
          <span key={i} className={`card ${card.color} edit-removable`}>
            <RichText
              as="span"
              singleLine
              className="card-badge"
              value={card.badge}
              onChange={(badge) => set(i, { badge })}
              placeholder="อักษรย่อ"
            />
            <span className="card-text">
              <RichText
                as="span"
                singleLine
                className="card-title"
                value={card.title}
                onChange={(title) => set(i, { title })}
                placeholder="ชื่อหัวข้อ"
              />
              <RichText
                as="span"
                singleLine
                className="card-sub"
                value={card.sub}
                onChange={(sub) => set(i, { sub })}
                placeholder="คำอธิบายสั้น ๆ"
              />
            </span>
            <button
              type="button"
              title="ลบการ์ดใบนี้"
              onClick={() => onChange({ ...block, cards: block.cards.filter((_, n) => n !== i) })}
            >
              <Trash2 className="h-3 w-3" />
            </button>
            <button
              type="button"
              className="edit-card-link"
              title="ตั้งว่ากดแล้วไปหน้าไหน และเลือกสี"
              onClick={() => setOpenCard(openCard === i ? null : i)}
            >
              {card.href || "ยังไม่ได้ตั้งว่ากดแล้วไปไหน"}
            </button>
          </span>
        ))}
      </div>

      {openCard !== null && block.cards[openCard] && (
        <Options>
          <label className="edit-field">
            กดการ์ดใบที่ {openCard + 1} แล้วไปที่
            <input
              value={block.cards[openCard].href}
              onChange={(e) => set(openCard, { href: e.target.value })}
              placeholder="เช่น /downloads/doc-loan"
            />
          </label>
          <span>สีของการ์ด</span>
          {CARD_COLORS.map((c) => (
            <Choice
              key={c}
              label={c}
              active={block.cards[openCard].color === c}
              onClick={() => set(openCard, { color: c })}
            />
          ))}
        </Options>
      )}

      {picked && (
        <Options>
          <span>จำนวนการ์ดต่อแถว</span>
          {[2, 3, 4].map((n) => (
            <Choice
              key={n}
              label={String(n)}
              active={block.cols === n}
              onClick={() => onChange({ ...block, cols: n })}
            />
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
          >
            ＋ เพิ่มการ์ด
          </button>
        </Options>
      )}
    </>
  );
}

/* ---------- ทำเนียบบุคลากร ---------- */

function PeopleView({
  block,
  picked,
  folder,
  onChange,
}: {
  block: Extract<Block, { kind: "people" }>;
  picked: boolean;
  folder: string;
  onChange: (next: Block) => void;
}) {
  const set = (i: number, patch: Partial<Person>) =>
    onChange({ ...block, people: block.people.map((p, n) => (n === i ? { ...p, ...patch } : p)) });

  return (
    <>
      <div className={`people cols-${block.cols}`}>
        {block.people.map((person, i) => (
          <figure key={i} className="person edit-removable">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={person.src} alt={person.name} />
            <figcaption>
              <RichText
                as="span"
                singleLine
                className="person-name"
                value={person.name}
                onChange={(name) => set(i, { name })}
                placeholder="ชื่อ-นามสกุล"
              />
              <RichText
                as="span"
                singleLine
                className="person-role"
                value={person.role}
                onChange={(role) => set(i, { role })}
                placeholder="ตำแหน่ง"
              />
            </figcaption>
            <button
              type="button"
              title="เอาคนนี้ออกจากทำเนียบ"
              onClick={() => onChange({ ...block, people: block.people.filter((_, n) => n !== i) })}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </figure>
        ))}
        {block.people.length === 0 && <span className="edit-placeholder">ยังไม่มีรายชื่อ — กด “เพิ่มรูปบุคคล” ด้านล่าง</span>}
      </div>

      {picked && (
        <Options>
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
          <span>จำนวนคนต่อแถว</span>
          {[2, 3, 4, 5].map((n) => (
            <Choice
              key={n}
              label={String(n)}
              active={block.cols === n}
              onClick={() => onChange({ ...block, cols: n })}
            />
          ))}
        </Options>
      )}
    </>
  );
}

/* ---------- แท็ปเมนู ---------- */

function TabsView({
  block,
  folder,
  onChange,
  onPick,
}: {
  block: Extract<Block, { kind: "tabs" }>;
  folder: string;
  onChange: (next: Block) => void;
  onPick: (id: string | null) => void;
}) {
  const [active, setActive] = useState(0);
  const [inner, setInner] = useState<string | null>(null);
  const tab = block.tabs[Math.min(active, block.tabs.length - 1)];
  if (!tab) return null;
  const at = Math.min(active, block.tabs.length - 1);

  const setTabs = (tabs: typeof block.tabs) => onChange({ ...block, tabs });

  return (
    <div className="tabs">
      {/* ปุ่มแท็บหน้าตาเดียวกับบนหน้าเว็บจริง กดสลับดูได้เลย */}
      <div className="tab-buttons" role="tablist">
        {block.tabs.map((t, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            className="tab-button"
            aria-selected={i === at}
            onClick={() => setActive(i)}
          >
            {t.title || `หัวเรื่องที่ ${i + 1}`}
          </button>
        ))}
        <button
          type="button"
          className="edit-tab-add"
          title="เพิ่มหัวเรื่องใหม่"
          onClick={() => {
            setTabs([
              ...block.tabs,
              {
                title: `หัวเรื่องที่ ${block.tabs.length + 1}`,
                blocks: [{ id: blockId(), kind: "paragraph", html: "" }],
              },
            ]);
            setActive(block.tabs.length);
          }}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      <Options>
        <label className="edit-field">
          ชื่อบนปุ่มของหัวเรื่องนี้
          <input
            value={tab.title}
            onChange={(e) =>
              setTabs(block.tabs.map((t, i) => (i === at ? { ...t, title: e.target.value } : t)))
            }
          />
        </label>
        {block.tabs.length > 1 && (
          <button
            type="button"
            onClick={() => {
              setTabs(block.tabs.filter((_, i) => i !== at));
              setActive(0);
            }}
          >
            ลบหัวเรื่องนี้ทั้งชุด
          </button>
        )}
      </Options>

      <div className="tab is-ready">
        <BlockList
          nested
          blocks={tab.blocks}
          folder={folder}
          picked={inner}
          onPick={(id) => {
            setInner(id);
            // เลือกก้อนข้างในแล้ว อย่าให้ก้อน "แท็ปเมนู" ข้างนอกถือว่าถูกเลือกด้วย
            onPick(null);
          }}
          onChange={(blocks) => setTabs(block.tabs.map((t, i) => (i === at ? { ...t, blocks } : t)))}
        />
      </div>
    </div>
  );
}

/* ---------- ก้อนที่ระบบอ่านไม่ออก ---------- */

function HtmlView({
  block,
  picked,
  onChange,
}: {
  block: Extract<Block, { kind: "html" }>;
  picked: boolean;
  onChange: (next: Block) => void;
}) {
  const [asCode, setAsCode] = useState(false);

  return (
    <>
      {asCode ? (
        <textarea
          value={block.html}
          onChange={(e) => onChange({ ...block, html: e.target.value })}
          rows={5}
          className="edit-code"
        />
      ) : (
        // แสดงผลจริงของก้อนนี้ — เนื้อหามาจากฐานของเว็บนี้เอง ผ่านตัวกรองตอนบันทึกแล้ว
        <div dangerouslySetInnerHTML={{ __html: block.html }} />
      )}

      {picked && (
        <Options>
          <span>ส่วนนี้ระบบแปลงเป็นช่องกรอกให้ไม่ได้ — ไม่แน่ใจอย่าแก้</span>
          <button type="button" onClick={() => setAsCode((v) => !v)}>
            <Code2 className="mr-1 inline h-3.5 w-3.5" />
            {asCode ? "ดูผลลัพธ์" : "แก้เป็นโค้ด"}
          </button>
        </Options>
      )}
    </>
  );
}
