/**
 * ส่วนต่าง ๆ ของหน้าแรก ที่เปิด/ปิดได้จากหลังบ้าน
 *
 * แยกไว้ไฟล์นี้ (ไม่รวมใน settings.ts) เพราะฟอร์มหลังบ้านเป็น client component
 * ถ้าไปวางรวมกับ settings.ts จะลาก prisma ติดเข้า bundle ฝั่งเบราว์เซอร์
 *
 * ลำดับในลิสต์ = ลำดับตั้งต้น ถ้าไม่เคยจัดเองที่หลังบ้าน (ดู homeOrder ท้ายไฟล์)
 */

export const HOME_SECTIONS = [
  { key: "hero", label: "แบนเนอร์สไลด์ + อัตราดอกเบี้ย" },
  { key: "ticker", label: "ข่าววิ่ง" },
  { key: "news", label: "ประกาศ / จดหมายข่าว + คณะกรรมการ" },
  { key: "services", label: "บริการของเรา" },
  // การ์ดใหญ่ + การ์ดคิวอาร์โค้ด/โซเชียล + แถบแนะนำสมาชิก เป็นเรื่องของสมาชิกชุดเดียวกัน
  // จึงนับเป็นส่วนเดียว เปิด/ปิดและใช้สีพื้นหลังร่วมกัน ไม่งั้นจะดูขาดเป็นสองก้อน
  { key: "member", label: "สำหรับสมาชิก (การ์ดใหญ่ + คิวอาร์โค้ด/โซเชียล + แนะนำสมาชิก)" },
  { key: "calendar", label: "ปฏิทินสหกรณ์" },
  { key: "officers", label: "สำนักงานบริการสมาชิก" },
] as const;

export type HomeSectionKey = (typeof HOME_SECTIONS)[number]["key"];
export type HomeSections = Record<HomeSectionKey, boolean>;

/** ค่าตั้งต้น = เปิดทุกส่วน (เหมือนที่แสดงอยู่ตอนนี้) */
export const DEFAULT_HOME_SECTIONS = Object.fromEntries(
  HOME_SECTIONS.map((s) => [s.key, true]),
) as HomeSections;

/** เติมคีย์ที่ขาดจากค่าตั้งต้น — ค่าที่บันทึกไว้อาจเก่ากว่าลิสต์ปัจจุบัน */
export const fillHomeSections = (saved: Partial<HomeSections> | null | undefined): HomeSections => ({
  ...DEFAULT_HOME_SECTIONS,
  ...(saved ?? {}),
});

export const isHomeSectionKey = (value: unknown): value is HomeSectionKey =>
  typeof value === "string" && HOME_SECTIONS.some((s) => s.key === value);

/* ---------------------------------- ลำดับ ---------------------------------- */

/**
 * ส่วนที่รวมของหลายอย่างไว้ในก้อนเดียว — บอกไว้ในหลังบ้านว่าอะไรย้ายตามกันบ้าง
 * (สไลด์กับอัตราดอกเบี้ยวางอยู่แถวเดียวกันจริง ๆ แยกคนละที่ไม่ได้)
 */
export const SECTION_NOTE: Partial<Record<HomeSectionKey, string>> = {
  hero: "สไลด์กับอัตราดอกเบี้ยวางคู่กันในแถวเดียว ย้ายไปไหนก็ไปด้วยกัน",
  news: "ประกาศกับคณะกรรมการวางคู่กันในแถวเดียว ย้ายไปไหนก็ไปด้วยกัน",
  member: "การ์ดใหญ่ การ์ดคิวอาร์โค้ด/โซเชียล และแนะนำสมาชิก นับเป็นก้อนเดียวกัน",
};

export type HomeSection = (typeof HOME_SECTIONS)[number];
export type HomeOrder = HomeSectionKey[];

/** ลำดับตั้งต้น = ตามลิสต์ HOME_SECTIONS ด้านบน */
export const DEFAULT_HOME_ORDER: HomeOrder = HOME_SECTIONS.map((s) => s.key);

/**
 * ทำให้ลำดับที่บันทึกไว้ใช้ได้เสมอ — ตัดคีย์แปลกปลอมและตัวซ้ำทิ้ง
 * ส่วนที่เพิ่มเข้ามาใหม่ทีหลัง (ยังไม่มีในค่าที่บันทึก) ต่อท้ายให้ ไม่หายไปเฉย ๆ
 */
export function fillHomeOrder(saved: unknown): HomeOrder {
  const seen = new Set<HomeSectionKey>();
  const out: HomeOrder = [];

  for (const key of Array.isArray(saved) ? saved : []) {
    if (isHomeSectionKey(key) && !seen.has(key)) {
      seen.add(key);
      out.push(key);
    }
  }
  for (const section of HOME_SECTIONS) {
    if (!seen.has(section.key)) out.push(section.key);
  }
  return out;
}

const SECTION_OF = Object.fromEntries(HOME_SECTIONS.map((s) => [s.key, s])) as Record<
  HomeSectionKey,
  HomeSection
>;

/** รายละเอียดของแต่ละส่วน เรียงตามลำดับที่จัดไว้ */
export const orderedSections = (order: unknown): HomeSection[] =>
  fillHomeOrder(order).map((key) => SECTION_OF[key]);

/**
 * โทนพื้นหลังของแต่ละส่วน — ใช้สีชุดเดิมของเว็บ ไม่เพิ่มสีใหม่ให้ขัดกัน
 * เพิ่มโทนใหม่ทีหลังก็แค่มาต่อในลิสต์นี้ ที่เหลือรับไปเองทั้งหมด
 */
export const HOME_TONES = [
  { key: "auto", label: "สลับให้เอง", className: "", swatch: "linear-gradient(135deg,#ffffff 50%,#e8f5fc 50%)" },
  { key: "white", label: "ขาว", className: "bg-white", swatch: "#ffffff" },
  { key: "sky", label: "ฟ้าอ่อน", className: "bg-sky-soft", swatch: "#e8f5fc" },
  { key: "brand", label: "ฟ้าแบรนด์", className: "bg-brand-50", swatch: "#eaf4fc" },
  { key: "gray", label: "เทาอ่อน", className: "bg-gray-50", swatch: "#f9fafb" },
] as const;

export type ToneKey = (typeof HOME_TONES)[number]["key"];
export type HomeTones = Record<HomeSectionKey, ToneKey>;

/** ค่าตั้งต้น = สลับให้เองทุกส่วน */
export const DEFAULT_HOME_TONES = Object.fromEntries(
  HOME_SECTIONS.map((s) => [s.key, "auto"]),
) as HomeTones;

export const fillHomeTones = (saved: Partial<HomeTones> | null | undefined): HomeTones => ({
  ...DEFAULT_HOME_TONES,
  ...(saved ?? {}),
});

export const isToneKey = (value: unknown): value is ToneKey =>
  typeof value === "string" && HOME_TONES.some((t) => t.key === value);

const CLASS_OF = Object.fromEntries(HOME_TONES.map((t) => [t.key, t.className])) as Record<
  ToneKey,
  string
>;

/**
 * แปลงเป็นคลาสจริงของแต่ละส่วน
 *
 * "สลับให้เอง" = ดูว่าส่วนก่อนหน้าที่แสดงอยู่ใช้สีอะไร แล้วเลือกอีกสีให้ต่างกัน
 * จึงไม่มีทางเกิดสองส่วนติดกันสีเดียวกัน แม้จะปิดบางส่วนไปหรือกำหนดสีเองสลับกับ auto
 */
export function resolveTones(
  tones: HomeTones,
  visible: (key: HomeSectionKey) => boolean,
  /** ลำดับที่จัดไว้ — ต้องคิดสีตามลำดับจริงบนหน้าเว็บ ไม่งั้นสลับผิดคู่ */
  order: unknown = DEFAULT_HOME_ORDER,
): Record<HomeSectionKey, string> {
  const out = {} as Record<HomeSectionKey, string>;
  let previous = "";

  for (const section of orderedSections(order)) {
    if (!visible(section.key)) {
      out[section.key] = "";
      continue;
    }
    const picked = tones[section.key];
    const className =
      picked === "auto"
        ? previous === CLASS_OF.white
          ? CLASS_OF.sky
          : CLASS_OF.white
        : CLASS_OF[picked];
    out[section.key] = className;
    previous = className;
  }
  return out;
}
