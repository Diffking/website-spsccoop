/**
 * จัดย่อหน้าโค้ด HTML ของหน้าเนื้อหาให้อ่านง่าย
 *
 * เนื้อหาพิมพ์เป็น HTML ดิบ พอแก้ไปมา ก๊อปวางจากที่อื่น หรือให้ AI จัดให้
 * ย่อหน้าจะเละ — บางบรรทัดยาวเป็นกิโล บางก้อนไม่มีย่อหน้าเลย หาที่จะแก้ไม่เจอ
 *
 * ตัวนี้จัดใหม่ให้เป็นระเบียบเดียวกันทั้งหน้า: แท็กที่เป็นก้อน (div/p/li/…)
 * ขึ้นบรรทัดใหม่และย่อหน้าตามชั้น ส่วนแท็กในบรรทัด (strong/em/a ที่แทรกในข้อความ)
 * ยังอยู่ติดกับข้อความเหมือนเดิม ไม่ถูกดันขึ้นบรรทัดจนอ่านประโยคไม่รู้เรื่อง
 *
 * ทำงานกับข้อความล้วน ไม่ใช้ DOM — เรียกได้ทั้งฝั่ง client และ server
 */

/** แท็กที่ไม่มีตัวปิด */
const VOID_TAGS = new Set(["br", "hr", "img", "input", "meta", "link"]);

/** แท็กที่ถือเป็น "ก้อน" — ขึ้นบรรทัดใหม่เสมอ */
const BLOCK_TAGS = new Set([
  "div", "p", "h1", "h2", "h3", "h4", "ul", "ol", "li", "table", "thead", "tbody",
  "tr", "th", "td", "figure", "figcaption", "blockquote", "hr", "section", "article",
]);

const INDENT = "  ";

type Node =
  | { kind: "text"; text: string }
  | { kind: "comment"; text: string }
  | { kind: "tag"; name: string; open: string; children: Node[]; void: boolean };

/** อ่าน HTML เป็นต้นไม้แบบง่าย — แท็กปิดที่ไม่มีคู่จะถูกข้ามไปเฉย ๆ */
function parse(html: string): Node[] {
  const root: Node[] = [];
  const stack: Node[][] = [root];
  const open: { name: string }[] = [];
  const token = /<!--[\s\S]*?-->|<\/([a-zA-Z][\w-]*)\s*>|<([a-zA-Z][\w-]*)\b[^>]*>/g;

  let last = 0;
  let match: RegExpExecArray | null;

  const push = (node: Node) => stack[stack.length - 1].push(node);
  const text = (raw: string) => {
    if (raw.trim()) push({ kind: "text", text: raw.replace(/\s+/g, " ").trim() });
  };

  while ((match = token.exec(html)) !== null) {
    text(html.slice(last, match.index));
    last = match.index + match[0].length;

    if (match[0].startsWith("<!--")) {
      push({ kind: "comment", text: match[0] });
      continue;
    }

    if (match[1]) {
      // แท็กปิด — ปิดขึ้นไปจนเจอตัวเปิดที่ชื่อตรงกัน ไม่เจอก็ทิ้งไป
      const name = match[1].toLowerCase();
      const at = open.map((o) => o.name).lastIndexOf(name);
      if (at >= 0) {
        while (open.length > at) {
          open.pop();
          stack.pop();
        }
      }
      continue;
    }

    const name = (match[2] ?? "").toLowerCase();
    const isVoid = VOID_TAGS.has(name) || match[0].endsWith("/>");
    const node: Node = { kind: "tag", name, open: match[0], children: [], void: isVoid };
    push(node);

    if (!isVoid) {
      open.push({ name });
      stack.push(node.children);
    }
  }
  text(html.slice(last));

  return root;
}

const isBlock = (node: Node) => node.kind === "tag" && BLOCK_TAGS.has(node.name);

/** เขียนต้นไม้กลับเป็นข้อความ */
function print(nodes: Node[], depth: number): string {
  const pad = INDENT.repeat(depth);
  const lines: string[] = [];

  for (const node of nodes) {
    if (node.kind === "text") {
      lines.push(pad + node.text);
      continue;
    }
    if (node.kind === "comment") {
      lines.push(pad + node.text);
      continue;
    }
    if (node.void) {
      lines.push(pad + node.open);
      continue;
    }

    const close = `</${node.name}>`;
    const kids = node.children;

    /*
     * อยู่บรรทัดเดียวได้เมื่อข้างในเป็นข้อความล้วน ๆ หรือข้อความปนแท็กในบรรทัด
     * (เช่น <p>ข้อความ <strong>เน้น</strong> ต่อ</p>) — ดันขึ้นบรรทัดใหม่แล้วอ่านไม่รู้เรื่อง
     * แต่ถ้าข้างในมีแต่แท็กหลายตัวไม่มีข้อความคั่น ให้แยกบรรทัดละตัวจะอ่านง่ายกว่า
     */
    const hasText = kids.some((k) => k.kind === "text");
    const elements = kids.filter((k) => k.kind === "tag").length;
    const inlineOnly = kids.every((k) => !isBlock(k) && k.kind !== "comment");

    if (kids.length === 0) {
      lines.push(pad + node.open + close);
    } else if (inlineOnly && (hasText || elements <= 1)) {
      lines.push(pad + node.open + flat(kids) + close);
    } else {
      lines.push(pad + node.open);
      lines.push(print(kids, depth + 1));
      lines.push(pad + close);
    }
  }

  return lines.join("\n");
}

/** เขียนลูกทั้งหมดต่อกันในบรรทัดเดียว (ใช้กับเนื้อในที่เป็นข้อความ) */
function flat(nodes: Node[]): string {
  return nodes
    .map((node) => {
      if (node.kind === "text") return node.text;
      if (node.kind === "comment") return node.text;
      if (node.void) return node.open;
      return node.open + flat(node.children) + `</${node.name}>`;
    })
    .join(" ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

/** ข้อความล้วนไว้เทียบก่อน-หลัง ว่าจัดแล้วเนื้อหาไม่หายไปไหน */
const textOnly = (html: string) =>
  html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * จัดย่อหน้าให้ทั้งก้อน — จัดแล้วเนื้อหาเปลี่ยนเมื่อไหร่ คืนของเดิมทันที
 *
 * ด่านเทียบข้อความนี้สำคัญ: เนื้อหาคือประกาศและระเบียบของสหกรณ์
 * ยอมให้ย่อหน้าไม่สวยดีกว่าปล่อยให้ตัวจัดหน้าไปกินข้อความหายโดยไม่มีใครรู้
 */
export function prettyHtml(html: string): string {
  if (!html.trim()) return html;

  try {
    const out = print(parse(html), 0).replace(/\n{3,}/g, "\n\n").trim();
    return textOnly(out) === textOnly(html) ? `${out}\n` : html;
  } catch {
    return html;
  }
}
