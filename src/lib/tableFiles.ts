/**
 * โยนไฟล์ลงตารางเอกสารใน EditUI — ตรรกะล้วน ไม่แตะ React
 *
 * ตารางดาวน์โหลดในเว็บนี้หน้าตาเหมือนกันเกือบหมด: ช่องเลขลำดับ · ชื่อรายการ · ไอคอน PDF
 * โยนไฟล์เข้ามาแล้วระบบต้องเดาให้ได้ว่าช่องไหนคืออะไร ไอคอนต้องหน้าตาแบบไหน
 * และชื่อรายการควรเขียนว่าอะไร — โดย**ดูจากแถวที่มีอยู่แล้ว** ไม่ใช่จากค่าที่ฝังไว้
 *
 * ตารางที่ทำมาเพื่อสิ่งนี้คือ "รายการย่อแสดงสินทรัพย์และหนี้สิน" (เพิ่มเดือนละแถว)
 * เจ้าของเว็บขอไว้ 2 ต.ค. 2569 · ชื่อที่เดาให้เป็นแค่ค่าตั้งต้น หน้าจอติดป้าย "ตรวจชื่อ" ไว้เสมอ
 */

const FULL = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];
const ABBR = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// ชื่อเต็มก่อนชื่อย่อ — ไม่งั้นบางชื่อจะตรงแค่ครึ่งเดียว
const MONTH_RE = new RegExp(
  `(\\d{1,2})\\s*(${[...FULL, ...ABBR].map(esc).join("|")})\\s*(\\d{4})`,
);

export type ThaiDate = { day: number; month: number; year: number; abbr: boolean };

/** หาวันที่แบบไทย (30 มิ.ย. 2569 · 30 มิถุนายน 2569) ตัวแรกในข้อความ */
export function findThaiDate(text: string): (ThaiDate & { match: string }) | null {
  const m = MONTH_RE.exec(text);
  if (!m) return null;
  const full = FULL.indexOf(m[2]);
  return {
    day: Number(m[1]),
    month: full >= 0 ? full : ABBR.indexOf(m[2]),
    year: Number(m[3]),
    abbr: full < 0,
    match: m[0],
  };
}

export function formatThaiDate(d: ThaiDate): string {
  return `${d.day} ${(d.abbr ? ABBR : FULL)[d.month]} ${d.year}`;
}

/** วันสุดท้ายของเดือน — ปีที่เกิน 2400 ถือเป็น พ.ศ. แปลงก่อนเช็คปีอธิกสุรทิน */
function lastDay(year: number, month: number) {
  const ce = year > 2400 ? year - 543 : year;
  return new Date(Date.UTC(ce, month + 1, 0)).getUTCDate();
}

/** สิ้นเดือนถัดไป — 30 มิ.ย. → 31 ก.ค. · 31 ม.ค. → 28/29 ก.พ. */
export function nextMonthEnd(d: ThaiDate): ThaiDate {
  const month = (d.month + 1) % 12;
  const year = d.month === 11 ? d.year + 1 : d.year;
  return { day: lastDay(year, month), month, year, abbr: d.abbr };
}

const dayValue = (d: ThaiDate) => d.year * 10000 + d.month * 100 + d.day;

export const plainText = (html: string) =>
  html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .trim();

export const escHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = (s: string) => escHtml(s).replace(/"/g, "&quot;");

/** เลขลำดับท้ายช่อง — "1." · "<span class="badge pink">New</span> 1." */
const NUMBER_AT_END = /(\d+)(\.?)(\s*)$/;
const PDF_ICON = /<a\b[^>]*class="[^"]*\bpdf-icon\b[^"]*"[^>]*>\s*<\/a>/i;

export type TableShape = {
  /** ช่องเลขลำดับ · -1 = ตารางนี้ไม่มีเลขลำดับ */
  numCol: number;
  /** ช่องชื่อรายการ */
  nameCol: number;
  /** ช่องที่วางไอคอน PDF */
  fileCol: number;
  /** แท็ก <a> ของไอคอนที่มีอยู่แล้ว — ใช้เป็นแบบ · null = ยังไม่มีเลย */
  icon: string | null;
  /** แถวใหม่ไปไว้ไหน — ดูจากวันที่ของแถวเดิมว่าเรียงใหม่→เก่า หรือเก่า→ใหม่ */
  atTop: boolean;
  /** วันที่ของแถวที่ใหม่ที่สุด และชื่อรายการของแถวนั้น (ไว้เป็นแบบชื่อ) */
  latest: { date: ThaiDate & { match: string }; name: string } | null;
};

export function readShape(head: string[], rows: string[][]): TableShape {
  const cols = Math.max(head.length, ...rows.map((r) => r.length), 1);
  const filled = rows.filter((r) => r.some((c) => plainText(c) || PDF_ICON.test(c)));

  // ช่องไอคอน = ช่องที่มีไอคอน PDF มากที่สุด · ไม่มีเลย = ช่องขวาสุด
  let fileCol = cols - 1;
  let most = 0;
  for (let c = 0; c < cols; c++) {
    const n = filled.filter((r) => PDF_ICON.test(r[c] ?? "")).length;
    if (n > most) [most, fileCol] = [n, c];
  }
  const icon = filled.map((r) => PDF_ICON.exec(r[fileCol] ?? "")?.[0]).find(Boolean) ?? null;

  // ช่องเลขลำดับ = ช่องแรก ถ้าเกินครึ่งของแถวลงท้ายด้วยตัวเลขสั้น ๆ
  const numbered =
    cols > 1 &&
    fileCol !== 0 &&
    filled.length > 0 &&
    filled.filter((r) => {
      const t = plainText(r[0] ?? "");
      return t.length <= 12 && NUMBER_AT_END.test(t);
    }).length *
      2 >=
      filled.length;
  const numCol = numbered ? 0 : -1;

  // ช่องชื่อ = ช่องที่เหลือซึ่งตัวหนังสือยาวที่สุด
  let nameCol = -1;
  let longest = -1;
  for (let c = 0; c < cols; c++) {
    if (c === numCol || c === fileCol) continue;
    const len = filled.reduce((s, r) => s + plainText(r[c] ?? "").length, 0);
    if (len > longest) [longest, nameCol] = [len, c];
  }
  if (nameCol < 0) nameCol = fileCol === 0 ? Math.min(1, cols - 1) : 0;

  const dated = filled
    .map((r) => ({ name: r[nameCol] ?? "", date: findThaiDate(plainText(r[nameCol] ?? "")) }))
    .filter((x): x is { name: string; date: ThaiDate & { match: string } } => x.date !== null);

  // เทียบแถวแรกที่มีวันที่กับแถวสุดท้ายที่มีวันที่ — เก่าอยู่บน = ต่อท้าย · ไม่รู้ = ขึ้นบนสุด
  const asc = dated.length >= 2 && dayValue(dated[0].date) < dayValue(dated[dated.length - 1].date);
  const latest = dated.length === 0 ? null : asc ? dated[dated.length - 1] : dated[0];

  return { numCol, nameCol, fileCol, icon, atTop: !asc, latest };
}

/** ไอคอนใหม่หน้าตาเดียวกับไอคอนที่มีอยู่ — สี ขนาด และแบบ (โหลดตรง/เปิดอ่าน) */
export function iconFor(template: string | null, url: string, fileName: string): string {
  const cls = /class="([^"]*)"/.exec(template ?? "")?.[1] ?? "pdf-icon";
  // ขนาดต้องเท่าไอคอนเดิมเป๊ะ ไอคอนเดิมไม่ได้ตั้งขนาด = อันใหม่ก็ไม่ตั้ง ไม่งั้นแถวสูงไม่เท่ากัน
  // (เจอจริง 2 ต.ค. 2569) · ตารางที่ยังไม่มีไอคอนเลยถึงใช้ 30px ตามค่าตั้งต้นของแถบเครื่องมือ
  const style = template ? /style="([^"]*)"/.exec(template)?.[1] ?? "" : "--pdf-size:30px";
  const read = /href="\/read\//.test(template ?? "") || /\bread\b/.test(cls);
  const name = escAttr(fileName);

  if (read) {
    const href = `/read/?src=${encodeURIComponent(url)}&title=${encodeURIComponent(fileName)}`;
    return (
      `<a class="${cls}"${style ? ` style="${style}"` : ""} href="${escAttr(href)}" ` +
      `title="เปิดอ่าน ${name}" aria-label="เปิดอ่านแบบ E-Book ${name}"></a>`
    );
  }
  return (
    `<a class="${cls}"${style ? ` style="${style}"` : ""} href="${escAttr(url)}" download ` +
    `title="${name}" aria-label="ดาวน์โหลด ${name}"></a>`
  );
}

/** ใส่ไอคอนลงช่องเดิม — มีไอคอนอยู่แล้วเอาอันใหม่ไปแทน ข้อความอื่นในช่องคงไว้ */
export function putIcon(cell: string, icon: string): string {
  return PDF_ICON.test(cell) ? cell.replace(PDF_ICON, icon) : cell.trim() ? `${cell} ${icon}` : icon;
}

/** ชื่อไฟล์ที่ไม่มีนามสกุลและเลขนำหน้า — "01รายการย่อ….pdf" → "รายการย่อ…" */
export function nameFromFile(fileName: string): string {
  const bare = fileName.replace(/\.[^.]+$/, "");
  return bare.replace(/^[\d\s._-]+/, "").trim() || bare;
}

/**
 * ชื่อรายการของไฟล์ใหม่
 *
 * วันที่: เอาจากชื่อไฟล์ก่อน (เช่น "…31 กรกฎาคม 2569.pdf") ไม่มีค่อยเดาเป็นสิ้นเดือนถัดจากแถวล่าสุด
 * ถ้อยคำ: ลอกจากแถวล่าสุดแล้วเปลี่ยนแค่วันที่ — เขียนย่อหรือเต็มตามแบบของแถวเดิม
 * ตารางที่ชื่อรายการไม่มีวันที่เลย = ใช้ชื่อไฟล์ไปเลย
 */
export function guessName(
  latest: TableShape["latest"],
  fileName: string,
): { name: string; date: ThaiDate & { match: string } } | { name: string; date: null } {
  if (!latest) return { name: escHtml(nameFromFile(fileName)), date: null };
  const fromFile = findThaiDate(fileName);
  const date = fromFile ? { ...fromFile, abbr: latest.date.abbr } : nextMonthEnd(latest.date);
  const text = formatThaiDate(date);
  return {
    name: latest.name.replace(latest.date.match, text),
    date: { ...date, match: text },
  };
}

/**
 * ชื่อรายการจากวันที่ที่ AI อ่านได้ในเอกสาร (YYYY-MM-DD ค.ศ.)
 *
 * ลอกถ้อยคำจากแถวล่าสุดแล้วเปลี่ยนแค่วันที่ — แน่นอนกว่าให้ AI เขียนทั้งประโยคเอง
 * คืน null ถ้าแถวเดิมไม่มีวันที่ให้ลอก หรือวันที่อ่านไม่ออก
 */
export function nameFromIsoDate(
  latest: TableShape["latest"],
  iso: string,
): { name: string; date: ThaiDate & { match: string } } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!latest || !m) return null;
  const date: ThaiDate = {
    day: Number(m[3]),
    month: Number(m[2]) - 1,
    year: Number(m[1]) + 543,
    abbr: latest.date.abbr,
  };
  if (date.month < 0 || date.month > 11 || date.day < 1 || date.day > 31) return null;
  const text = formatThaiDate(date);
  return { name: latest.name.replace(latest.date.match, text), date: { ...date, match: text } };
}

/** เปลี่ยนเฉพาะวันที่ในชื่อเดิม — ใช้ตอนเปลี่ยนไฟล์ของแถวเดิมแล้ว AI อ่านวันที่ใหม่ได้ */
export function swapDate(name: string, iso: string): string | null {
  const old = findThaiDate(plainText(name));
  if (!old) return null;
  const next = nameFromIsoDate({ date: old, name }, iso);
  return next && next.name !== name ? next.name : null;
}

/** ไฟล์ที่ไอคอนในช่องนี้ชี้อยู่ — ไว้โชว์ชื่อและเปิดดูในหลังบ้าน */
export function fileOf(cell: string): { href: string; name: string } | null {
  const a = PDF_ICON.exec(cell)?.[0];
  if (!a) return null;
  const attr = (n: string) =>
    plainText(new RegExp(`\\s${n}="([^"]*)"`).exec(a)?.[1] ?? "");
  let href = attr("href");
  // ไอคอนแบบเปิดอ่าน ชี้ไปหน้า /read/?src=… — เปิดดูให้ตรงไปที่ไฟล์เลย
  if (href.startsWith("/read/")) {
    const src = new URLSearchParams(href.split("?")[1] ?? "").get("src");
    if (src) href = src;
  }
  const title = attr("title").replace(/^เปิดอ่าน\s*/, "");
  return { href, name: title || decodeURIComponent(href.split("/").pop() ?? "") };
}

/** ชื่อรายการเดิมในตาราง (ไม่เกิน 5 แถวที่ใหม่สุด) ส่งให้ AI เป็นตัวอย่างการเขียนชื่อ */
export function nameExamples(rows: string[][], shape: TableShape): string[] {
  const names = rows.map((r) => plainText(r[shape.nameCol] ?? "")).filter(Boolean);
  return (shape.atTop ? names : names.reverse()).slice(0, 5);
}

/** เรียงไฟล์ที่โยนมาหลายไฟล์ตามวันในชื่อไฟล์ เก่า→ใหม่ — ไฟล์ที่ไม่มีวันที่คงลำดับเดิมไว้ท้าย */
export function sortFiles<T extends { name: string }>(files: T[]): T[] {
  return files
    .map((f, i) => ({ f, i, d: findThaiDate(f.name) }))
    .sort((a, b) => {
      if (a.d && b.d) return dayValue(a.d) - dayValue(b.d) || a.i - b.i;
      if (a.d) return -1;
      if (b.d) return 1;
      return a.i - b.i;
    })
    .map((x) => x.f);
}

/** เรียงเลขลำดับใหม่ 1, 2, 3 … — ป้ายข้างหน้า (เช่น New) คงไว้ · แถวที่ไม่มีเลขข้ามไป */
export function renumber(rows: string[][], numCol: number): string[][] {
  if (numCol < 0) return rows;
  let n = 0;
  return rows.map((r) => {
    const cell = r[numCol] ?? "";
    if (!NUMBER_AT_END.test(plainText(cell))) return r;
    n += 1;
    const next = cell.replace(NUMBER_AT_END, (_, __, dot: string, space: string) => `${n}${dot}${space}`);
    return r.map((c, i) => (i === numCol ? next : c));
  });
}
