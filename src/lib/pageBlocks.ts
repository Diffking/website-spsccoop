/**
 * แปลงเนื้อหา HTML ของหน้าเนื้อหา ↔ "ก้อน" ที่เอาไปทำหน้าจอแก้ไขแบบไม่ต้องรู้โค้ดได้
 *
 * ทำไมต้องมี: เนื้อหาหน้าเว็บเก็บเป็น HTML ดิบ ซึ่งแก้ได้ก็ต่อเมื่ออ่านแท็กออก
 * ไฟล์นี้อ่าน HTML นั้นกลับมาเป็นรายการก้อน (หัวข้อ / ย่อหน้า / ตาราง / การ์ด PDF ฯลฯ)
 * ให้หน้าจอ EditUI เอาไปแสดงเป็นช่องกรอกทีละก้อน แล้วเขียนกลับเป็น HTML หน้าตาเดิม
 *
 * กฎเหล็กสองข้อ:
 *   1. **ห้ามทำเนื้อหาหาย** — อะไรที่อ่านไม่ออกเก็บเป็นก้อน "html" ทั้งดุ้น ไม่ใช่ทิ้ง
 *   2. **เขียนกลับให้เหมือนที่แถบเครื่องมือเขียน** — คนที่สลับไปดู EditCode ต้องเจอ
 *      โครงหน้าตาเดียวกับที่เคยเห็น ไม่ใช่ HTML คนละสำนัก
 *
 * ตรวจสองข้อนี้ด้วย scripts/roundtrip-check.mts — แปลงเนื้อหาจริงทุกหน้าไปกลับ
 * แล้วเทียบว่าตัวอักษรและจำนวนโครงเท่าเดิม แก้ไฟล์นี้เมื่อไหร่ให้รันซ้ำ
 *
 * ใช้ DOMParser จึงอ่านได้เฉพาะฝั่งเบราว์เซอร์ — ฝั่งเซิร์ฟเวอร์คืนก้อนว่าง
 * (EditUI อ่านเนื้อหาหลังหน้าโหลดเสร็จ ไม่ได้อ่านตอน render บนเซิร์ฟเวอร์)
 */

import { ALLOWED_CLASSES } from "@/lib/pageHtml";

export type ImageLayout = "" | "small" | "left" | "right" | "wide";

export type Card = {
  color: string;
  badge: string;
  title: string;
  sub: string;
  href: string;
};

export type Person = { src: string; name: string; role: string };

export type Tab = { title: string; blocks: Block[] };

export type Block =
  | { id: string; kind: "heading"; level: 2 | 3 | 4; html: string }
  | { id: string; kind: "paragraph"; html: string }
  | { id: string; kind: "list"; ordered: boolean; items: string[] }
  | { id: string; kind: "quote"; html: string }
  | { id: string; kind: "divider" }
  | { id: string; kind: "image"; src: string; alt: string; layout: ImageLayout; caption: string }
  | {
      id: string;
      kind: "imageRow";
      /** จำนวนรูปต่อแถว — ล็อกไว้ ทุกใบจึงกว้างเท่ากันเสมอ */
      cols: number;
      images: { src: string; alt: string; caption: string }[];
    }
  | { id: string; kind: "table"; head: string[]; rows: string[][] }
  | { id: string; kind: "pdfCard"; name: string; readHref: string; fileHref: string }
  | {
      id: string;
      kind: "pdfIcon";
      href: string;
      /** true = ไอคอนที่กดแล้วเปิดอ่านในเว็บ · false = กดแล้วโหลดไฟล์ทันที */
      read: boolean;
      color: string;
      size: number;
      label: string;
    }
  | { id: string; kind: "cards"; cols: number; cards: Card[] }
  | {
      id: string;
      kind: "people";
      cols: number;
      people: Person[];
      /**
       * ต้นฉบับเขียนแบบง่าย — <figure> เปล่า ๆ กับ <figcaption> ที่มีแต่ชื่อ
       * ไม่มี class="person" และไม่มี <span class="person-name">
       *
       * หน้าทำเนียบเก่าบางหน้าเขียนแบบนี้ (CSS รองรับทั้งสองแบบ) เขียนกลับให้เหมือนเดิม
       * เพื่อไม่ให้แค่เปิด EditUI แล้วชื่อบนหน้าเว็บกลายเป็นตัวหนาขึ้นมาเอง
       * — พอมีใครใส่ตำแหน่งให้สักคน ถึงค่อยเปลี่ยนไปใช้โครงเต็มที่รองรับตำแหน่ง
       */
      plain: boolean;
    }
  | { id: string; kind: "tabs"; tabs: Tab[] }
  | { id: string; kind: "html"; html: string };

export type BlockKind = Block["kind"];

/**
 * ชื่อของเนื้อหาแต่ละชนิด — ใช้บนแถบเครื่องมือและในเมนู "เพิ่มเนื้อหา"
 *
 * ตั้งชื่อด้วยคำที่เจ้าหน้าที่ใช้พูดกันจริง ไม่ใช่ศัพท์ของคนทำเว็บ
 * ("แท็ปเมนู" "การ์ดลิงก์" "ยกคำพูด" ไม่มีใครนอกวงการเข้าใจ)
 * และห้ามใช้คำเดียวกันสองความหมายในจอเดียว — "หัวข้อ" สงวนไว้ให้ heading เท่านั้น
 * หัวตารางเรียก "ชื่อคอลัมน์" ชื่อบนปุ่มแท็บเรียก "ชื่อหัวเรื่อง"
 */
export const BLOCK_LABEL: Record<BlockKind, string> = {
  heading: "หัวข้อ",
  paragraph: "ย่อหน้า",
  list: "รายการข้อ",
  quote: "ข้อความเน้น",
  divider: "เส้นคั่น",
  image: "รูปภาพ",
  imageRow: "รูปเรียงแถว + คำบรรยาย",
  table: "ตาราง",
  pdfCard: "ไฟล์ PDF แบบการ์ด",
  pdfIcon: "ไฟล์ PDF แบบไอคอน",
  cards: "การ์ดกดไปหน้าอื่น",
  people: "ทำเนียบรายชื่อ",
  tabs: "แท็บสลับหัวเรื่อง",
  html: "โค้ดที่ระบบอ่านไม่ออก",
};

/** อธิบายว่าแต่ละชนิดคืออะไร ด้วยภาษาที่ไม่ต้องรู้เรื่องเว็บก็เข้าใจ */
export const BLOCK_HINT: Record<BlockKind, string> = {
  heading: "ตัวหนังสือใหญ่ ไว้ขึ้นหัวเรื่องแต่ละตอน",
  paragraph: "ข้อความธรรมดาที่พิมพ์ต่อกันเป็นย่อหน้า",
  list: "รายการที่มีจุดหรือเลขนำหน้าทีละข้อ",
  quote: "ข้อความสำคัญ ใส่กรอบให้เด่นออกมาจากย่อหน้าอื่น",
  divider: "เส้นบาง ๆ ขวางหน้า ไว้แบ่งเรื่อง",
  image: "รูปหนึ่งใบ ใส่คำบรรยายใต้ภาพได้",
  imageRow: "รูปหลายใบ + คำบรรยายใต้แต่ละรูป เรียงเป็นแถว ขนาดเท่ากันทุกใบ",
  table: "ตารางมีช่อง มีเส้น เพิ่มแถวเพิ่มคอลัมน์ได้",
  pdfCard: "กล่องยาว ๆ มีชื่อไฟล์ กดเปิดอ่านหรือดาวน์โหลดได้",
  pdfIcon: "ไอคอนเล็ก ๆ อันเดียว เหมาะใส่ในช่องตาราง",
  cards: "กล่องสี่เหลี่ยมมีสี กดแล้วไปหน้าอื่นในเว็บ",
  people: "รูปคนพร้อมชื่อและตำแหน่ง เรียงเป็นตาราง",
  tabs: "ซ่อนเนื้อหาหลายชุดไว้ใต้ปุ่มกดสลับ",
  html: "ระบบแปลงเป็นช่องกรอกให้ไม่ได้ ต้องแก้เป็นโค้ด",
};

let seq = 0;
/** รหัสประจำก้อน — ใช้เป็น key ของ React เท่านั้น ไม่ได้บันทึกลงเนื้อหา */
export const blockId = () => `b${++seq}`;

/* ------------------------------------------------------------------ *
 * ข้อความในบรรทัด
 * ------------------------------------------------------------------ */

/** แท็กที่ยอมให้อยู่ในข้อความ — นอกจากนี้ตัดเหลือแต่ข้อความ */
const INLINE_OK = new Set(["strong", "em", "u", "a", "br", "span", "img"]);

/**
 * แอตทริบิวต์ที่เก็บไว้ของแต่ละแท็ก — ต้องครอบคลุมของที่ระบบใส่เอง ไม่ใช่แค่ของที่คนพิมพ์
 *
 * ที่สำคัญที่สุดคือ class/style ของ <a> — ไอคอน PDF ในตารางหน้าดาวน์โหลดเป็น
 * <a class="pdf-icon gray" style="--pdf-size:30px"> ทั้งดุ้น ตัด class ทิ้งเมื่อไหร่
 * ไอคอนหายจากหน้าเว็บทันทีแค่เพราะมีคนคลิกเข้าไปในช่องนั้นแล้วคลิกออก
 */
const INLINE_ATTRS: Record<string, string[]> = {
  a: ["href", "class", "style", "target", "rel", "title", "aria-label", "download"],
  span: ["class"],
  img: ["src", "alt", "width", "height"],
};

/** ค่า style เดียวที่ยอมให้เหลือ — ขนาดไอคอน PDF (ตรงกับ limitInlineStyles ฝั่งเซิร์ฟเวอร์) */
const PDF_SIZE = /^\s*--pdf-size:\s*(\d{1,3})px\s*;?\s*$/;

/**
 * ล้าง HTML ในบรรทัดให้เหลือเฉพาะที่ยอมรับได้
 *
 * ช่องพิมพ์ของ EditUI เป็น contentEditable ซึ่งเบราว์เซอร์ชอบใส่ <b> <i> <font>
 * หรือ style ติดมาเวลาวางข้อความจาก Word — ล้างตรงนี้ทีเดียว ทั้งตอนพิมพ์และตอนวาง
 *
 * ล้างแบบ "เก็บของที่รู้จัก" ไม่ใช่ "ตัดทุกอย่างที่ไม่ใช่ข้อความ" — ในช่องหนึ่งช่อง
 * (เช่นช่องในตาราง) มีของที่ระบบสร้างไว้ปนอยู่ได้ และมันต้องรอดจากการที่คนเข้าไปแก้ข้างๆ
 */
export function cleanInline(html: string): string {
  if (typeof DOMParser === "undefined") return html;
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstElementChild;
  if (!root) return "";

  const walk = (node: Element) => {
    for (const child of Array.from(node.children)) {
      walk(child);
      const tag = child.tagName.toLowerCase();
      // b/i ที่เบราว์เซอร์ใส่มา = ความหมายเดียวกับ strong/em ที่เว็บนี้ใช้
      const same = tag === "b" ? "strong" : tag === "i" ? "em" : tag;

      if (!INLINE_OK.has(same)) {
        child.replaceWith(...Array.from(child.childNodes));
        continue;
      }

      const keep = INLINE_ATTRS[same] ?? [];
      for (const attr of Array.from(child.attributes)) {
        const name = attr.name.toLowerCase();
        if (!keep.includes(name)) {
          child.removeAttribute(attr.name);
          continue;
        }
        // class/style ยังต้องกรองค่าอีกชั้น เผื่อของที่ก๊อปมาจากเว็บอื่นพ่วง class มาด้วย
        if (name === "class") {
          const kept = attr.value.split(/\s+/).filter((c) => ALLOWED_CLASSES.has(c));
          if (kept.length > 0) child.setAttribute("class", kept.join(" "));
          else child.removeAttribute("class");
        }
        if (name === "style") {
          const size = PDF_SIZE.exec(attr.value);
          if (size) child.setAttribute("style", `--pdf-size:${size[1]}px`);
          else child.removeAttribute("style");
        }
      }

      if (same !== tag) {
        const swap = doc.createElement(same);
        for (const attr of Array.from(child.attributes)) swap.setAttribute(attr.name, attr.value);
        swap.append(...Array.from(child.childNodes));
        child.replaceWith(swap);
      }
    }
  };

  walk(root);
  return root.innerHTML.replace(/\s+/g, " ").trim();
}

/** ข้อความล้วนของก้อน — ใช้ดูว่าก้อนว่างไหม และทำคำโปรยบนหัวก้อนที่ยุบอยู่ */
export function plainText(html: string): string {
  if (typeof DOMParser === "undefined") return html.replace(/<[^>]*>/g, "");
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  return (doc.body.textContent ?? "").replace(/\s+/g, " ").trim();
}

const escapeAttr = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

/* ------------------------------------------------------------------ *
 * HTML -> ก้อน
 * ------------------------------------------------------------------ */

const classOf = (el: Element) => el.getAttribute("class") ?? "";
const has = (el: Element, name: string) => el.classList.contains(name);

/** จำนวนคอลัมน์จาก class cols-N — ไม่มีก็ใช้ค่าที่ให้มา */
function colsOf(el: Element, fallback: number): number {
  const found = /\bcols-(\d)\b/.exec(classOf(el));
  return found ? Number(found[1]) : fallback;
}

function imageOf(figure: Element): Block {
  const img = figure.querySelector("img");
  const layout = (["small", "left", "right", "wide"] as const).find((c) => has(figure, c)) ?? "";
  return {
    id: blockId(),
    kind: "image",
    src: img?.getAttribute("src") ?? "",
    alt: img?.getAttribute("alt") ?? "",
    layout,
    caption: figure.querySelector("figcaption")?.innerHTML.trim() ?? "",
  };
}

function tableOf(table: Element): Block {
  const rows = Array.from(table.querySelectorAll("tr"));
  const cellsOf = (tr: Element) => Array.from(tr.children).map((c) => c.innerHTML.trim());

  // แถวหัวตาราง = แถวใน <thead> หรือแถวแรกที่เป็น <th> ล้วน
  const headRow = rows.find(
    (tr) =>
      tr.closest("thead") ||
      (tr.children.length > 0 && Array.from(tr.children).every((c) => c.tagName === "TH")),
  );
  const body = rows.filter((tr) => tr !== headRow);

  return {
    id: blockId(),
    kind: "table",
    head: headRow ? cellsOf(headRow) : [],
    rows: body.map(cellsOf),
  };
}

function peopleOf(el: Element): Block {
  const figures = Array.from(el.querySelectorAll(":scope > figure"));

  return {
    id: blockId(),
    kind: "people",
    cols: colsOf(el, 3),
    plain: figures.length > 0 && !el.querySelector(".person-name"),
    people: figures.map((figure) => {
      const name = figure.querySelector(".person-name");
      const role = figure.querySelector(".person-role");
      return {
        src: figure.querySelector("img")?.getAttribute("src") ?? "",
        // ไม่มี span ชื่อ = ทั้ง figcaption คือชื่อ (หน้าทำเนียบที่ปรึกษาเขียนแบบนี้)
        name: (name ?? figure.querySelector("figcaption"))?.textContent?.trim() ?? "",
        role: role?.textContent?.trim() ?? "",
      };
    }),
  };
}

function elementToBlock(el: Element): Block {
  const tag = el.tagName.toLowerCase();

  if (tag === "h2" || tag === "h3" || tag === "h4") {
    return {
      id: blockId(),
      kind: "heading",
      level: Number(tag[1]) as 2 | 3 | 4,
      html: el.innerHTML.trim(),
    };
  }
  if (tag === "p") return { id: blockId(), kind: "paragraph", html: el.innerHTML.trim() };
  if (tag === "blockquote") return { id: blockId(), kind: "quote", html: el.innerHTML.trim() };
  if (tag === "hr") return { id: blockId(), kind: "divider" };

  if (tag === "ul" || tag === "ol") {
    return {
      id: blockId(),
      kind: "list",
      ordered: tag === "ol",
      items: Array.from(el.querySelectorAll(":scope > li")).map((li) => li.innerHTML.trim()),
    };
  }

  if (tag === "table") return tableOf(el);
  if (tag === "figure" && !has(el, "person")) return imageOf(el);

  if (tag === "a" && has(el, "pdf-icon")) {
    const size = /--pdf-size:\s*(\d+)px/.exec(el.getAttribute("style") ?? "");
    const color = ["blue", "green", "amber", "purple", "gray"].find((c) => has(el, c)) ?? "";
    return {
      id: blockId(),
      kind: "pdfIcon",
      href: el.getAttribute("href") ?? "",
      read: has(el, "read"),
      color,
      size: size ? Number(size[1]) : 50,
      label: el.getAttribute("title") ?? "",
    };
  }

  if (tag === "div") {
    if (has(el, "ebook")) {
      const links = Array.from(el.querySelectorAll(":scope > a"));
      const read = links.find((a) => (a.getAttribute("href") ?? "").startsWith("/read"));
      const file = links.find((a) => a !== read);
      return {
        id: blockId(),
        kind: "pdfCard",
        name: el.querySelector(".ebook-name")?.textContent?.trim() ?? "",
        readHref: read?.getAttribute("href") ?? "",
        fileHref: file?.getAttribute("href") ?? "",
      };
    }

    if (has(el, "image-row")) {
      // อ่านทีละ <figure> ไม่ใช่ทีละ <img> — คำบรรยายอยู่ใน figcaption ของ figure นั้น
      const figures = Array.from(el.querySelectorAll("figure"));
      const list = figures.length > 0 ? figures : Array.from(el.querySelectorAll("img"));
      return {
        id: blockId(),
        kind: "imageRow",
        cols: colsOf(el, 3),
        images: list.map((node) => {
          const img = node.tagName === "IMG" ? node : node.querySelector("img");
          return {
            src: img?.getAttribute("src") ?? "",
            alt: img?.getAttribute("alt") ?? "",
            caption: node.querySelector?.("figcaption")?.innerHTML.trim() ?? "",
          };
        }),
      };
    }

    if (has(el, "cards")) {
      return {
        id: blockId(),
        kind: "cards",
        cols: colsOf(el, 3),
        cards: Array.from(el.querySelectorAll(":scope > a")).map((a) => ({
          color:
            ["blue", "green", "amber", "pink", "purple", "teal"].find((c) =>
              a.classList.contains(c),
            ) ?? "blue",
          badge: a.querySelector(".card-badge")?.textContent?.trim() ?? "",
          title: a.querySelector(".card-title")?.textContent?.trim() ?? "",
          sub: a.querySelector(".card-sub")?.textContent?.trim() ?? "",
          href: a.getAttribute("href") ?? "#",
        })),
      };
    }

    if (has(el, "people")) return peopleOf(el);

    if (has(el, "tabs")) {
      return {
        id: blockId(),
        kind: "tabs",
        tabs: Array.from(el.querySelectorAll(":scope > .tab")).map((tab, i) => ({
          title: tab.getAttribute("data-title") || `หัวเรื่องที่ ${i + 1}`,
          blocks: nodesToBlocks(Array.from(tab.childNodes)),
        })),
      };
    }
  }

  // อ่านไม่ออกก็เก็บทั้งดุ้น ดีกว่าทำเนื้อหาหาย
  return { id: blockId(), kind: "html", html: el.outerHTML };
}

function nodesToBlocks(nodes: ChildNode[]): Block[] {
  const out: Block[] = [];
  for (const node of nodes) {
    // ข้อความลอย ๆ นอกแท็ก — ห่อเป็นย่อหน้าให้ ไม่ใช่ทิ้ง
    if (node.nodeType === 3) {
      const text = (node.textContent ?? "").trim();
      if (text) out.push({ id: blockId(), kind: "paragraph", html: text });
      continue;
    }
    // หมายเหตุในโค้ด (<!-- ... -->) เป็นคำแนะนำที่แถบเครื่องมือใส่ไว้ ไม่ใช่เนื้อหา
    if (node.nodeType === 8) continue;
    if (node.nodeType === 1) out.push(elementToBlock(node as Element));
  }
  return out;
}

/** อ่านเนื้อหา HTML เป็นรายการก้อน — ฝั่งเซิร์ฟเวอร์คืนก้อนว่าง */
export function htmlToBlocks(html: string): Block[] {
  if (typeof DOMParser === "undefined") return [];
  const doc = new DOMParser().parseFromString(html, "text/html");
  return nodesToBlocks(Array.from(doc.body.childNodes));
}

/* ------------------------------------------------------------------ *
 * ก้อน -> HTML
 *
 * ทุกก้อนลูกคั่นด้วยขึ้นบรรทัดใหม่เสมอ ไม่ใช่ต่อกันติด — นอกจากจะได้โครงหน้าตาเดียวกับ
 * ที่แถบเครื่องมือเขียนแล้ว ข้อความสองก้อนที่ติดกันสนิทจะกลายเป็นคำเดียวกันตอนก๊อป
 * ไปวาง หรือตอนโปรแกรมอ่านหน้าจออ่านออกเสียงให้คนตาบอด
 * ------------------------------------------------------------------ */

const NL = "\n";

function blockToHtml(block: Block): string {
  switch (block.kind) {
    case "heading":
      return `<h${block.level}>${block.html}</h${block.level}>`;
    case "paragraph":
      return `<p>${block.html}</p>`;
    case "quote":
      return `<blockquote>${block.html}</blockquote>`;
    case "divider":
      return "<hr>";

    case "list": {
      const tag = block.ordered ? "ol" : "ul";
      const items = block.items.map((i) => `  <li>${i}</li>`).join(NL);
      return `<${tag}>${NL}${items}${NL}</${tag}>`;
    }

    case "image": {
      const cls = block.layout ? ` class="${block.layout}"` : "";
      const img = `  <img src="${escapeAttr(block.src)}" alt="${escapeAttr(block.alt)}">`;
      const caption = block.caption.trim()
        ? `${NL}  <figcaption>${block.caption}</figcaption>`
        : "";
      return `<figure${cls}>${NL}${img}${caption}${NL}</figure>`;
    }

    case "imageRow": {
      const figures = block.images
        .map((i) => {
          const img = `<img src="${escapeAttr(i.src)}" alt="${escapeAttr(i.alt)}">`;
          const caption = i.caption ? `<figcaption>${i.caption}</figcaption>` : "";
          return `  <figure>${img}${caption}</figure>`;
        })
        .join(NL);
      return `<div class="image-row cols-${block.cols}">${NL}${figures}${NL}</div>`;
    }

    case "table": {
      const cells = block.head.map((c) => `<th>${c}</th>`).join("");
      const head = block.head.length
        ? `  <thead>${NL}    <tr>${cells}</tr>${NL}  </thead>${NL}`
        : "";
      const body = block.rows
        .map((r) => `    <tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`)
        .join(NL);
      return `<table>${NL}${head}  <tbody>${NL}${body}${NL}  </tbody>${NL}</table>`;
    }

    case "pdfCard": {
      const read = block.readHref
        ? `  <a href="${escapeAttr(block.readHref)}">เปิดอ่านแบบ E-Book</a>${NL}`
        : "";
      const file = block.fileHref
        ? `  <a href="${escapeAttr(block.fileHref)}">ดาวน์โหลด PDF</a>${NL}`
        : "";
      return (
        `<div class="ebook">${NL}` +
        `  <span class="ebook-name">${block.name}</span>${NL}` +
        read +
        file +
        "</div>"
      );
    }

    case "pdfIcon": {
      const cls = `pdf-icon${block.read ? " read" : ""}${block.color ? ` ${block.color}` : ""}`;
      const label = escapeAttr(block.label);
      return (
        `<a class="${cls}" style="--pdf-size:${block.size}px" href="${escapeAttr(block.href)}"` +
        (block.read ? "" : " download") +
        (label ? ` title="${label}" aria-label="${label}"` : "") +
        "></a>"
      );
    }

    case "cards": {
      const card = (c: Card) =>
        `  <a class="card ${c.color}" href="${escapeAttr(c.href || "#")}">${NL}` +
        (c.badge ? `    <span class="card-badge">${c.badge}</span>${NL}` : "") +
        `    <span class="card-text">${NL}` +
        `      <span class="card-title">${c.title}</span>${NL}` +
        (c.sub ? `      <span class="card-sub">${c.sub}</span>${NL}` : "") +
        `    </span>${NL}  </a>`;

      const list = block.cards.map(card).join(NL);
      return `<div class="cards cols-${block.cols}">${NL}${list}${NL}</div>`;
    }

    case "people": {
      /*
       * ต้นฉบับเขียนแบบง่ายและยังไม่มีใครมีตำแหน่ง = เขียนกลับแบบง่ายเหมือนเดิม
       * ไม่งั้นแค่เปิด EditUI แล้วแก้ก้อนอื่น ชื่อบนหน้าเว็บจะกลายเป็นตัวหนาขึ้นมาเอง
       */
      const plain = block.plain && block.people.every((p) => !p.role.trim());

      const caption = (p: Person) =>
        plain
          ? `    <figcaption>${p.name}</figcaption>${NL}`
          : `    <figcaption>${NL}` +
            `      <span class="person-name">${p.name}</span>${NL}` +
            (p.role ? `      <span class="person-role">${p.role}</span>${NL}` : "") +
            `    </figcaption>${NL}`;

      const figure = (p: Person) =>
        (plain ? `  <figure>${NL}` : `  <figure class="person">${NL}`) +
        `    <img src="${escapeAttr(p.src)}" alt="${escapeAttr(p.name)}">${NL}` +
        caption(p) +
        "  </figure>";

      const list = block.people.map(figure).join(NL);
      return `<div class="people cols-${block.cols}">${NL}${list}${NL}</div>`;
    }

    case "tabs": {
      const tab = (t: Tab) =>
        `  <div class="tab" data-title="${escapeAttr(t.title)}">${NL}` +
        t.blocks.map(blockToHtml).join(NL) +
        `${NL}  </div>`;

      const list = block.tabs.map(tab).join(NL);
      return `<div class="tabs">${NL}${list}${NL}</div>`;
    }

    case "html":
      return block.html;
  }
}

/** เขียนรายการก้อนกลับเป็น HTML — จัดย่อหน้าให้อีกทีตอนบันทึกที่ PageEditor */
export function blocksToHtml(blocks: Block[]): string {
  return blocks.map(blockToHtml).join(NL);
}

/* ------------------------------------------------------------------ *
 * ก้อนเปล่าสำหรับปุ่ม "เพิ่ม"
 * ------------------------------------------------------------------ */

export function emptyBlock(kind: BlockKind): Block {
  const id = blockId();
  switch (kind) {
    case "heading":
      return { id, kind, level: 2, html: "" };
    case "paragraph":
    case "quote":
      return { id, kind, html: "" };
    case "divider":
      return { id, kind };
    case "list":
      return { id, kind, ordered: false, items: ["", ""] };
    case "image":
      return { id, kind, src: "", alt: "", layout: "", caption: "" };
    case "imageRow":
      return { id, kind, cols: 3, images: [] };
    case "table":
      return { id, kind, head: ["ชื่อคอลัมน์ 1", "ชื่อคอลัมน์ 2"], rows: [["", ""]] };
    case "pdfCard":
      return { id, kind, name: "", readHref: "", fileHref: "" };
    case "pdfIcon":
      return { id, kind, href: "", read: true, color: "", size: 50, label: "" };
    case "cards":
      return {
        id,
        kind,
        cols: 3,
        cards: [{ color: "blue", badge: "", title: "ชื่อหัวข้อ", sub: "", href: "#" }],
      };
    case "people":
      // คนที่เพิ่มใหม่ใช้โครงเต็มเสมอ จะได้ใส่ตำแหน่งได้
      return { id, kind, cols: 3, people: [], plain: false };
    case "tabs":
      return {
        id,
        kind,
        tabs: [
          { title: "หัวเรื่องที่ 1", blocks: [{ id: blockId(), kind: "paragraph", html: "" }] },
          { title: "หัวเรื่องที่ 2", blocks: [{ id: blockId(), kind: "paragraph", html: "" }] },
        ],
      };
    case "html":
      return { id, kind, html: "" };
  }
}

/** ก้อนที่กด "เพิ่ม" ได้จากเมนู — เรียงตามที่ใช้บ่อย ก้อนโค้ดอยู่ท้ายสุด */
export const ADDABLE: BlockKind[] = [
  "heading",
  "paragraph",
  "list",
  "table",
  "image",
  "pdfCard",
  "cards",
  "quote",
  "divider",
  "people",
  "tabs",
  "html",
];
