/**
 * ตรวจสุขภาพการเงิน — คำถาม 21 ข้อ กับสูตรคิดผล
 *
 * โปรแกรมแรกของ "หน้าโปรแกรม" (ดู src/lib/programPages.ts) · เจ้าของเว็บสั่งไว้ 25 ส.ค. 2026
 *
 * ⚠️ **คำถามชุดนี้เจ้าของเว็บเขียนมาเอง** (ให้ไว้ 26 ส.ค. 2026) — ที่อยู่ในไฟล์นี้คือ
 * **ค่าตั้งต้น** เท่านั้น ของจริงที่หน้าเว็บใช้อ่านจาก `Setting["checkupQuestions"]`
 * ซึ่งเจ้าหน้าที่แก้เองได้ที่ หลังบ้าน → หน้าโปรแกรม · ยังไม่เคยแก้ = ใช้ชุดนี้
 *
 * ⚠️ **ห้ามให้สมาชิกพิมพ์ตัวเลขเอง** — ทุกข้อตอบด้วยการเลื่อนสเกล เพราะ
 *   1. สมาชิกส่วนใหญ่เปิดจากมือถือ พิมพ์เลขยาว ๆ บนคีย์บอร์ดจอเล็กแล้วเลิกกลางคัน
 *   2. พิมพ์เองได้เมื่อไหร่จะมีคนใส่ "12,000฿" หรือ "หมื่นสอง" แล้วคำนวณไม่ได้
 *   3. ตัวเลขกลม ๆ พอสำหรับการประเมิน ไม่ต้องเป๊ะถึงหลักบาท
 *
 * ⚠️ **ไม่เก็บคำตอบลงฐานเลยสักข้อ** ทุกอย่างอยู่ในเครื่องของคนตอบ กดปิดหน้าก็หายหมด
 * เรื่องเงินในบ้านเป็นข้อมูลอ่อนไหวที่สุดที่เว็บนี้จะแตะได้
 */

/** กลุ่มของคำถาม — คุมทั้งสีบนจอและวิธีคิดผล */
export type CheckupGroup = "need" | "debt" | "save" | "want";

/** ช่วงเงินของสเกล — เลือกได้ต่อข้อ เพราะค่าตัดผมกับค่าผ่อนบ้านคนละสเกลกันคนละโลก */
export type ScaleKey = "small" | "medium" | "large";

export type CheckupQuestion = {
  id: string;
  group: CheckupGroup;
  /** คำถามที่คนตอบเห็น */
  text: string;
  /** ขยายความว่านับอะไรบ้าง — เว้นว่างได้ */
  hint: string;
  scale: ScaleKey;
};

export const GROUP_LABEL: Record<CheckupGroup, string> = {
  need: "รายจ่ายจำเป็น",
  debt: "ภาระหนี้",
  save: "เงินออม",
  want: "รายจ่ายส่วนตัว",
};

export const GROUP_HINT: Record<CheckupGroup, string> = {
  need: "ของที่ไม่จ่ายไม่ได้ — กิน อยู่ เดินทาง ดูแลครอบครัว",
  debt: "เงินที่ต้องส่งคืนทุกเดือน — ผ่อน ชำระหนี้ หักเงินเดือน",
  save: "เงินที่เก็บไว้เป็นของตัวเอง — ค่าหุ้น เงินฝาก",
  want: "ของที่ลดได้ถ้าจำเป็น — ความสวยงาม สังสรรค์ ช่วยงาน",
};

/** สีประจำกลุ่ม — ต้องเขียนชื่อคลาสเต็ม (Tailwind อ่านจากซอร์สแบบข้อความตรง ๆ) */
export const GROUP_TONE: Record<CheckupGroup, { text: string; bg: string; ring: string; bar: string }> = {
  need: { text: "text-sky-700", bg: "bg-sky-50", ring: "ring-sky-200", bar: "bg-sky-500" },
  debt: { text: "text-rose-700", bg: "bg-rose-50", ring: "ring-rose-200", bar: "bg-rose-500" },
  save: { text: "text-violet-700", bg: "bg-violet-50", ring: "ring-violet-200", bar: "bg-violet-500" },
  want: { text: "text-amber-700", bg: "bg-amber-50", ring: "ring-amber-200", bar: "bg-amber-500" },
};

/** สร้างขั้นสเกล — ขั้นถี่ตอนเงินน้อย ห่างขึ้นตอนเงินเยอะ */
function build(...parts: { to: number; by: number }[]): number[] {
  const out = [0];
  let at = 0;
  for (const part of parts) {
    while (at < part.to) {
      at += part.by;
      out.push(at);
    }
  }
  return out;
}

export const SCALES: Record<ScaleKey, number[]> = {
  small: build({ to: 2000, by: 100 }, { to: 5000, by: 250 }, { to: 10000, by: 500 }),
  medium: build({ to: 5000, by: 250 }, { to: 20000, by: 1000 }, { to: 50000, by: 2500 }),
  large: build({ to: 10000, by: 500 }, { to: 50000, by: 1000 }, { to: 150000, by: 5000 }),
};

export const SCALE_LABEL: Record<ScaleKey, string> = {
  small: "ไม่เกิน 10,000",
  medium: "ไม่เกิน 50,000",
  large: "ไม่เกิน 150,000",
};

/**
 * คำถามตั้งต้น 21 ข้อ — ตามที่เจ้าของเว็บเขียนมา
 *
 * แก้คำผิดให้ 4 จุด: น้ำนันเชื้อเพลิง → น้ำมันเชื้อเพลิง · น้ำปะปา → น้ำประปา
 * · หนี้สกหรณ์ → หนี้สหกรณ์ · คอนโดมิเนี่ยม → คอนโดมิเนียม
 * (แก้กลับเป็นแบบเดิมได้ที่หลังบ้าน ถ้าอยากให้เป็นอย่างที่เขียนมาเป๊ะ ๆ)
 */
export const DEFAULT_QUESTIONS: CheckupQuestion[] = [
  {
    id: "food",
    group: "need",
    scale: "medium",
    text: "ท่านต้องจ่ายเงินค่าอาหารของตนเองและผู้ที่ท่านต้องดูแลเฉลี่ยเดือนละเท่าไร",
    hint: "รวมข้าวที่บ้าน ข้าวกลางวัน น้ำ กาแฟ และของกินจุกจิกทั้งบ้าน",
  },
  {
    id: "carLoan",
    group: "debt",
    scale: "medium",
    text: "ท่านต้องจ่ายเงินค่างวดผ่อนรถยนต์หรือผ่อนจักรยานยนต์เฉลี่ยเดือนละเท่าไร",
    hint: "รวมทุกคันที่ยังผ่อนอยู่",
  },
  {
    id: "homeLoan",
    group: "debt",
    scale: "medium",
    text: "ท่านต้องจ่ายเงินค่างวดผ่อนบ้านหรือผ่อนคอนโดมิเนียมเฉลี่ยเดือนละเท่าไร",
    hint: "ค่างวดที่ผ่อนกับธนาคารหรือสถาบันการเงิน",
  },
  {
    id: "rent",
    group: "need",
    scale: "medium",
    text: "ท่านต้องจ่ายเงินค่าเช่าบ้านหรือค่าเช่าที่อยู่อาศัยเฉลี่ยเดือนละเท่าไร",
    hint: "เฉพาะค่าเช่า — ถ้าผ่อนอยู่ให้ไปใส่ที่ข้อค่างวดผ่อนบ้าน",
  },
  {
    id: "bus",
    group: "need",
    scale: "small",
    text: "ท่านต้องจ่ายเงินค่ารถโดยสารประจำทางในแต่ละวันเฉลี่ยเดือนละเท่าไร",
    hint: "รถเมล์ รถตู้ วินมอเตอร์ไซค์ แท็กซี่ รวมทั้งเดือน",
  },
  {
    id: "fuel",
    group: "need",
    scale: "small",
    text: "ท่านต้องจ่ายเงินค่าน้ำมันเชื้อเพลิงส่วนตัวในแต่ละวันเฉลี่ยเดือนละเท่าไร",
    hint: "รวมค่าทางด่วนและค่าจอดรถด้วยก็ได้",
  },
  {
    id: "electric",
    group: "need",
    scale: "small",
    text: "ท่านต้องจ่ายเงินค่าไฟฟ้าที่พักอาศัยรายเดือนเฉลี่ยเดือนละเท่าไร",
    hint: "ดูจากบิลค่าไฟเดือนล่าสุดได้เลย",
  },
  {
    id: "water",
    group: "need",
    scale: "small",
    text: "ท่านต้องจ่ายเงินค่าน้ำประปาที่พักอาศัยรายเดือนเฉลี่ยเดือนละเท่าไร",
    hint: "ดูจากบิลค่าน้ำเดือนล่าสุดได้เลย",
  },
  {
    id: "phone",
    group: "need",
    scale: "small",
    text: "ท่านต้องจ่ายเงินค่าเครือข่ายโทรศัพท์เคลื่อนที่รายเดือนหรือรายวันเฉลี่ยเดือนละเท่าไร",
    hint: "รวมทุกเบอร์ในบ้าน และค่าเน็ตบ้านด้วย",
  },
  {
    id: "spouse",
    group: "need",
    scale: "medium",
    text: "ท่านต้องดูแลช่วยเหลือคู่สมรสเฉลี่ยเดือนละเท่าไร",
    hint: "เงินที่ให้เป็นประจำทุกเดือน",
  },
  {
    id: "child",
    group: "need",
    scale: "medium",
    text: "ท่านต้องดูแลบุตร (ไม่รวมค่าเล่าเรียน) เฉลี่ยเดือนละเท่าไร",
    hint: "ค่าขนม ค่าเดินทาง ของใช้ของลูก",
  },
  {
    id: "clothes",
    group: "want",
    scale: "small",
    text: "ท่านต้องซื้อเสื้อผ้าหรือเครื่องประดับ เฉลี่ยเดือนละเท่าไร",
    hint: "เฉลี่ยจากที่ซื้อทั้งปีมาเป็นต่อเดือน",
  },
  {
    id: "hair",
    group: "want",
    scale: "small",
    text: "ท่านต้องตัดผมใช้บริการร้านเสริมสวยหรือออกแบบทรงผม เฉลี่ยเดือนละเท่าไร",
    hint: "ตัด สระ ทำสี ดัด ยืด รวมกัน",
  },
  {
    id: "cosmetic",
    group: "want",
    scale: "small",
    text: "ท่านต้องซื้อเครื่องสำอาง เฉลี่ยเดือนละเท่าไร",
    hint: "รวมของบำรุงผิวและของใช้ส่วนตัว",
  },
  {
    id: "social",
    group: "want",
    scale: "small",
    text: "ท่านมีค่าใช้จ่ายสังสรรค์ความสุขส่วนตัว (ค่าเหล้า ค่าบุหรี่ เป็นต้น) เฉลี่ยเดือนละเท่าไร",
    hint: "รวมค่าเลี้ยงสังสรรค์ ค่าหวย และงานอดิเรก",
  },
  {
    id: "ceremony",
    group: "want",
    scale: "small",
    text: "ท่านมีค่าใช้จ่ายช่วยงาน เช่น ช่วยงานศพ งานแต่ง งานอุปสมบท เป็นต้น เฉลี่ยเดือนละเท่าไร",
    hint: "เฉลี่ยจากทั้งปีมาเป็นต่อเดือน",
  },
  {
    id: "coopLoan",
    group: "debt",
    scale: "medium",
    text: "ท่านหักเงินเดือนชำระหนี้สหกรณ์ เฉลี่ยเดือนละเท่าไร",
    hint: "ยอดที่ถูกหักทุกเดือน รวมเงินกู้สามัญ ฉุกเฉิน และพิเศษ",
  },
  {
    id: "credit",
    group: "debt",
    scale: "medium",
    text: "ท่านต้องชำระหนี้จากบัตรเครดิต เฉลี่ยเดือนละเท่าไร",
    hint: "ยอดที่จ่ายจริงต่อเดือน รวมบัตรกดเงินสดและสินเชื่อส่วนบุคคล",
  },
  {
    id: "share",
    group: "save",
    scale: "small",
    text: "ท่านต้องส่งค่าหุ้นสหกรณ์ เฉลี่ยเดือนละเท่าไร",
    hint: "ยอดค่าหุ้นที่ถูกหักจากเงินเดือน — นี่คือเงินออมของท่านเอง",
  },
  {
    id: "saving",
    group: "save",
    scale: "medium",
    text: "ท่านต้องฝากเงินไว้เป็นเงินออม เฉลี่ยเดือนละเท่าไร",
    hint: "ฝากสหกรณ์ ฝากธนาคาร กองทุน ออมทอง หรือเบี้ยประกันสะสมทรัพย์",
  },
  {
    id: "other",
    group: "want",
    scale: "small",
    text: "นอกจากที่กล่าวมาท่านมีค่าใช้จ่ายอื่น ๆ เฉลี่ยเดือนละเท่าไร",
    hint: "ของที่นึกไม่ออกว่าไปอยู่ข้อไหน แต่รู้ว่าเสียทุกเดือน",
  },
];

const GROUPS: CheckupGroup[] = ["need", "debt", "save", "want"];
const SCALE_KEYS: ScaleKey[] = ["small", "medium", "large"];

/**
 * อ่านคำถามที่เจ้าหน้าที่แก้ไว้จากฐาน แล้วเติมส่วนที่ขาด/ทิ้งของที่ใช้ไม่ได้
 *
 * ⚠️ **อ่านไม่ออกเมื่อไหร่ให้ถอยกลับไปใช้ชุดตั้งต้น ไม่ใช่คืนรายการว่าง**
 * ไม่งั้นแก้ค่าในฐานพลาดทีเดียว หน้าโปรแกรมจะกลายเป็นหน้าเปล่าทันที
 */
export function fillQuestions(raw: unknown): CheckupQuestion[] {
  if (!Array.isArray(raw)) return DEFAULT_QUESTIONS;

  const seen = new Set<string>();
  const list: CheckupQuestion[] = [];

  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const id = String(row.id ?? "").trim();
    const text = String(row.text ?? "").trim();
    // ไม่มีรหัสหรือไม่มีคำถาม = ข้อนั้นใช้ไม่ได้ · รหัสซ้ำ = คำตอบจะทับกันเอง
    if (!id || !text || seen.has(id)) continue;
    seen.add(id);

    const group = GROUPS.includes(row.group as CheckupGroup) ? (row.group as CheckupGroup) : "need";
    const scale = SCALE_KEYS.includes(row.scale as ScaleKey) ? (row.scale as ScaleKey) : "small";
    list.push({ id, group, scale, text, hint: String(row.hint ?? "").trim() });
  }

  return list.length > 0 ? list : DEFAULT_QUESTIONS;
}

export type CheckupAnswers = Record<string, number>;

/** ยอดรวมของกลุ่มหนึ่ง */
export const groupTotal = (
  questions: CheckupQuestion[],
  answers: CheckupAnswers,
  group: CheckupGroup,
): number =>
  questions.filter((q) => q.group === group).reduce((sum, q) => sum + (answers[q.id] ?? 0), 0);

export type CheckupResult = {
  need: number;
  debt: number;
  save: number;
  want: number;
  /** รายจ่ายรวมทุกอย่างที่ไหลออกใน 1 เดือน — ตัวเลขหลักที่โปรแกรมนี้ตอบ */
  spend: number;
  /** รายรับที่กรอกเพิ่มทีหลัง (ไม่ได้อยู่ใน 21 ข้อ) · 0 = ไม่ได้กรอก */
  income: number;
  /** รายรับ − รายจ่าย — คิดได้เฉพาะตอนกรอกรายรับ */
  left: number;
  needRatio: number;
  debtRatio: number;
  saveRatio: number;
  wantRatio: number;
  /** คะแนน 0-100 · null = ยังไม่ได้กรอกรายรับ จึงยังให้คะแนนไม่ได้ */
  score: number | null;
  level: { label: string; tone: string; summary: string } | null;
  advice: { title: string; detail: string; href?: string; linkLabel?: string }[];
};

/** คะแนนย่อยแบบไล่ระดับ — ดีกว่าเกณฑ์ = เต็ม, แย่กว่ามาก = 0, ระหว่างนั้นไล่เป็นเส้นตรง */
function band(value: number, best: number, worst: number): number {
  if (best < worst) {
    if (value <= best) return 1;
    if (value >= worst) return 0;
    return (worst - value) / (worst - best);
  }
  if (value >= best) return 1;
  if (value <= worst) return 0;
  return (value - worst) / (best - worst);
}

const money = (n: number) => n.toLocaleString("th-TH");

/**
 * คิดผลตรวจ
 *
 * คำถาม 21 ข้อถามแต่ "รายจ่าย" ล้วน ผลหลักจึงเป็นยอดรายจ่ายรวมกับสัดส่วนว่าเงินไปทางไหน
 * ส่วนคะแนนสุขภาพการเงินคิดได้ต่อเมื่อมีรายรับมาเทียบ — หน้าผลจึงมีสเกลรายรับ
 * ให้เลื่อนเพิ่มทีหลัง **เป็นของแถม ไม่ใช่ข้อบังคับ** (จะข้ามไปเลยก็ยังได้ยอดรายจ่าย)
 *
 * เกณฑ์ที่ใช้ — อิงหลัก 50/30/20 ปรับให้เข้ากับสมาชิกสหกรณ์ที่หนี้ส่วนใหญ่
 * ถูกหักจากเงินเดือนอยู่แล้ว: หนี้ไม่ควรเกิน 35% ของรายรับ · ออมควรได้ 20% ขึ้นไป
 */
export function checkupResult(
  questions: CheckupQuestion[],
  answers: CheckupAnswers,
  income = 0,
): CheckupResult {
  const need = groupTotal(questions, answers, "need");
  const debt = groupTotal(questions, answers, "debt");
  const save = groupTotal(questions, answers, "save");
  const want = groupTotal(questions, answers, "want");
  const spend = need + debt + save + want;
  const left = income - spend;

  const share = (value: number) => (income > 0 ? value / income : 0);
  const needRatio = share(need);
  const debtRatio = share(debt);
  const saveRatio = share(save);
  const wantRatio = share(want);

  const advice: CheckupResult["advice"] = [];

  if (income <= 0) {
    return {
      need,
      debt,
      save,
      want,
      spend,
      income: 0,
      left: 0,
      needRatio: 0,
      debtRatio: 0,
      saveRatio: 0,
      wantRatio: 0,
      score: null,
      level: null,
      advice: [
        {
          title: "อยากรู้ว่าสุขภาพการเงินอยู่ระดับไหน?",
          detail:
            "เลื่อนสเกลรายได้ต่อเดือนด้านบนเพิ่มอีกนิดเดียว ระบบจะให้คะแนนและคำแนะนำที่ตรงกับสถานะของท่าน — รายได้ที่กรอกก็ไม่ถูกเก็บเช่นกัน",
        },
      ],
    };
  }

  const score = Math.round(
    100 *
      (0.35 * band(debtRatio, 0.35, 0.6) +
        0.3 * band(share(Math.max(left, 0)), 0.1, 0) +
        0.25 * band(saveRatio, 0.2, 0.05) +
        0.1 * band(needRatio, 0.5, 0.75)),
  );

  const level =
    score >= 80
      ? {
          label: "แข็งแรงมาก",
          tone: "text-emerald-700",
          summary: "รายรับ รายจ่าย และเงินออมสมดุลดี รักษาแบบนี้ไว้",
        }
      : score >= 65
        ? {
            label: "แข็งแรงดี",
            tone: "text-sky-700",
            summary: "ภาพรวมอยู่ในเกณฑ์ดี มีบางจุดที่ปรับแล้วจะดีขึ้นอีก",
          }
        : score >= 50
          ? {
              label: "พอไปได้ แต่ต้องระวัง",
              tone: "text-amber-700",
              summary: "ยังไม่ถึงกับมีปัญหา แต่ถ้ามีเรื่องด่วนเข้ามาจะสะเทือนทันที",
            }
          : {
              label: "ควรรีบปรับ",
              tone: "text-rose-700",
              summary: "รายจ่ายกับภาระหนี้กินรายรับไปมาก ควรวางแผนแก้ตั้งแต่ตอนนี้",
            };

  if (left < 0) {
    advice.push({
      title: `เดือนหนึ่งใช้เกินตัว ${money(Math.abs(left))} บาท`,
      detail:
        "รายจ่ายรวมมากกว่ารายรับ ถ้าเป็นแบบนี้ทุกเดือนแปลว่ากำลังกินเงินเก็บหรือก่อหนี้ใหม่มาโปะ — ลองดูกลุ่มรายจ่ายส่วนตัวก่อน เพราะลดได้เร็วที่สุด",
    });
  } else if (left / income < 0.1) {
    advice.push({
      title: `เหลือปลายเดือนแค่ ${money(left)} บาท`,
      detail:
        "เหลือน้อยกว่า 10% ของรายรับ ถ้ามีเรื่องด่วนสักเรื่อง เช่น รถเสียหรือเจ็บป่วย จะต้องไปหยิบยืมทันที ควรกันไว้ให้ได้อย่างน้อย 10%",
    });
  }

  if (debtRatio > 0.45) {
    advice.push({
      title: `ภาระหนี้สูงถึง ${Math.round(debtRatio * 100)}% ของรายรับ`,
      detail:
        "เกินเกณฑ์ที่ควรเป็น (ไม่เกิน 35%) สหกรณ์มีระเบียบปรับโครงสร้างหนี้และรวมหนี้เป็นก้อนเดียว ดอกเบี้ยมักถูกกว่าบัตรเครดิตและสินเชื่อส่วนบุคคลมาก ลองปรึกษาเจ้าหน้าที่สินเชื่อ",
      href: "/loans/",
      linkLabel: "ดูระเบียบและอัตราดอกเบี้ยเงินให้กู้",
    });
  } else if (debtRatio > 0.35) {
    advice.push({
      title: `ภาระหนี้อยู่ที่ ${Math.round(debtRatio * 100)}% ของรายรับ`,
      detail:
        "ยังพอไหว แต่ใกล้เพดานที่ควรเป็นแล้ว ช่วงนี้ยังไม่ควรก่อหนี้ก้อนใหม่ ถ้าปิดก้อนเล็กที่ดอกเบี้ยแพงที่สุดได้ก่อนจะโล่งขึ้นเร็ว",
      href: "/loans/",
      linkLabel: "เทียบอัตราดอกเบี้ยเงินให้กู้",
    });
  }

  if (saveRatio < 0.05) {
    advice.push({
      title: "เงินออมยังน้อยกว่า 5% ของรายรับ",
      detail:
        "การส่งค่าหุ้นรายเดือนก็คือการออมอย่างหนึ่ง และเงินฝากออมทรัพย์พิเศษของสหกรณ์ได้ดอกเบี้ยสูงกว่าออมทรัพย์ทั่วไป เริ่มจากเดือนละไม่กี่ร้อยก็ยังดีกว่าไม่เริ่ม",
      href: "/deposits/",
      linkLabel: "ดูอัตราดอกเบี้ยเงินรับฝาก",
    });
  } else if (saveRatio < 0.2) {
    advice.push({
      title: `ออมอยู่ ${Math.round(saveRatio * 100)}% ของรายรับ`,
      detail:
        "กำลังไปถูกทางแล้ว เป้าหมายที่ดีคือ 20% ขึ้นไป ถ้าเพิ่มทีเดียวไม่ไหว ลองขยับทีละ 500 บาทต่อเดือน แล้วค่อยเพิ่มตอนเงินเดือนขึ้น",
      href: "/deposits/",
      linkLabel: "ดูประเภทเงินฝากของสหกรณ์",
    });
  }

  if (wantRatio > 0.3) {
    advice.push({
      title: `รายจ่ายส่วนตัวสูงถึง ${Math.round(wantRatio * 100)}% ของรายรับ`,
      detail:
        "กลุ่มนี้คือกลุ่มที่ลดได้เร็วที่สุดโดยไม่กระทบชีวิตประจำวันมากนัก ลองเลือกลดสักสองข้อที่รู้สึกว่าจ่ายไปแบบไม่ค่อยได้อะไรกลับมา",
    });
  }

  if (needRatio > 0.5) {
    advice.push({
      title: `รายจ่ายจำเป็นกินไป ${Math.round(needRatio * 100)}% ของรายรับ`,
      detail:
        "สูงกว่าเกณฑ์ 50% ที่ควรเป็น ของกลุ่มนี้ลดยากกว่ากลุ่มอื่นเพราะเป็นของที่ต้องใช้จริง แต่ค่าไฟ ค่าน้ำมัน และค่าโทรศัพท์ มักลดได้ถ้าตั้งใจ",
    });
  }

  if (advice.length === 0) {
    advice.push({
      title: "ทุกอย่างอยู่ในเกณฑ์ดี",
      detail:
        "ภาระหนี้ไม่สูง มีเงินเหลือปลายเดือน และออมได้ตามเป้า ขั้นต่อไปคือทำให้เงินออมทำงานแทนเรา เช่น เพิ่มค่าหุ้นหรือฝากประจำระยะยาว",
      href: "/deposits/",
      linkLabel: "ดูอัตราดอกเบี้ยเงินรับฝาก",
    });
  }

  /*
    สวัสดิการอยู่ท้ายสุดเสมอ — ไม่ใช่คำแนะนำจากผลตรวจ แต่เป็นสิทธิ์ที่สมาชิกมีอยู่แล้ว
    และมักไม่รู้ว่ามี หลายรายการต้องยื่นขอเองถึงจะได้
  */
  advice.push({
    title: "อย่าลืมสิทธิ์ที่มีอยู่แล้ว",
    detail:
      "สวัสดิการสมาชิกหลายอย่างต้องยื่นขอเองถึงจะได้ เช่น ค่ารักษาพยาบาล ทุนการศึกษาบุตร และสวัสดิการผู้สูงอายุ — บางรายการมีกำหนดวันยื่นด้วย",
    href: "/welfare/",
    linkLabel: "ดูสวัสดิการทั้งหมด",
  });

  return {
    need,
    debt,
    save,
    want,
    spend,
    income,
    left,
    needRatio,
    debtRatio,
    saveRatio,
    wantRatio,
    score,
    level,
    advice,
  };
}
