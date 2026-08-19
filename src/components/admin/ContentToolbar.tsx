"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import {
  Bold,
  ChevronDown,
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
  FileText,
  PanelsTopLeft,
  LayoutGrid,
  UserSquare2,
  Tag,
  Users,
  WandSparkles,
} from "lucide-react";
import UploadProgress from "@/components/admin/UploadProgress";
import { uploadWithProgress, type UploadPhase } from "@/lib/uploadClient";
import { findBlocks, type HtmlBlock } from "@/lib/htmlBlocks";
import { parsePersonFile, sortByFileOrder } from "@/lib/personName";
import { tidyPeopleHtml } from "@/lib/peopleHtml";
import { prettyHtml } from "@/lib/prettyHtml";
import { repairStructure } from "@/lib/htmlStructure";

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

/** แท็บที่เจอในเนื้อหา — insertAt คือตำแหน่งก่อน </div> ปิดแท็บนั้น */
type TabSlot = { title: string; insertAt: number };

/**
 * ไล่หาแท็บทั้งหมดในเนื้อหา เพื่อให้เลือกได้ว่าจะแทรกของลงแท็บไหน
 *
 * ต้องนับ <div> ซ้อนเองทีละตัว หา </div> ที่คู่กันจริง ๆ ไม่ใช่ตัวแรกที่เจอ —
 * ในแท็บมี <figure> หรือ <div class="image-row"> ซ้อนอยู่ได้ ถ้าจับผิดตัว
 * ของที่แทรกจะไปโผล่กลางแท็บแล้วโครงพัง
 *
 * class="tab" กับ class="tabs" ไม่ชนกันเพราะ \b บังคับให้จบคำพอดี
 */
function findTabs(html: string): TabSlot[] {
  const slots: TabSlot[] = [];
  const opening = /<div\b[^>]*\bclass="[^"]*\btab\b[^"]*"[^>]*>/gi;
  const anyDiv = /<div\b[^>]*>|<\/div>/gi;

  let match: RegExpExecArray | null;
  while ((match = opening.exec(html)) !== null) {
    const title = /data-title="([^"]*)"/i.exec(match[0])?.[1] ?? `แท็บที่ ${slots.length + 1}`;

    let depth = 1;
    anyDiv.lastIndex = match.index + match[0].length;
    let inner: RegExpExecArray | null;
    while ((inner = anyDiv.exec(html)) !== null) {
      depth += inner[0] === "</div>" ? -1 : 1;
      if (depth === 0) {
        slots.push({ title, insertAt: inner.index });
        break;
      }
    }
  }
  return slots;
}

type Tool = { group: "text" | "block" } & (
  | { icon: typeof Bold; title: string; kind: "wrap"; before: string; after: string; sample: string }
  | { icon: typeof Bold; title: string; kind: "block"; block: string }
);

/** ปุ่มบนแถบเครื่องมือ — เก็บเป็นข้อมูลล้วน ไม่ผูกกับ state ของคอมโพเนนต์ */
const TOOLS: Tool[] = [
  { icon: Heading2, group: "text", title: "หัวข้อใหญ่", kind: "wrap", before: "<h2>", after: "</h2>", sample: "หัวข้อใหญ่" },
  { icon: Heading3, group: "text", title: "หัวข้อย่อย", kind: "wrap", before: "<h3>", after: "</h3>", sample: "หัวข้อย่อย" },
  { icon: Bold, group: "text", title: "ตัวหนา", kind: "wrap", before: "<strong>", after: "</strong>", sample: "ข้อความ" },
  { icon: Italic, group: "text", title: "ตัวเอียง", kind: "wrap", before: "<em>", after: "</em>", sample: "ข้อความ" },
  {
    icon: Link2,
    group: "text",
    title: "ลิงก์",
    kind: "wrap",
    before: '<a href="https://">',
    after: "</a>",
    sample: "ข้อความลิงก์",
  },
  {
    icon: List,
    group: "text",
    title: "รายการแบบจุด",
    kind: "block",
    block: "<ul>\n  <li>รายการที่ 1</li>\n  <li>รายการที่ 2</li>\n</ul>",
  },
  {
    icon: ListOrdered,
    group: "text",
    title: "รายการแบบตัวเลข",
    kind: "block",
    block: "<ol>\n  <li>ข้อที่ 1</li>\n  <li>ข้อที่ 2</li>\n</ol>",
  },
  {
    icon: Quote,
    group: "text",
    title: "ยกคำพูด",
    kind: "wrap",
    before: "<blockquote>",
    after: "</blockquote>",
    sample: "ข้อความที่ยกมา",
  },
  {
    icon: Table,
    group: "text",
    title: "ตาราง",
    kind: "block",
    block:
      "<table>\n  <thead>\n    <tr><th>หัวข้อ 1</th><th>หัวข้อ 2</th></tr>\n  </thead>\n  <tbody>\n    <tr><td>ข้อมูล</td><td>ข้อมูล</td></tr>\n  </tbody>\n</table>",
  },
  { icon: Minus, group: "text", title: "เส้นคั่น", kind: "block", block: "<hr>" },
  {
    icon: Users,
    group: "block",
    title: "ทำเนียบบุคลากร (โครงพร้อมตัวอย่าง)",
    kind: "block",
    // ใส่ตัวอย่าง 1 คนไว้ในโครงเลย พร้อมบอกว่าเพิ่มคนยังไง เปลี่ยนจำนวนคอลัมน์ตรงไหน
    block:
      '<div class="people cols-3">\n' +
      "  <!-- คอลัมน์: เปลี่ยน cols-3 เป็น cols-2 / cols-4 / cols-5 ได้ -->\n" +
      "  <!-- เพิ่มคน: ก๊อป <figure> ทั้งก้อนด้านล่างมาต่อ · รูปควรเป็นรูปถ่าย 1.5 นิ้ว -->\n" +
      "  <!-- แถวละไม่เท่ากัน: วางก้อน people ต่อกันหลายก้อน เช่น cols-3 (ประธาน+รอง)\n" +
      "       แล้วตามด้วย cols-4 (กรรมการ) — คนไม่เต็มแถวจะจัดกึ่งกลางให้เอง -->\n" +
      '  <figure class="person">\n' +
      '    <img src="/uploads/ใส่ชื่อไฟล์รูป.jpg" alt="ชื่อ-นามสกุล">\n' +
      "    <figcaption>\n" +
      '      <span class="person-name">ชื่อ-นามสกุล</span>\n' +
      '      <span class="person-role">ตำแหน่ง</span>\n' +
      "    </figcaption>\n" +
      "  </figure>\n" +
      "</div>",
  },
  {
    icon: PanelsTopLeft,
    group: "block",
    title: "แท็ปเมนู (สลับหัวข้อ)",
    kind: "block",
    // data-title = ชื่อบนปุ่มแท็บ · เพิ่มแท็บก็ก๊อป <div class="tab"> ทั้งก้อนมาต่อ
    block:
      '<div class="tabs">\n' +
      '  <div class="tab" data-title="หัวข้อที่ 1">\n' +
      "    <p>เนื้อหาของหัวข้อที่ 1</p>\n" +
      "  </div>\n" +
      '  <div class="tab" data-title="หัวข้อที่ 2">\n' +
      "    <p>เนื้อหาของหัวข้อที่ 2</p>\n" +
      "  </div>\n" +
      "</div>",
  },
];


/**
 * ตัวเลือกโฟลเดอร์ปลายทาง — วางไว้ในแผงของเครื่องมือแต่ละตัวที่อัปไฟล์
 *
 * จงใจให้อยู่คู่กับปุ่มอัปเสมอ ไม่แยกไปลอยอยู่กลางแถบเครื่องมือ เพราะตอนจะแนบไฟล์
 * ต้องเห็นพร้อมกันว่า "ไฟล์นี้จะไปลงที่ไหน" ไม่ใช่ไปตั้งไว้อีกที่แล้วลืมว่าตั้งอะไรไว้
 */
function FolderChoice({
  value,
  onChange,
  folders,
  onOpen,
  naming,
  setNaming,
}: {
  value: string;
  onChange: (next: string) => void;
  folders: { value: string; label: string }[];
  onOpen: () => void;
  naming: boolean;
  setNaming: (next: boolean) => void;
}) {
  return (
    <div className="rounded-lg bg-gray-50 p-2 ring-1 ring-gray-200">
      <p className="px-1 text-[11px] font-medium text-gray-500">เก็บไฟล์ไว้ที่</p>

      {naming ? (
        <div className="mt-1 flex items-center gap-1">
          <span className="shrink-0 rounded-lg bg-white px-2 py-1.5 font-mono text-[11px] text-gray-500 ring-1 ring-gray-200">
            assets/pages/
          </span>
          <input
            autoFocus
            value={value.replace(/^pages\//, "")}
            onChange={(e) => onChange(`pages/${e.target.value.replace(/^pages\//, "")}`)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === "Escape") setNaming(false);
            }}
            placeholder="ชื่อโฟลเดอร์ใหม่"
            className="w-full rounded-lg border border-brand-300 px-2 py-1.5 font-mono text-xs outline-none focus:border-brand-500"
          />
          <button
            type="button"
            onClick={() => setNaming(false)}
            className="shrink-0 rounded-lg bg-brand-50 px-2 py-1.5 text-xs font-medium text-brand-700 transition hover:bg-brand-100"
          >
            ตกลง
          </button>
        </div>
      ) : (
        <select
          value={folders.some((f) => f.value === value) ? value : "__current"}
          onMouseDown={onOpen}
          onFocus={onOpen}
          onChange={(e) => {
            if (e.target.value === "__new") {
              // เริ่มจากค่าว่าง จะได้ไม่เผลอพิมพ์ทับชื่อเดิมครึ่ง ๆ กลาง ๆ
              onChange("pages/");
              setNaming(true);
              return;
            }
            if (e.target.value !== "__current") onChange(e.target.value);
          }}
          className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700 outline-none focus:border-brand-400"
        >
          {/* ค่าที่ใช้อยู่ต้องมีในรายการเสมอ ถึงจะยังไม่เคยมีไฟล์ไปลงก็ตาม */}
          {!folders.some((f) => f.value === value) && (
            <option value="__current">{value}</option>
          )}
          {folders.map((f) => (
            <option key={f.value} value={f.value}>
              {f.value} — {f.label}
            </option>
          ))}
          <option value="__new">＋ สร้างโฟลเดอร์ใหม่…</option>
        </select>
      )}

      <p className="mt-1 px-1 text-[11px] text-gray-400">assets/{value}</p>
    </div>
  );
}

/** ความกว้างแผงที่กางจากปุ่ม — ใช้หนีบไม่ให้เลยขอบจอ */
const MENU_WIDTH = 288;

/**
 * สีป้ายข้อความ — ใช้ชุดสีเดียวกับการ์ดลิงก์ จะได้ไม่มีสีแปลกปลอมโผล่มาในหน้าเดียวกัน
 * ชื่อ class ต้องอยู่ใน ALLOWED_CLASSES ของ src/lib/pageHtml.ts ด้วย
 */
/** ทางลัดขนาดที่ใช้บ่อย — พิมพ์ตัวเลขอื่นเองได้ ไม่ได้จำกัดแค่นี้ */
const ICON_SIZES = [40, 50, 64, 80];

/** สีไอคอน PDF — ค่าว่างคือสีแดงตามค่าตั้งต้น */
const ICON_COLORS = [
  { key: "", label: "แดง", swatch: "#dc2626" },
  { key: "blue", label: "ฟ้า", swatch: "#1568b0" },
  { key: "green", label: "เขียว", swatch: "#0f8a72" },
  { key: "amber", label: "ส้ม", swatch: "#b45309" },
  { key: "purple", label: "ม่วง", swatch: "#6d28d9" },
  { key: "gray", label: "เทา", swatch: "#4b5563" },
] as const;

const BADGE_COLORS = [
  { key: "blue", label: "ฟ้า" },
  { key: "green", label: "เขียว" },
  { key: "amber", label: "เหลือง" },
  { key: "pink", label: "ชมพู" },
  { key: "purple", label: "ม่วง" },
  { key: "teal", label: "เขียวทะเล" },
] as const;

/** จำนวนคอลัมน์ที่เลือกได้ของการ์ดลิงก์ — มากกว่า 4 การ์ดจะแคบจนอ่านชื่อไม่ออก */
const CARD_COLS = [2, 3, 4];

/**
 * โครงการ์ดลิงก์ — class ของการ์ด = สี (blue/green/amber/pink/purple/teal)
 * เพิ่มการ์ดก็ก๊อป <a> ทั้งก้อน · cols-N คือจำนวนการ์ดต่อแถว
 */
function cardsBlock(cols: number) {
  const card = (color: string, badge: string) =>
    `  <a class="card ${color}" href="#">\n` +
    `    <span class="card-badge">${badge}</span>\n` +
    '    <span class="card-text">\n' +
    '      <span class="card-title">ชื่อหัวข้อ</span>\n' +
    '      <span class="card-sub">คำอธิบายสั้น ๆ</span>\n' +
    "    </span>\n" +
    "  </a>";

  // ใส่การ์ดตัวอย่างให้เต็มแถวพอดี จะได้เห็นเลยว่าเลือกกี่คอลัมน์แล้วหน้าตาเป็นยังไง
  const samples = [
    ["blue", "แผน"],
    ["green", "รายงาน"],
    ["amber", "ระเบียบ"],
    ["purple", "ประกาศ"],
  ].slice(0, cols);

  return (
    `<div class="cards cols-${cols}">\n` +
    "  <!-- คอลัมน์: เปลี่ยน cols-" +
    cols +
    " เป็น cols-2 / cols-3 / cols-4 ได้ -->\n" +
    "  <!-- เพิ่มการ์ด: ก๊อป <a> ทั้งก้อนมาต่อ · สี: blue green amber pink purple teal -->\n" +
    samples.map(([color, badge]) => card(color, badge)).join("\n") +
    "\n</div>"
  );
}

export default function ContentToolbar({ textarea, value, onChange, folder = "page_images" }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const pdfInput = useRef<HTMLInputElement>(null);
  const personInput = useRef<HTMLInputElement>(null);
  const menuBox = useRef<HTMLDivElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ phase: UploadPhase | null; percent: number; name: string }>(
    { phase: null, percent: 0, name: "" },
  );
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [layout, setLayout] = useState<string>("");
  /** แทรกของลงแท็บไหน — "" = ตรงตำแหน่งเคอร์เซอร์เหมือนเดิม */
  const [target, setTarget] = useState<string>("");
  /** แผงที่กางอยู่ตอนนี้ — เปิดได้ทีละอัน */
  const [openMenu, setOpenMenu] = useState<null | "image" | "cards" | "pdf" | "badge">(null);
  /** การ์ดลิงก์ที่จะสร้างใหม่ ให้แถวละกี่ใบ */
  const [cardsCols, setCardsCols] = useState(3);
  /*
   * โฟลเดอร์ปลายทางของไฟล์ที่จะแนบครั้งถัดไป — ตั้งต้นเป็นโฟลเดอร์ของหน้านี้
   * แต่เลือกโฟลเดอร์อื่นหรือพิมพ์ชื่อใหม่ได้ทุกครั้งก่อนแนบ (บางไฟล์ใช้ร่วมหลายหน้า
   * เช่นแบบฟอร์มกลาง เก็บไว้ที่เดียวแล้วลิงก์จากหลายหน้าดีกว่าอัปซ้ำ)
   */
  const [saveTo, setSaveTo] = useState(folder);
  const [folderList, setFolderList] = useState<{ value: string; label: string }[]>([]);
  const [newFolder, setNewFolder] = useState(false);
  /**
   * แนบ PDF แบบไหน — "card" คือการ์ดอ่าน E-Book (แบบเดิม)
   * "link" คือลิงก์ดาวน์โหลดล้วน ๆ ไม่มีข้อความอธิบายใด ๆ กดแล้วได้ไฟล์เลย
   */
  const [pdfMode, setPdfMode] = useState<"card" | "link">("card");
  /** ขนาดไอคอน PDF (พิกเซล) และสี — ใช้ตอนแนบแบบไอคอนอย่างเดียว */
  const [iconSize, setIconSize] = useState(50);
  const [iconColor, setIconColor] = useState("");
  /** มุมบนซ้ายของแผง วัดจากจอ (position: fixed) — ตั้งตอนกดปุ่ม */
  const [menuAt, setMenuAt] = useState({ top: 0, left: 0 });
  /** ทำเนียบที่จะสร้างใหม่ ให้แถวละกี่คน */
  const [peopleCols, setPeopleCols] = useState(3);
  /** กำลังแก้ทำเนียบกลุ่มไหน — null = กลุ่มล่างสุด (กลุ่มที่เพิ่งแทรก) */
  const [groupPick, setGroupPick] = useState<number | null>(null);

  const tabs = findTabs(value);

  /*
   * ทำเนียบในหน้าเดียวมีได้หลายกลุ่ม แต่ละกลุ่มตั้งคนต่อแถวของตัวเองได้
   * เช่นแถวประธาน/รองประธาน 3 คน แล้วกรรมการที่เหลือแถวละ 4 — คือคนละ <div class="people">
   */
  const peopleBlocks = findBlocks(value, "people");
  const activeIndex =
    groupPick !== null && groupPick < peopleBlocks.length ? groupPick : peopleBlocks.length - 1;
  const activeBlock = peopleBlocks[activeIndex] ?? null;
  const currentCols = Number(/\bcols-(\d)\b/.exec(activeBlock?.className ?? "")?.[1] ?? peopleCols);

  /** จำนวนคนในแต่ละกลุ่ม — เอาไว้โชว์บนปุ่มเลือกกลุ่มให้รู้ว่ากลุ่มไหนคือกลุ่มไหน */
  const groupSizes = peopleBlocks.map((b) => (b.inner.match(/class="person"/g) ?? []).length);

  /** การ์ดลิงก์ในหน้านี้ — แก้ก้อนล่างสุด (ก้อนที่เพิ่งแทรก) */
  const cardsBlocks = findBlocks(value, "cards");
  const activeCards = cardsBlocks.at(-1) ?? null;
  const currentCardCols = Number(
    /\bcols-(\d)\b/.exec(activeCards?.className ?? "")?.[1] ?? cardsCols,
  );

  /** เขียนเลขคอลัมน์ลงแท็กเปิดของก้อนที่ระบุ — ใช้ร่วมกันทั้งทำเนียบและการ์ดลิงก์ */
  function applyCols(block: HtmlBlock, n: number) {
    const openEnd = value.indexOf(">", block.start) + 1;
    const openTag = value.slice(block.start, openEnd);
    const nextTag = /\bcols-\d\b/.test(openTag)
      ? openTag.replace(/\bcols-\d\b/, `cols-${n}`)
      : openTag.replace(/class="([^"]*)"/, `class="$1 cols-${n}"`);

    onChange(value.slice(0, block.start) + nextTag + value.slice(openEnd));
  }

  /** เปลี่ยนจำนวนคนต่อแถวของกลุ่มที่กำลังแก้ — ยังไม่มีทำเนียบเลยก็แค่จำไว้ใช้ตอนแทรกครั้งถัดไป */
  function changeColumns(n: number) {
    setPeopleCols(n);
    if (activeBlock) applyCols(activeBlock, n);
  }

  /** เปลี่ยนจำนวนการ์ดต่อแถว — ยังไม่มีการ์ดก็จำไว้ใช้ตอนแทรกครั้งถัดไป */
  function changeCardCols(n: number) {
    setCardsCols(n);
    if (activeCards) applyCols(activeCards, n);
  }

  /**
   * จัดทำเนียบที่ใส่ไปแล้วให้เข้าที่ — เรียงตามเลขหน้าชื่อไฟล์ แยกตำแหน่งออกจากชื่อ
   * ใช้กับหน้าที่แทรกรูปไปก่อนหน้านี้ จะได้ไม่ต้องลบทิ้งแล้วอัปใหม่
   */
  function tidyPeople() {
    setError(null);
    const result = tidyPeopleHtml(value);
    if (result.html === value) {
      setHint("ทำเนียบเรียบร้อยดีอยู่แล้ว ไม่มีอะไรต้องจัด");
      return;
    }

    onChange(result.html);
    setHint(
      `จัดทำเนียบให้แล้ว ${result.fixed} คน (เรียงตามเลขหน้าชื่อไฟล์)` +
        (result.unknownRole > 0
          ? ` · อ่านตำแหน่งไม่ออก ${result.unknownRole} คน ต้องพิมพ์เอง`
          : ""),
    );
  }

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

  /*
   * แผงเลือกชนิดรูปลอยยึดกับจอ (fixed) ตำแหน่งจึงค้างอยู่กับที่เมื่อหน้าเลื่อน
   * ปิดทิ้งเมื่อเลื่อนจอ ย่อ-ขยายหน้าต่าง กด Esc หรือคลิกที่อื่น จะได้ไม่ลอยผิดที่
   */
  useEffect(() => {
    if (!openMenu) return;

    const close = () => setOpenMenu(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const onDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // กดในแผงเอง หรือกดปุ่มที่เปิดแผง (ปุ่มมีตัวสลับเปิด-ปิดของมันเองอยู่แล้ว) ไม่ต้องปิดซ้ำ
      if (menuBox.current?.contains(target) || target.closest?.("[data-menu-btn]")) return;
      close();
    };

    // true = จับตอน capture เพราะการเลื่อนเกิดในช่องพิมพ์ ไม่ได้เกิดที่ window
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [openMenu]);

  /** ดึงรายชื่อโฟลเดอร์ที่มีอยู่จริงมาให้เลือก — เรียกครั้งเดียวตอนต้องใช้ */
  async function loadFolders() {
    if (folderList.length > 0) return;
    const response = await fetch("/api/admin/folders/").catch(() => null);
    if (!response?.ok) return;
    const data = (await response.json().catch(() => ({}))) as {
      folders?: { value: string; label: string }[];
    };
    setFolderList(data.folders ?? []);
  }

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

  /**
   * แทรกโครงหลายบรรทัด (ตาราง เส้นคั่น รูป ไฟล์ PDF)
   * ปกติลงตรงตำแหน่งเคอร์เซอร์ · เลือกแท็บไว้ก็ไปต่อท้ายในแท็บนั้นให้เอง
   */
  function insert(block: string) {
    const el = textarea.current;
    if (!el) return;

    const slot = tabs[Number(target)];
    const at = target !== "" && slot ? slot.insertAt : range().start;
    const before = value.slice(0, at);
    const lead = before && !before.endsWith("\n") ? "\n" : "";
    const next = `${before}${lead}${block}\n${value.slice(at)}`;
    onChange(next);

    requestAnimationFrame(() => {
      el.focus();
      const to = at + lead.length + block.length;
      el.setSelectionRange(to, to);
      caret.current = to;
      // เลื่อนช่องพิมพ์ไปให้เห็นบรรทัดที่เพิ่งแทรก โดยเฉพาะตอนแทรกลงแท็บที่อยู่ไกลจากที่มองอยู่
      el.scrollTop = Math.max(0, (to / Math.max(value.length, 1)) * el.scrollHeight - el.clientHeight / 2);
      // เลื่อนช่องพิมพ์ไปตรงที่เพิ่งแทรก ไม่งั้นแทรกท้ายบทความยาว ๆ แล้วไม่เห็นว่าอะไรเกิดขึ้น
      el.blur();
      el.focus();
    });
  }

  /**
   * อัปรูปบุคคล — ย่อ 400px พอสำหรับกรอบ 1 นิ้ว และวางเป็น <figure class="person">
   * ใส่ในกริดทำเนียบก็ได้ วางเดี่ยว ๆ ก็ได้ ขนาดกรอบเท่ากันทั้งสองแบบ
   *
   * ชื่อไฟล์คือข้อมูล: 01-ประธานกรรมการ-นายจำลอง-แก้วพิทยานนท์.png
   * → เรียงตามเลข 01-15 แล้วแยกตำแหน่งกับชื่อลงคนละช่องให้เลย ไม่ต้องมานั่งแก้ทีละคน
   */
  async function uploadPeople(picked: File[]) {
    setError(null);
    setHint(null);
    setUploading(true);

    // เบราว์เซอร์ส่งไฟล์มาตามลำดับที่กดเลือก ไม่ใช่ตามเลขหน้าชื่อไฟล์ ต้องเรียงเองก่อน
    const files = sortByFileOrder(picked, (f) => f.name);

    const done: { url: string; name: string }[] = [];
    for (const [i, file] of files.entries()) {
      setProgress({
        phase: "upload",
        percent: 0,
        name: files.length > 1 ? `${file.name} (${i + 1}/${files.length})` : file.name,
      });

      const form = new FormData();
      form.append("file", file);
      form.append("folder", saveTo);
      form.append("maxEdge", "400");
      const result = await uploadWithProgress<{ url: string }>("/api/admin/upload/", form, (percent, phase) =>
        setProgress((p) => ({ ...p, percent, phase })),
      );
      if (!result.ok) {
        setError(`${file.name}: ${result.error}`);
        break;
      }
      done.push({ url: result.data.url, name: file.name.replace(/\.[^.]+$/, "") });
    }

    setUploading(false);
    if (done.length === 0) return;

    // alt เก็บชื่อไฟล์เดิมไว้เสมอ — ใช้เป็นต้นทางตอนกด "จัดชื่อ-ตำแหน่ง" ซ้ำภายหลัง
    let noRole = 0;
    const figures = done
      .map((d) => {
        const person = parsePersonFile(d.name);
        if (!person.role) noRole += 1;
        return (
          `  <figure class="person">\n    <img src="${d.url}" alt="${d.name}">\n` +
          `    <figcaption>\n      <span class="person-name">${person.name || d.name}</span>\n` +
          `      <span class="person-role">${person.role || "ตำแหน่ง"}</span>\n` +
          "    </figcaption>\n  </figure>"
        );
      })
      .join("\n");

    insert(`<div class="people cols-${peopleCols}">\n${figures}\n</div>`);
    // กลุ่มใหม่อยู่ล่างสุดเสมอ — เลิกล็อกกลุ่มที่เลือกไว้ ปุ่มคนต่อแถวจะได้แก้กลุ่มที่เพิ่งแทรก
    setGroupPick(null);
    setHint(
      `แทรกรูปบุคคล ${done.length} คน เรียงตามเลขหน้าชื่อไฟล์แล้ว แถวละ ${peopleCols} คน` +
        (noRole > 0 ? ` · อ่านตำแหน่งไม่ออก ${noRole} คน ต้องพิมพ์เอง` : " · แยกชื่อกับตำแหน่งให้แล้ว"),
    );
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

  /** อัปไฟล์ PDF แล้ววางเป็นการ์ดให้กดอ่านแบบ E-Book ในหน้าเว็บ */
  async function uploadPdf(file: File) {
    setError(null);
    setHint(null);
    setUploading(true);
    setProgress({ phase: "upload", percent: 0, name: file.name });

    const form = new FormData();
    form.append("file", file);
    form.append("folder", saveTo);
    const result = await uploadWithProgress<{ url: string }>("/api/admin/upload/", form, (percent, phase) =>
      setProgress((p) => ({ ...p, percent, phase })),
    );
    setUploading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    // โชว์ชื่อไฟล์เต็มรวมนามสกุล — คนอ่านจะได้รู้ทันทีว่าเป็นไฟล์อะไร ขนาดไหนควรคาดหวัง
    const name = file.name;
    const read = `/read/?src=${encodeURIComponent(result.data.url)}&title=${encodeURIComponent(name)}`;

    if (pdfMode === "link") {
      /*
       * ไอคอนอย่างเดียว ไม่มีข้อความบนหน้าเว็บเลย — กดที่ไอคอนแล้วโหลดไฟล์ทันที
       * ชื่อไฟล์ยังใส่ไว้ใน title/aria-label เพื่อให้เอาเมาส์ชี้แล้วเห็น และโปรแกรมอ่านหน้าจอ
       * อ่านออกว่ากำลังจะโหลดไฟล์อะไร (ไอคอนเปล่า ๆ คนตาบอดจะไม่รู้เลยว่าลิงก์นี้คืออะไร)
       */
      // ขนาดใส่เป็น --pdf-size ติดไปกับแท็ก จะได้ตั้งเป็นตัวเลขอะไรก็ได้ ไม่ต้องมี class ตายตัว
      const css = `pdf-icon${iconColor ? ` ${iconColor}` : ""}`;
      insert(
        `<a class="${css}" style="--pdf-size:${iconSize}px" href="${result.data.url}" download ` +
          `title="${name}" aria-label="ดาวน์โหลด ${name}"></a>`,
      );
    } else {
      insert(
        `<div class="ebook">\n  <span class="ebook-name">${name}</span>\n` +
          `  <a href="${read}">เปิดอ่านแบบ E-Book</a>\n` +
          `  <a href="${result.data.url}">ดาวน์โหลด PDF</a>\n</div>`,
      );
    }

    const where = tabs[Number(target)] ? ` ในแท็บ “${tabs[Number(target)].title}”` : "";
    const what = pdfMode === "link" ? "ไอคอนดาวน์โหลด" : "การ์ดอ่าน E-Book";
    setHint(`แนบไฟล์ PDF แบบ${what}แล้ว${where} — ต้องกดบันทึกด้านล่างด้วย ถึงจะขึ้นบนหน้าเว็บจริง`);
  }

  /**
   * อัปได้ทีละหลายไฟล์ — เลือกไฟล์เดียวได้รูปเดี่ยว เลือกหลายไฟล์ได้แถวรูปเรียงข้างกัน
   * อัปเรียงทีละไฟล์ ไม่ยิงพร้อมกัน เพราะแถบความคืบหน้ามีอันเดียวและ FTP ก็รับทีละไฟล์อยู่ดี
   */
  async function uploadMany(files: File[], maxEdge = 600) {
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
      form.append("folder", saveTo);
      form.append("maxEdge", String(maxEdge));
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
    const where = tabs[Number(target)] ? ` ในแท็บ “${tabs[Number(target)].title}”` : "";
    setHint(
      done.length === 1
        ? `แทรกรูปแล้ว${where} — ต้องกดบันทึกด้านล่างด้วย รูปถึงจะขึ้นบนหน้าเว็บจริง`
        : `แทรก ${done.length} รูปเรียงเป็นแถวแล้ว${where} — ต้องกดบันทึกด้านล่างด้วย`,
    );
  }

  return (
    <div className="border-b border-gray-100 bg-gray-50 px-2 py-1.5">
      <input
        ref={personInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length > 0) void uploadPeople(files);
          e.target.value = "";
        }}
      />

      <input
        ref={pdfInput}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void uploadPdf(file);
          e.target.value = "";
        }}
      />

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

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="text-[11px] font-medium text-gray-400">ข้อความ</span>
        {TOOLS.filter((t) => t.group === "text").map((tool) => (
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

        {/* ป้ายข้อความ — ครอบคำที่เลือกไว้ให้เป็นป้ายสี เน้นคำสำคัญกลางย่อหน้าได้ */}
        <div className="relative">
          <button
            data-menu-btn
            type="button"
            title="ป้ายข้อความ — เลือกข้อความก่อนแล้วกดเลือกสี"
            onClick={(e) => {
              const box = e.currentTarget.getBoundingClientRect();
              setMenuAt({
                top: box.bottom + 4,
                left: Math.max(8, Math.min(box.left, window.innerWidth - MENU_WIDTH - 16)),
              });
              setOpenMenu((v) => (v === "badge" ? null : "badge"));
            }}
            className={`inline-flex h-8 items-center gap-1 rounded-lg px-2 text-gray-500 transition hover:bg-white hover:text-brand-600 hover:shadow-sm ${
              openMenu === "badge" ? "bg-white text-brand-600 shadow-sm" : ""
            }`}
          >
            <Tag className="h-4 w-4" />
            <ChevronDown className="h-3 w-3" />
          </button>

          {openMenu === "badge" && (
            <div
              ref={menuBox}
              style={{ top: menuAt.top, left: menuAt.left, width: MENU_WIDTH }}
              className="fixed z-50 rounded-xl bg-white p-2 shadow-xl ring-1 ring-black/10"
            >
              <p className="px-1 text-sm font-medium text-gray-800">ป้ายข้อความ</p>
              <p className="mb-2 px-1 text-xs text-gray-500">
                เลือกข้อความในเนื้อหาก่อน แล้วกดสี — ไม่ได้เลือกไว้จะได้ป้ายตัวอย่างมาแก้ทับ
              </p>

              <div className="grid grid-cols-3 gap-1.5">
                {BADGE_COLORS.map((color) => (
                  <button
                    key={color.key}
                    type="button"
                    onClick={() => {
                      setOpenMenu(null);
                      wrap(`<span class="badge ${color.key}">`, "</span>", "ข้อความ");
                    }}
                    className={`badge-swatch-${color.key} rounded-lg px-2 py-2 text-xs font-medium ring-1 transition hover:brightness-95`}
                  >
                    {color.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <span className="h-5 w-px bg-gray-200" />
        <span className="text-[11px] font-medium text-gray-400">บล็อก</span>
        {TOOLS.filter((t) => t.group === "block").map((tool) => (
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

        {/* การ์ดลิงก์ต้องเลือกจำนวนคอลัมน์ก่อนแทรก เลยแยกออกมามีแผงของตัวเอง */}
        <div className="relative">
          <button
            data-menu-btn
            type="button"
            title="การ์ดลิงก์ (เรียงเป็นตาราง)"
            aria-label="การ์ดลิงก์"
            onClick={(e) => {
              const box = e.currentTarget.getBoundingClientRect();
              setMenuAt({
                top: box.bottom + 4,
                left: Math.max(8, Math.min(box.left, window.innerWidth - MENU_WIDTH - 16)),
              });
              setOpenMenu((v) => (v === "cards" ? null : "cards"));
            }}
            className={`grid h-8 w-8 place-items-center rounded-lg transition hover:bg-white hover:text-brand-600 hover:shadow-sm ${
              openMenu === "cards" ? "bg-white text-brand-600 shadow-sm" : "text-gray-500"
            }`}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>

          {openMenu === "cards" && (
            <div
              ref={menuBox}
              style={{ top: menuAt.top, left: menuAt.left, width: MENU_WIDTH }}
              className="fixed z-50 max-h-[70vh] overflow-y-auto rounded-xl bg-white p-2 shadow-xl ring-1 ring-black/10"
            >
              <p className="px-1 text-sm font-medium text-gray-800">การ์ดลิงก์</p>
              <p className="px-1 text-xs text-gray-500">
                การ์ดใบหนึ่งคือลิงก์หนึ่งลิงก์ · เลือกก่อนว่าจะให้แถวละกี่ใบ
              </p>

              <div className="mt-2 flex items-center gap-1.5 px-1">
                <span className="text-xs text-gray-500">การ์ดต่อแถว</span>
                {CARD_COLS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => changeCardCols(n)}
                    className={`h-7 w-8 rounded-lg text-xs font-medium transition ${
                      currentCardCols === n
                        ? "bg-brand-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => {
                  setOpenMenu(null);
                  insert(cardsBlock(cardsCols));
                  setHint(`แทรกการ์ดลิงก์ แถวละ ${cardsCols} ใบ — แก้ชื่อกับลิงก์ในเนื้อหา`);
                }}
                className="mt-2 w-full rounded-lg bg-brand-50 px-2 py-1.5 text-xs font-medium text-brand-700 transition hover:bg-brand-100"
              >
                แทรกการ์ดลิงก์ {cardsCols} คอลัมน์
              </button>

              {activeCards && (
                <p className="mt-1.5 px-1 text-[11px] text-emerald-700">
                  หน้านี้มีการ์ดอยู่แล้ว — กดเลขด้านบนเพื่อเปลี่ยนจำนวนต่อแถวได้ทันที
                </p>
              )}
            </div>
          )}
        </div>

        <span className="h-5 w-px bg-gray-200" />

        <span className="text-[11px] font-medium text-gray-400">รูปภาพ</span>

        {/* มีแท็บในหน้านี้ถึงจะขึ้น — เลือกแล้วของที่แทรกจะไปต่อท้ายในแท็บนั้นให้เลย
            ไม่ต้องไปวางเคอร์เซอร์ในโค้ดเอง */}
        {tabs.length > 0 && (
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            aria-label="แทรกลงในแท็บ"
            title="เลือกว่าจะแทรกรูป/ไฟล์/ตาราง ลงในแท็บไหน"
            className="rounded-lg border border-brand-200 bg-brand-50 px-2 py-1.5 text-xs font-medium text-brand-800 outline-none focus:border-brand-400"
          >
            <option value="">แทรกตรงเคอร์เซอร์</option>
            {tabs.map((tab, i) => (
              <option key={`${tab.title}-${i}`} value={String(i)}>
                ลงแท็บ: {tab.title}
              </option>
            ))}
          </select>
        )}

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

        {/* ปุ่มเดียว กดแล้วค่อยเลือกว่าเป็นรูปทั่วไปหรือรูปบุคคล — ย่อคนละขนาดกัน */}
        <div className="relative">
          <button
            data-menu-btn
            type="button"
            onClick={(e) => {
              const box = e.currentTarget.getBoundingClientRect();
              // ยึดกับจอ ไม่ใช่กับปุ่ม เพราะกรอบการ์ดของหน้าแก้ไขตั้ง overflow-hidden ไว้
              // แผงที่ยื่นพ้นกรอบจะโดนตัดหายไปครึ่งหนึ่ง (ปุ่มคนต่อแถวเลข 5 หายไปเลย)
              setMenuAt({
                top: box.bottom + 4,
                left: Math.max(8, Math.min(box.left, window.innerWidth - MENU_WIDTH - 16)),
              });
              setOpenMenu((v) => (v === "image" ? null : "image"));
            }}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs font-medium text-brand-700 transition hover:bg-brand-100 disabled:opacity-60"
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ImagePlus className="h-3.5 w-3.5" />
            )}
            แทรกรูป
            <ChevronDown className={`h-3 w-3 transition ${openMenu === "image" ? "rotate-180" : ""}`} />
          </button>

          {openMenu === "image" && (
            <div
              ref={menuBox}
              style={{ top: menuAt.top, left: menuAt.left, width: MENU_WIDTH }}
              className="fixed z-50 max-h-[70vh] overflow-y-auto rounded-xl bg-white p-2 shadow-xl ring-1 ring-black/10"
            >
              {/* ปลายทางอยู่ในแผงเดียวกับปุ่มเลือกไฟล์ — เห็นพร้อมกันว่าไฟล์จะไปลงที่ไหน */}
              <FolderChoice
                value={saveTo}
                onChange={setSaveTo}
                folders={folderList}
                onOpen={() => void loadFolders()}
                naming={newFolder}
                setNaming={setNewFolder}
              />

              <button
                type="button"
                onClick={() => {
                  setOpenMenu(null);
                  fileInput.current?.click();
                }}
                className="flex w-full items-start gap-2 rounded-lg p-2 text-left transition hover:bg-gray-50"
              >
                <ImagePlus className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                <span>
                  <span className="block text-sm font-medium text-gray-800">รูปทั่วไป</span>
                  <span className="block text-xs text-gray-500">
                    ย่อให้ด้านยาวสุดไม่เกิน 600px · เลือกการวางได้จากช่องซ้ายมือ
                  </span>
                </span>
              </button>

              <div className="mt-1 rounded-lg p-2 transition hover:bg-gray-50">
                <button
                  type="button"
                  onClick={() => {
                    setOpenMenu(null);
                    personInput.current?.click();
                  }}
                  className="flex w-full items-start gap-2 text-left"
                >
                  <UserSquare2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                  <span>
                    <span className="block text-sm font-medium text-gray-800">
                      รูปบุคคล (ทำเนียบ)
                    </span>
                    <span className="block text-xs text-gray-500">
                      กรอบรูปถ่าย 1.5 นิ้ว (3.5 × 4.5 ซม.) พร้อมช่องชื่อและตำแหน่ง
                    </span>
                  </span>
                </button>

                {/* มีทำเนียบหลายกลุ่มก็เลือกได้ว่าจะแก้กลุ่มไหน — กลุ่มละคนต่อแถวไม่เท่ากันได้ */}
                {peopleBlocks.length > 1 && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-6">
                    <span className="text-xs text-gray-500">แก้กลุ่ม</span>
                    {peopleBlocks.map((b, i) => (
                      <button
                        key={b.start}
                        type="button"
                        onClick={() => setGroupPick(i)}
                        className={`rounded-lg px-2 py-1 text-[11px] font-medium transition ${
                          activeIndex === i
                            ? "bg-brand-600 text-white"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        {i + 1} · {groupSizes[i]} คน
                      </button>
                    ))}
                  </div>
                )}

                {/* เลือกคนต่อแถวตรงนี้เลย ไม่ต้องไปหาแผงแยกอีกที */}
                <div className="mt-2 flex items-center gap-1.5 pl-6">
                  <span className="text-xs text-gray-500">คนต่อแถว</span>
                  {[2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => changeColumns(n)}
                      className={`h-7 w-8 rounded-lg text-xs font-medium transition ${
                        currentCols === n
                          ? "bg-brand-600 text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                {/* หน้าที่แทรกรูปไปก่อนมี ปุ่มนี้จัดชื่อกับลำดับให้ใหม่ ไม่ต้องอัปซ้ำ */}
                {activeBlock && (
                  <button
                    type="button"
                    onClick={() => {
                      setOpenMenu(null);
                      tidyPeople();
                    }}
                    className="mt-2 ml-6 rounded-lg bg-emerald-50 px-2 py-1.5 text-[11px] font-medium text-emerald-700 transition hover:bg-emerald-100"
                  >
                    จัดชื่อ-ตำแหน่ง-ลำดับ จากชื่อไฟล์
                  </button>
                )}

                {activeBlock && (
                  <p className="mt-1.5 pl-6 text-[11px] text-emerald-700">
                    {peopleBlocks.length > 1
                      ? `กำลังแก้กลุ่มที่ ${activeIndex + 1} — แทรกรูปบุคคลอีกครั้งจะได้กลุ่มใหม่ ตั้งคนต่อแถวแยกได้`
                      : "หน้านี้มีทำเนียบอยู่แล้ว — แทรกรูปบุคคลอีกครั้งจะได้กลุ่มใหม่ ตั้งคนต่อแถวแยกกันได้"}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <span className="h-5 w-px bg-gray-200" />
        <span className="text-[11px] font-medium text-gray-400">ไฟล์</span>

        <span className="h-5 w-px bg-gray-200" />

        {/* จัดย่อหน้าโค้ดทั้งหน้าให้เป็นระเบียบเดียวกัน — ของที่ก๊อปมาจากที่อื่นมักย่อหน้าเละ */}
        <button
          type="button"
          onClick={() => {
            const next = prettyHtml(repairStructure(value));
            if (next === value) {
              setHint("โค้ดเป็นระเบียบดีอยู่แล้ว ไม่มีอะไรต้องจัด");
              return;
            }
            onChange(next);
            setError(null);
            setHint("จัดย่อหน้าโค้ดให้แล้ว — ข้อความเหมือนเดิมทุกตัวอักษร");
          }}
          title="จัดย่อหน้าโค้ดให้อ่านง่าย ไม่แตะข้อความ"
          className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-2.5 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-200"
        >
          <WandSparkles className="h-3.5 w-3.5" />
          จัดโค้ดให้สวย
        </button>

        <div className="relative">
          <button
            data-menu-btn
            type="button"
            onClick={(e) => {
              const box = e.currentTarget.getBoundingClientRect();
              setMenuAt({
                top: box.bottom + 4,
                left: Math.max(8, Math.min(box.left, window.innerWidth - MENU_WIDTH - 16)),
              });
              setOpenMenu((v) => (v === "pdf" ? null : "pdf"));
            }}
            disabled={uploading}
            title="อัปไฟล์ PDF แล้ววางเป็นการ์ดให้กดอ่านแบบ E-Book"
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs font-medium text-brand-700 transition hover:bg-brand-100 disabled:opacity-60"
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileText className="h-3.5 w-3.5" />
            )}
            แนบ PDF
            <ChevronDown className={`h-3 w-3 transition ${openMenu === "pdf" ? "rotate-180" : ""}`} />
          </button>

          {openMenu === "pdf" && (
            <div
              ref={menuBox}
              style={{ top: menuAt.top, left: menuAt.left, width: MENU_WIDTH }}
              className="fixed z-50 max-h-[70vh] overflow-y-auto rounded-xl bg-white p-2 shadow-xl ring-1 ring-black/10"
            >
              <p className="px-1 text-sm font-medium text-gray-800">แนบไฟล์ PDF</p>
              <p className="mb-2 px-1 text-xs text-gray-500">
                วางเป็นการ์ดพร้อมปุ่มอ่านแบบ E-Book และปุ่มดาวน์โหลด
              </p>

              <FolderChoice
                value={saveTo}
                onChange={setSaveTo}
                folders={folderList}
                onOpen={() => void loadFolders()}
                naming={newFolder}
                setNaming={setNewFolder}
              />

              {/* สองแบบ: การ์ดอ่านในเว็บ กับลิงก์โหลดไฟล์ล้วน ๆ — เลือกแบบไหนก็เปิดหน้าต่างเลือกไฟล์เลย */}
              <div className="mt-2 space-y-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setPdfMode("card");
                    setOpenMenu(null);
                    pdfInput.current?.click();
                  }}
                  className="w-full rounded-lg bg-brand-600 px-2.5 py-2 text-left text-xs font-semibold text-white transition hover:bg-brand-700"
                >
                  การ์ดอ่านแบบ E-Book
                  <span className="mt-0.5 block text-[11px] font-normal text-white/80">
                    ชื่อไฟล์ + ปุ่มเปิดอ่านในเว็บ + ปุ่มดาวน์โหลด
                  </span>
                </button>

                <div className="rounded-lg bg-gray-50 p-2 ring-1 ring-gray-200">
                  <p className="px-1 text-xs font-semibold text-gray-700">ไอคอน PDF อย่างเดียว</p>
                  <p className="px-1 text-[11px] text-gray-500">
                    ไอคอนตัวเดียว ไม่มีชื่อไฟล์ ไม่มีข้อความ กดแล้วโหลดไฟล์ทันที
                  </p>

                  {/* ขนาดกับสีเลือกก่อนแนบ จะได้ไม่ต้องไปแก้ class ในโค้ดทีหลัง */}
                  {/* พิมพ์ขนาดเองได้ทุกตัวเลข ปุ่มด้านหลังเป็นแค่ทางลัดของขนาดที่ใช้บ่อย */}
                  <div className="mt-2 flex items-center gap-1.5 px-1">
                    <span className="shrink-0 text-[11px] text-gray-500">ขนาด</span>
                    <input
                      type="number"
                      min={16}
                      max={200}
                      value={iconSize}
                      onChange={(e) => setIconSize(Number(e.target.value))}
                      onBlur={() => setIconSize(Math.min(200, Math.max(16, iconSize || 50)))}
                      className="w-16 rounded-lg border border-gray-300 px-2 py-1 text-xs outline-none focus:border-brand-500"
                    />
                    <span className="shrink-0 text-[11px] text-gray-400">px</span>

                    {ICON_SIZES.map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => setIconSize(size)}
                        className={`h-7 flex-1 rounded-lg text-[11px] font-medium transition ${
                          iconSize === size
                            ? "bg-brand-600 text-white"
                            : "bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-100"
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>

                  <div className="mt-1.5 flex items-center gap-1.5 px-1">
                    <span className="text-[11px] text-gray-500">สี</span>
                    {ICON_COLORS.map((color) => (
                      <button
                        key={color.key || "default"}
                        type="button"
                        onClick={() => setIconColor(color.key)}
                        title={color.label}
                        aria-label={`สี${color.label}`}
                        style={{ backgroundColor: color.swatch }}
                        className={`h-6 w-6 rounded-full transition ${
                          iconColor === color.key
                            ? "ring-2 ring-gray-800 ring-offset-2"
                            : "ring-1 ring-black/10 hover:scale-110"
                        }`}
                      />
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setPdfMode("link");
                      setOpenMenu(null);
                      pdfInput.current?.click();
                    }}
                    className="mt-2 w-full rounded-lg bg-gray-700 px-2.5 py-2 text-xs font-semibold text-white transition hover:bg-gray-800"
                  >
                    เลือกไฟล์ PDF (ไอคอน {iconSize}px)
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <UploadProgress phase={progress.phase} percent={progress.percent} fileName={progress.name} />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      {hint && <p className="mt-1 text-xs font-medium text-emerald-700">{hint}</p>}
    </div>
  );
}
