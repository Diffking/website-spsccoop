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
  Users,
} from "lucide-react";
import UploadProgress from "@/components/admin/UploadProgress";
import { uploadWithProgress, type UploadPhase } from "@/lib/uploadClient";
import { findBlocks } from "@/lib/htmlBlocks";
import { parsePersonFile, sortByFileOrder } from "@/lib/personName";
import { tidyPeopleHtml } from "@/lib/peopleHtml";

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
    icon: LayoutGrid,
    group: "block",
    title: "การ์ดลิงก์ (เรียงเป็นตาราง)",
    kind: "block",
    // class ของการ์ด = สี (blue/green/amber/pink/purple/teal) · เพิ่มการ์ดก็ก๊อป <a> ทั้งก้อน
    block:
      '<div class="cards">\n' +
      '  <a class="card blue" href="#">\n' +
      '    <span class="card-badge">แผน</span>\n' +
      '    <span class="card-text">\n' +
      '      <span class="card-title">ชื่อหัวข้อ</span>\n' +
      '      <span class="card-sub">คำอธิบายสั้น ๆ</span>\n' +
      "    </span>\n" +
      "  </a>\n" +
      '  <a class="card green" href="#">\n' +
      '    <span class="card-badge">รายงาน</span>\n' +
      '    <span class="card-text">\n' +
      '      <span class="card-title">ชื่อหัวข้อ</span>\n' +
      '      <span class="card-sub">คำอธิบายสั้น ๆ</span>\n' +
      "    </span>\n" +
      "  </a>\n" +
      "</div>",
  },
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

/** ความกว้างแผงเลือกชนิดรูป (w-72) — ใช้คำนวณว่าจะกางไปทางไหน */
const MENU_WIDTH = 288;

export default function ContentToolbar({ textarea, value, onChange, folder = "page_images" }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const pdfInput = useRef<HTMLInputElement>(null);
  const personInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ phase: UploadPhase | null; percent: number; name: string }>(
    { phase: null, percent: 0, name: "" },
  );
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [layout, setLayout] = useState<string>("");
  /** แทรกของลงแท็บไหน — "" = ตรงตำแหน่งเคอร์เซอร์เหมือนเดิม */
  const [target, setTarget] = useState<string>("");
  /** เมนูเลือกชนิดรูปตอนกดปุ่มแทรกรูป */
  const [imageMenu, setImageMenu] = useState(false);
  /** กางแผงไปทางซ้ายแทน เมื่อกางทางขวาแล้วจะล้นขอบจอ */
  const [menuRight, setMenuRight] = useState(false);
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

  /** เปลี่ยนจำนวนคนต่อแถวของกลุ่มที่กำลังแก้ — ยังไม่มีทำเนียบเลยก็แค่จำไว้ใช้ตอนแทรกครั้งถัดไป */
  function changeColumns(n: number) {
    setPeopleCols(n);
    if (!activeBlock) return;

    const openEnd = value.indexOf(">", activeBlock.start) + 1;
    const openTag = value.slice(activeBlock.start, openEnd);
    const nextTag = /\bcols-\d\b/.test(openTag)
      ? openTag.replace(/\bcols-\d\b/, `cols-${n}`)
      : openTag.replace(/class="([^"]*)"/, `class="$1 cols-${n}"`);

    onChange(value.slice(0, activeBlock.start) + nextTag + value.slice(openEnd));
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
      form.append("folder", folder);
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
    form.append("folder", "page_images");
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
    insert(
      `<div class="ebook">\n  <span class="ebook-name">${name}</span>\n` +
        `  <a href="${read}">เปิดอ่านแบบ E-Book</a>\n` +
        `  <a href="${result.data.url}">ดาวน์โหลด PDF</a>\n</div>`,
    );
    const where = tabs[Number(target)] ? ` ในแท็บ “${tabs[Number(target)].title}”` : "";
    setHint(`แนบไฟล์ PDF แล้ว${where} — ต้องกดบันทึกด้านล่างด้วย ถึงจะขึ้นบนหน้าเว็บจริง`);
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
      form.append("folder", folder);
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
            type="button"
            onClick={(e) => {
              // ปุ่มนี้มักอยู่ค่อนไปทางขวา ถ้ากางแผงไปทางขวาเสมอจะล้นขอบจอจนอ่านไม่ครบ
              const box = e.currentTarget.getBoundingClientRect();
              setMenuRight(box.left + MENU_WIDTH > window.innerWidth - 16);
              setImageMenu((v) => !v);
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
            <ChevronDown className={`h-3 w-3 transition ${imageMenu ? "rotate-180" : ""}`} />
          </button>

          {imageMenu && (
            <div
              className={`absolute top-full z-40 mt-1 w-72 rounded-xl bg-white p-2 shadow-xl ring-1 ring-black/10 ${
                menuRight ? "right-0" : "left-0"
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  setImageMenu(false);
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
                    setImageMenu(false);
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
                      setImageMenu(false);
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

        <button
          type="button"
          onClick={() => pdfInput.current?.click()}
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
        </button>
      </div>

      <UploadProgress phase={progress.phase} percent={progress.percent} fileName={progress.name} />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      {hint && <p className="mt-1 text-xs font-medium text-emerald-700">{hint}</p>}
    </div>
  );
}
