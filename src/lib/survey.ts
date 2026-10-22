/**
 * แบบประเมินความพึงพอใจ — รูปร่างคำถาม ตัวล้างข้อมูล กฎล็อก และสถานะ
 *
 * ไฟล์นี้ไม่แตะฐานข้อมูลและไม่ import ของฝั่ง server ใช้ได้ทั้งหน้าจอหลังบ้านและ API
 * (หลักเดียวกับ permissions.ts) — กฎชุดเดียวกันทั้งสองฝั่ง จะได้ไม่เพี้ยนกัน
 */

/** ชนิดคำถาม — ชุดเดียวกับที่ใช้ใน Google Form ของสหกรณ์ */
export type ItemKind =
  | "section" // หัวตอน / ข้อความคั่น ไม่ต้องตอบ
  | "text" // ข้อความสั้น
  | "paragraph" // ย่อหน้า
  | "choice" // ตัวเลือกเดียว
  | "checkbox" // หลายตัวเลือก
  | "dropdown" // ดรอปดาวน์
  | "scale" // สเกล 1–5
  | "grid" // ตารางให้คะแนน (หลายหัวข้อ × หลายระดับ)
  | "date"; // วันที่

export type Option = { id: string; label: string };

/**
 * คอลัมน์ของตารางให้คะแนน
 * na = ช่อง "ไม่ประเมิน" เช่น "ไม่ได้ใช้บริการเงินฝาก (0)" — **ห้ามนำไปคิดค่าเฉลี่ย**
 * ไม่งั้นคนที่ไม่ได้ใช้บริการจะดึงคะแนนลงทั้งที่ไม่ได้ให้คะแนนจริง
 */
export type GridColumn = { id: string; label: string; score: number; na: boolean };

export type SurveyItem = {
  id: string;
  kind: ItemKind;
  title: string;
  description: string;
  required: boolean;
  /** ซ่อนข้อนี้ — ทางเดียวที่ "เอาข้อออก" ได้หลังมีคนตอบแล้ว (ลบไม่ได้ ผลสรุปจะเพี้ยน) */
  hidden: boolean;
  /** เก็บคำตอบไว้ แต่ไม่นำไปสรุปใน Dashboard (เช่น ชื่อผู้แทนสมาชิกที่แนะนำ) */
  noReport: boolean;
  /** choice · checkbox · dropdown */
  options: Option[];
  /** มีตัวเลือก "อื่น ๆ (โปรดระบุ)" ให้พิมพ์เองต่อท้าย — choice · checkbox */
  allowOther: boolean;
  /** grid */
  rows: Option[];
  columns: GridColumn[];
  /** scale */
  scaleMin: number;
  scaleMax: number;
  scaleMinLabel: string;
  scaleMaxLabel: string;
};

export const KIND_LABEL: Record<ItemKind, string> = {
  section: "หัวตอน / ข้อความ",
  text: "ข้อความสั้น",
  paragraph: "ย่อหน้า",
  choice: "ตัวเลือกเดียว",
  checkbox: "เลือกได้หลายข้อ",
  dropdown: "ดรอปดาวน์",
  scale: "สเกลคะแนน",
  grid: "ตารางให้คะแนน",
  date: "วันที่",
};

export const KIND_HINT: Record<ItemKind, string> = {
  section: "ขึ้นหัวตอนใหม่ เช่น \"ตอนที่ 2 ความพึงพอใจด้านต่าง ๆ\" ไม่ต้องตอบ",
  text: "พิมพ์คำตอบสั้น ๆ บรรทัดเดียว",
  paragraph: "พิมพ์ได้หลายบรรทัด เช่น ข้อเสนอแนะ",
  choice: "เลือกได้ข้อเดียว",
  checkbox: "เลือกได้มากกว่าหนึ่งข้อ",
  dropdown: "เลือกข้อเดียวจากรายการที่พับไว้ เหมาะกับตัวเลือกเยอะ ๆ",
  scale: "ให้คะแนนเป็นตัวเลข เช่น 1 ถึง 5",
  grid: "หลายหัวข้อ ให้คะแนนแต่ละหัวข้อ เช่น ความพึงพอใจด้านเงินฝาก 10 หัวข้อ",
  date: "เลือกวันที่",
};

/** ชนิดที่มีรายการตัวเลือก */
export const HAS_OPTIONS: ItemKind[] = ["choice", "checkbox", "dropdown"];

/** ระดับมาตรฐาน 5–1 ของแบบประเมินราชการ — ใช้ตอนสร้างตารางใหม่ */
export const STANDARD_COLUMNS: Omit<GridColumn, "id">[] = [
  { label: "มากที่สุด", score: 5, na: false },
  { label: "มาก", score: 4, na: false },
  { label: "ปานกลาง", score: 3, na: false },
  { label: "น้อย", score: 2, na: false },
  { label: "น้อยที่สุด", score: 1, na: false },
];

/* ------------------------------------------------------------------ รหัส */

const ID_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

/** รหัสสุ่ม — ใช้ crypto ของเบราว์เซอร์/Node (มีทั้งสองฝั่ง) */
function randomId(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ID_ALPHABET[b % ID_ALPHABET.length]).join("");
}

/** รหัสข้อ/ตัวเลือก — ขึ้นต้นด้วยตัวอักษร จะได้ใช้เป็นคีย์ JSON ได้สบาย */
export const newId = (prefix = "q") => `${prefix}_${randomId(8)}`;

/**
 * รหัสในลิงก์ /s/<code>/ — 6 ตัวจาก 32 แบบ ≈ หนึ่งพันล้านแบบ
 * ตัดตัวที่อ่านสับสนทิ้ง (0/o · 1/l) เพราะจะถูกพิมพ์ตามโปสเตอร์ด้วยมือ
 */
export const newSurveyCode = () => randomId(6);

/* ------------------------------------------------------------- สร้างใหม่ */

export function blankItem(kind: ItemKind): SurveyItem {
  return {
    id: newId(),
    kind,
    title: "",
    description: "",
    required: kind !== "section",
    hidden: false,
    noReport: false,
    options: HAS_OPTIONS.includes(kind)
      ? [
          { id: newId("o"), label: "ตัวเลือกที่ 1" },
          { id: newId("o"), label: "ตัวเลือกที่ 2" },
        ]
      : [],
    allowOther: false,
    rows: kind === "grid" ? [{ id: newId("r"), label: "หัวข้อที่ 1" }] : [],
    columns: kind === "grid" ? STANDARD_COLUMNS.map((c) => ({ ...c, id: newId("c") })) : [],
    scaleMin: 1,
    scaleMax: 5,
    scaleMinLabel: kind === "scale" ? "น้อยที่สุด" : "",
    scaleMaxLabel: kind === "scale" ? "มากที่สุด" : "",
  };
}

/** ทำสำเนาข้อ — ได้รหัสใหม่ทุกชั้น ไม่งั้นคำตอบของสองข้อจะชนกัน */
export function cloneItem(item: SurveyItem): SurveyItem {
  return {
    ...item,
    id: newId(),
    options: item.options.map((o) => ({ ...o, id: newId("o") })),
    rows: item.rows.map((r) => ({ ...r, id: newId("r") })),
    columns: item.columns.map((c) => ({ ...c, id: newId("c") })),
  };
}

/* ---------------------------------------------------------- ล้างข้อมูล */

const KINDS = Object.keys(KIND_LABEL) as ItemKind[];
const LIMIT = { title: 500, description: 2000, label: 300, list: 60, items: 200 };

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const okId = (v: unknown) => typeof v === "string" && /^[a-z]_[a-z0-9]{4,16}$/.test(v);

function cleanList(input: unknown, prefix: string): Option[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: Option[] = [];
  for (const raw of input.slice(0, LIMIT.list)) {
    const o = (raw ?? {}) as Record<string, unknown>;
    let id = okId(o.id) ? String(o.id) : newId(prefix);
    if (seen.has(id)) id = newId(prefix);
    seen.add(id);
    out.push({ id, label: str(o.label, LIMIT.label) });
  }
  return out;
}

function cleanColumns(input: unknown): GridColumn[] {
  return cleanList(input, "c").map((o, i) => {
    const raw = ((input as unknown[])[i] ?? {}) as Record<string, unknown>;
    const score = Number(raw.score);
    return {
      ...o,
      score: Number.isFinite(score) ? Math.round(score) : 0,
      na: raw.na === true,
    };
  });
}

/**
 * ล้างรายการคำถามที่ส่งมาจากหน้าจอ — ตัดช่องแปลกปลอม ตัดความยาว เติมรหัสที่ขาด
 * ไม่ throw: ของที่อ่านไม่ออกถูกข้ามไป ส่วนที่ผิดกฎจริง ๆ ให้ validateItems() บอก
 */
export function cleanItems(input: unknown): SurveyItem[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: SurveyItem[] = [];

  for (const raw of input.slice(0, LIMIT.items)) {
    const o = (raw ?? {}) as Record<string, unknown>;
    const kind = KINDS.includes(o.kind as ItemKind) ? (o.kind as ItemKind) : null;
    if (!kind) continue;

    let id = okId(o.id) ? String(o.id) : newId();
    if (seen.has(id)) id = newId();
    seen.add(id);

    const base = blankItem(kind);
    const min = Number(o.scaleMin);
    const max = Number(o.scaleMax);
    out.push({
      ...base,
      id,
      title: str(o.title, LIMIT.title),
      description: str(o.description, LIMIT.description),
      required: kind === "section" ? false : o.required === true,
      hidden: o.hidden === true,
      noReport: o.noReport === true,
      options: HAS_OPTIONS.includes(kind) ? cleanList(o.options, "o") : [],
      allowOther: (kind === "choice" || kind === "checkbox") && o.allowOther === true,
      rows: kind === "grid" ? cleanList(o.rows, "r") : [],
      columns: kind === "grid" ? cleanColumns(o.columns) : [],
      scaleMin: kind === "scale" && (min === 0 || min === 1) ? min : 1,
      scaleMax: kind === "scale" && Number.isInteger(max) && max >= 2 && max <= 10 ? max : 5,
      scaleMinLabel: kind === "scale" ? str(o.scaleMinLabel, LIMIT.label) : "",
      scaleMaxLabel: kind === "scale" ? str(o.scaleMaxLabel, LIMIT.label) : "",
    });
  }
  return out;
}

/** อ่านค่าจากฐาน — ของเสียได้รายการว่าง ไม่ใช่ทำให้หน้าพัง */
export const readItems = (value: unknown): SurveyItem[] => cleanItems(value);

/** ชื่อสั้น ๆ ของข้อ ไว้ใช้ในข้อความแจ้งเตือน */
function itemName(items: SurveyItem[], item: SurveyItem): string {
  const n = numberOf(items, item.id);
  const title = item.title || KIND_LABEL[item.kind];
  return n ? `ข้อ ${n} "${title}"` : `"${title}"`;
}

/**
 * ตรวจว่าชุดคำถามพร้อมใช้ไหม — คืนรายการปัญหา (ว่าง = ผ่าน)
 * ใช้ทั้งตอนกดบันทึกและตอนกดเผยแพร่
 */
export function validateItems(items: SurveyItem[]): string[] {
  const problems: string[] = [];
  for (const item of items) {
    if (item.hidden) continue;
    const name = itemName(items, item);
    if (item.kind !== "section" && !item.title) problems.push(`${name} ยังไม่ได้พิมพ์คำถาม`);
    if (HAS_OPTIONS.includes(item.kind)) {
      if (item.options.length < 2 && !item.allowOther) problems.push(`${name} ต้องมีตัวเลือกอย่างน้อย 2 ข้อ`);
      if (item.options.some((o) => !o.label)) problems.push(`${name} มีตัวเลือกที่ยังว่างอยู่`);
    }
    if (item.kind === "grid") {
      if (item.rows.length === 0) problems.push(`${name} ยังไม่มีหัวข้อให้คะแนน`);
      if (item.columns.filter((c) => !c.na).length < 2) problems.push(`${name} ต้องมีระดับคะแนนอย่างน้อย 2 ระดับ`);
      if (item.rows.some((r) => !r.label) || item.columns.some((c) => !c.label)) {
        problems.push(`${name} มีหัวข้อหรือระดับคะแนนที่ยังว่างอยู่`);
      }
    }
    if (item.kind === "scale" && item.scaleMax <= item.scaleMin) {
      problems.push(`${name} คะแนนสูงสุดต้องมากกว่าคะแนนต่ำสุด`);
    }
  }
  if (!items.some((i) => i.kind !== "section" && !i.hidden)) {
    problems.push("ยังไม่มีคำถามให้ตอบเลย");
  }
  return problems;
}

/**
 * กฎล็อกเมื่อมีคนตอบแล้ว — คืนรายการสิ่งที่ห้ามทำ (ว่าง = ผ่าน)
 *
 * คำตอบที่เก็บไว้อ้างรหัสข้อ / รหัสตัวเลือก / รหัสแถว / รหัสคอลัมน์ ถ้าลบหรือเปลี่ยนชนิด
 * คำตอบเก่าจะชี้ไปของที่ไม่มีอยู่แล้ว ผลสรุปเพี้ยนโดยไม่มีอะไรฟ้อง
 * ที่ทำได้: แก้ถ้อยคำ · สลับลำดับ · เพิ่มข้อ/ตัวเลือก/แถวใหม่ · ซ่อนข้อ
 * ที่ห้าม: ลบข้อ · เปลี่ยนชนิดข้อ · ลบตัวเลือก/แถว/คอลัมน์ · เปลี่ยนคะแนนของคอลัมน์
 */
export function lockViolations(before: SurveyItem[], after: SurveyItem[]): string[] {
  const problems: string[] = [];
  const next = new Map(after.map((i) => [i.id, i]));

  for (const old of before) {
    const name = itemName(before, old);
    const now = next.get(old.id);
    if (!now) {
      problems.push(`${name} ถูกลบ — มีคนตอบแล้ว ให้ใช้ "ซ่อนข้อนี้" แทน`);
      continue;
    }
    if (now.kind !== old.kind) {
      problems.push(`${name} ถูกเปลี่ยนชนิดคำถาม — มีคนตอบแล้ว เปลี่ยนไม่ได้`);
      continue;
    }
    const gone = (a: Option[], b: Option[]) => a.some((x) => !b.some((y) => y.id === x.id));
    if (gone(old.options, now.options)) problems.push(`${name} มีตัวเลือกถูกลบ — ลบไม่ได้หลังมีคนตอบ`);
    if (gone(old.rows, now.rows)) problems.push(`${name} มีหัวข้อให้คะแนนถูกลบ — ลบไม่ได้หลังมีคนตอบ`);
    if (gone(old.columns, now.columns)) problems.push(`${name} มีระดับคะแนนถูกลบ — ลบไม่ได้หลังมีคนตอบ`);
    for (const col of old.columns) {
      const c = now.columns.find((x) => x.id === col.id);
      if (c && (c.score !== col.score || c.na !== col.na)) {
        problems.push(`${name} คะแนนของ "${col.label}" ถูกเปลี่ยน — เปลี่ยนไม่ได้หลังมีคนตอบ`);
      }
    }
    if (old.allowOther && !now.allowOther) {
      problems.push(`${name} ปิดช่อง "อื่น ๆ" — ปิดไม่ได้หลังมีคนตอบ`);
    }
    if (old.kind === "scale" && (old.scaleMin !== now.scaleMin || old.scaleMax !== now.scaleMax)) {
      problems.push(`${name} ช่วงคะแนนถูกเปลี่ยน — เปลี่ยนไม่ได้หลังมีคนตอบ`);
    }
  }
  return problems;
}

/** เลขข้อที่สมาชิกเห็น — นับเฉพาะข้อที่ต้องตอบและไม่ได้ซ่อน (หัวตอนไม่นับ) */
export function numberOf(items: SurveyItem[], id: string): number | null {
  let n = 0;
  for (const item of items) {
    if (item.kind === "section" || item.hidden) continue;
    n += 1;
    if (item.id === id) return n;
  }
  return null;
}

/* ----------------------------------------------------------------- สถานะ */

export type SurveyStatus = "draft" | "scheduled" | "open" | "closed";

export const STATUS_LABEL: Record<SurveyStatus, string> = {
  draft: "ร่าง",
  scheduled: "รอเปิด",
  open: "เปิดรับ",
  closed: "ปิดแล้ว",
};

type Timing = {
  published: boolean;
  opensAt: Date | string | null;
  closesAt: Date | string | null;
  closedAt: Date | string | null;
};

const time = (v: Date | string | null) => (v ? new Date(v).getTime() : null);

/**
 * สถานะ ณ ตอนนี้ — คิดสดจากวันที่ทุกครั้ง ไม่เก็บลงฐาน
 * ถึงวันสิ้นสุดแล้วปิดเองโดยไม่ต้องมีใครกด และไม่ต้องมีงานตั้งเวลามาคอยเปลี่ยนค่า
 */
export function surveyStatus(s: Timing, now = Date.now()): SurveyStatus {
  if (!s.published) return "draft";
  if (s.closedAt) return "closed";
  const closes = time(s.closesAt);
  if (closes !== null && closes <= now) return "closed";
  const opens = time(s.opensAt);
  if (opens !== null && opens > now) return "scheduled";
  return "open";
}

/* ------------------------------------------------------------------ ลิงก์ */

/**
 * ที่อยู่ที่แจกให้สมาชิก — www.spsccoop.com ซึ่งเปิดได้ตลอด 24 ชม.
 * (spsccoop.org ปิดตามเครื่องสำนักงาน เจ้าของเว็บตัดสินใจ 22 ต.ค. 2569)
 * เปลี่ยนได้ที่ SURVEY_PUBLIC_URL ใน .env โดยไม่ต้องแก้โค้ด
 */
export function surveyUrl(code: string, base?: string): string {
  const root = (base || "https://www.spsccoop.com").replace(/\/+$/, "");
  return `${root}/s/${code}/`;
}
