/**
 * ตรวจสุขภาพการเงิน — คำถาม 21 ข้อ กับสูตรคิดผล
 *
 * โปรแกรมแรกของ "หน้าโปรแกรม" (ดู src/lib/programPages.ts) · เจ้าของเว็บสั่งไว้ 25 ส.ค. 2026
 *
 * ⚠️ **ห้ามให้สมาชิกพิมพ์ตัวเลขเอง** — ทุกข้อตอบด้วยการเลื่อนสเกล เพราะ
 *   1. สมาชิกส่วนใหญ่เปิดจากมือถือ พิมพ์เลขยาว ๆ บนคีย์บอร์ดจอเล็กแล้วเลิกกลางคัน
 *   2. พิมพ์เองได้เมื่อไหร่จะมีคนใส่ "12,000฿" หรือ "หมื่นสอง" แล้วคำนวณไม่ได้
 *   3. ตัวเลขกลม ๆ พอสำหรับการประเมิน ไม่ต้องเป๊ะถึงหลักบาท
 *
 * ⚠️ **ไม่เก็บคำตอบลงฐานเลยสักข้อ** ทุกอย่างอยู่ในเครื่องของคนตอบ กดปิดหน้าก็หายหมด
 * เรื่องเงินในบ้านเป็นข้อมูลอ่อนไหวที่สุดที่เว็บนี้จะแตะได้ ถ้าเก็บก็ต้องมีคนดูแล
 * ต้องมีสิทธิ์เข้าถึง ต้องมีวันลบ — ไม่คุ้มกับประโยชน์ที่ได้
 */

/** กลุ่มของคำถาม — คุมทั้งสีบนจอและวิธีคิดคะแนน */
export type CheckupGroup = "income" | "need" | "debt" | "save" | "want";

export type CheckupQuestion = {
  id: string;
  group: CheckupGroup;
  /** คำถามที่คนตอบเห็น — ถามเป็นภาษาพูด ไม่ใช่ศัพท์บัญชี */
  text: string;
  /** ขยายความว่านับอะไรบ้าง กันคนตอบซ้ำซ้อนกับข้ออื่น */
  hint: string;
  /**
   * ค่าที่เลื่อนเลือกได้ — เก็บเป็นขั้นไม่เท่ากัน (ถี่ตอนเงินน้อย ห่างตอนเงินเยอะ)
   * เพราะความต่างระหว่าง 500 กับ 1,000 สำคัญกว่าความต่างระหว่าง 41,000 กับ 41,500
   */
  steps: number[];
};

export const GROUP_LABEL: Record<CheckupGroup, string> = {
  income: "รายรับ",
  need: "รายจ่ายจำเป็น",
  debt: "ภาระหนี้",
  save: "เงินออม",
  want: "รายจ่ายตามใจ",
};

/** สีประจำกลุ่ม — ใช้ทั้งบนการ์ดคำถามและแท่งสรุปผล ต้องเป็นชื่อคลาสเต็ม (Tailwind อ่านจากซอร์ส) */
export const GROUP_TONE: Record<CheckupGroup, { text: string; bg: string; ring: string; bar: string }> = {
  income: { text: "text-emerald-700", bg: "bg-emerald-50", ring: "ring-emerald-200", bar: "bg-emerald-500" },
  need: { text: "text-sky-700", bg: "bg-sky-50", ring: "ring-sky-200", bar: "bg-sky-500" },
  debt: { text: "text-rose-700", bg: "bg-rose-50", ring: "ring-rose-200", bar: "bg-rose-500" },
  save: { text: "text-violet-700", bg: "bg-violet-50", ring: "ring-violet-200", bar: "bg-violet-500" },
  want: { text: "text-amber-700", bg: "bg-amber-50", ring: "ring-amber-200", bar: "bg-amber-500" },
};

/** สร้างขั้นสเกลจากช่วงที่พบบ่อย — ขั้นถี่ช่วงต้น ห่างขึ้นเรื่อย ๆ */
function steps(...parts: { to: number; by: number }[]): number[] {
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

const SMALL = steps({ to: 2000, by: 100 }, { to: 5000, by: 250 }, { to: 10000, by: 500 });
const MEDIUM = steps({ to: 5000, by: 250 }, { to: 20000, by: 1000 }, { to: 50000, by: 2500 });
const LARGE = steps({ to: 10000, by: 500 }, { to: 50000, by: 1000 }, { to: 150000, by: 5000 });

/**
 * คำถาม 21 ข้อ — เรียงตามลำดับที่ถาม
 *
 * ⚠️ **ข้อความต้องไม่ทับกันเอง** ค่าเช่าบ้านอยู่ข้อ 5 ส่วนค่างวดผ่อนบ้านอยู่กลุ่มหนี้
 * ถ้าถามซ้ำสองที่ คนตอบจะใส่ทั้งสองข้อแล้วรายจ่ายบวมเกินจริงเป็นเท่าตัว
 */
export const CHECKUP_QUESTIONS: CheckupQuestion[] = [
  {
    id: "salary",
    group: "income",
    text: "เงินเดือนที่ได้รับจริงต่อเดือน",
    hint: "ยอดที่โอนเข้าบัญชีจริงหลังหักทุกอย่างแล้ว",
    steps: LARGE,
  },
  {
    id: "extra",
    group: "income",
    text: "รายได้เสริมต่อเดือน",
    hint: "ค่าเวร ค่าล่วงเวลา ค้าขาย เงินปันผล ค่าเช่า — ไม่มีก็เลื่อนไว้ที่ 0",
    steps: MEDIUM,
  },
  {
    id: "food",
    group: "need",
    text: "ค่าอาหารและเครื่องดื่มต่อเดือน",
    hint: "รวมกับข้าวที่บ้าน ข้าวกลางวัน กาแฟ และของกินจุกจิก",
    steps: MEDIUM,
  },
  {
    id: "travel",
    group: "need",
    text: "ค่าเดินทางไปทำงานต่อเดือน",
    hint: "น้ำมัน ค่าโดยสาร ค่าทางด่วน ค่าบำรุงรักษารถ",
    steps: SMALL,
  },
  {
    id: "rent",
    group: "need",
    text: "ค่าเช่าที่พักต่อเดือน",
    hint: "เฉพาะค่าเช่า — ถ้าผ่อนบ้านอยู่ ไปใส่ที่ข้อค่างวดผ่อนบ้าน",
    steps: MEDIUM,
  },
  {
    id: "utility",
    group: "need",
    text: "ค่าน้ำ ค่าไฟ ค่าแก๊สต่อเดือน",
    hint: "รวมทั้งบ้าน ไม่ต้องแยกรายคน",
    steps: SMALL,
  },
  {
    id: "phone",
    group: "need",
    text: "ค่าโทรศัพท์และอินเทอร์เน็ตต่อเดือน",
    hint: "รวมค่าเน็ตบ้าน แพ็กเกจมือถือทุกเครื่องในบ้าน",
    steps: SMALL,
  },
  {
    id: "study",
    group: "need",
    text: "ค่าเล่าเรียนบุตรต่อเดือน",
    hint: "เฉลี่ยค่าเทอมทั้งปีมาเป็นต่อเดือน รวมค่ารถรับส่งและค่าเรียนพิเศษ",
    steps: MEDIUM,
  },
  {
    id: "health",
    group: "need",
    text: "ค่ารักษาพยาบาลและดูแลสุขภาพต่อเดือน",
    hint: "ยาประจำตัว ค่าหมอส่วนที่เบิกไม่ได้ วิตามิน",
    steps: SMALL,
  },
  {
    id: "family",
    group: "need",
    text: "เงินที่ให้พ่อแม่หรือคนในครอบครัวต่อเดือน",
    hint: "เงินที่ส่งให้เป็นประจำทุกเดือน",
    steps: MEDIUM,
  },
  {
    id: "coopLoan",
    group: "debt",
    text: "ค่างวดเงินกู้สหกรณ์ต่อเดือน",
    hint: "ยอดที่ถูกหักจากเงินเดือนทุกเดือน (สามัญ ฉุกเฉิน พิเศษ รวมกัน)",
    steps: MEDIUM,
  },
  {
    id: "homeLoan",
    group: "debt",
    text: "ค่างวดผ่อนบ้านหรือที่ดินต่อเดือน",
    hint: "ค่างวดที่ผ่อนกับธนาคารหรือสถาบันการเงินอื่น",
    steps: MEDIUM,
  },
  {
    id: "carLoan",
    group: "debt",
    text: "ค่างวดผ่อนรถต่อเดือน",
    hint: "รถยนต์ รถจักรยานยนต์ รวมทุกคัน",
    steps: MEDIUM,
  },
  {
    id: "creditLoan",
    group: "debt",
    text: "ค่างวดบัตรเครดิตและสินเชื่อส่วนบุคคลต่อเดือน",
    hint: "ยอดที่จ่ายจริงต่อเดือน รวมบัตรกดเงินสดและสินเชื่อนอกระบบ",
    steps: MEDIUM,
  },
  {
    id: "share",
    group: "save",
    text: "ค่าหุ้นสหกรณ์ที่ส่งต่อเดือน",
    hint: "ยอดที่ถูกหักจากเงินเดือนเป็นค่าหุ้น — นี่คือเงินออมของคุณเอง",
    steps: SMALL,
  },
  {
    id: "deposit",
    group: "save",
    text: "เงินที่ฝากออมไว้ต่อเดือน",
    hint: "ฝากสหกรณ์ ฝากธนาคาร กองทุน หรือออมทองอย่างสม่ำเสมอ",
    steps: MEDIUM,
  },
  {
    id: "insurance",
    group: "save",
    text: "เบี้ยประกันชีวิตและประกันสุขภาพต่อเดือน",
    hint: "เฉลี่ยเบี้ยทั้งปีมาเป็นต่อเดือน",
    steps: SMALL,
  },
  {
    id: "social",
    group: "want",
    text: "ค่าสังสรรค์และงานสังคมต่อเดือน",
    hint: "งานแต่ง งานบวช ทำบุญ ของขวัญ เลี้ยงสังสรรค์",
    steps: SMALL,
  },
  {
    id: "shopping",
    group: "want",
    text: "ค่าช้อปปิ้งและของใช้ส่วนตัวต่อเดือน",
    hint: "เสื้อผ้า เครื่องสำอาง ของใช้ในบ้าน สั่งของออนไลน์",
    steps: SMALL,
  },
  {
    id: "leisure",
    group: "want",
    text: "ค่าความบันเทิงและท่องเที่ยวต่อเดือน",
    hint: "ดูหนัง แอปดูหนังฟังเพลง เที่ยว กีฬา งานอดิเรก",
    steps: SMALL,
  },
  {
    id: "misc",
    group: "want",
    text: "ค่าใช้จ่ายจิปาถะอื่น ๆ ต่อเดือน",
    hint: "ของที่นึกไม่ออกว่าไปอยู่ข้อไหน แต่รู้ว่าเสียทุกเดือน",
    steps: SMALL,
  },
];

export type CheckupAnswers = Record<string, number>;

/** ยอดรวมของกลุ่มหนึ่ง */
export const groupTotal = (answers: CheckupAnswers, group: CheckupGroup): number =>
  CHECKUP_QUESTIONS.filter((q) => q.group === group).reduce((sum, q) => sum + (answers[q.id] ?? 0), 0);

export type CheckupResult = {
  income: number;
  need: number;
  debt: number;
  save: number;
  want: number;
  /** รายจ่ายรวมทุกอย่างที่ไหลออกใน 1 เดือน (รวมเงินออมด้วย เพราะเงินออกจากมือเหมือนกัน) */
  spend: number;
  /** รายรับ − รายจ่าย — ติดลบคือใช้เกินตัว */
  left: number;
  /** สัดส่วนต่อรายรับ 0-1 · รายรับเป็น 0 จะได้ 0 ทั้งหมด ไม่ใช่ Infinity */
  needRatio: number;
  debtRatio: number;
  saveRatio: number;
  wantRatio: number;
  /** คะแนนสุขภาพการเงิน 0-100 */
  score: number;
  level: { key: "great" | "good" | "fair" | "risk"; label: string; tone: string; summary: string };
  advice: { title: string; detail: string; href?: string; linkLabel?: string }[];
};

/** คะแนนย่อยแบบไล่ระดับ — ดีกว่าเกณฑ์ = เต็ม, แย่กว่ามาก = 0, ระหว่างนั้นไล่เป็นเส้นตรง */
function band(value: number, best: number, worst: number): number {
  if (best < worst) {
    // ยิ่งน้อยยิ่งดี (ภาระหนี้ รายจ่าย)
    if (value <= best) return 1;
    if (value >= worst) return 0;
    return (worst - value) / (worst - best);
  }
  // ยิ่งมากยิ่งดี (เงินออม)
  if (value >= best) return 1;
  if (value <= worst) return 0;
  return (value - worst) / (best - worst);
}

const money = (n: number) => n.toLocaleString("th-TH");

/**
 * คิดผลตรวจจากคำตอบ
 *
 * เกณฑ์ที่ใช้ — อิงหลัก 50/30/20 ที่ใช้กันทั่วไป ปรับให้เข้ากับสมาชิกสหกรณ์
 * ที่หนี้ส่วนใหญ่ถูกหักจากเงินเดือนอยู่แล้ว:
 *   ภาระหนี้ ไม่ควรเกิน 35% ของรายรับ (เกิน 45% = เสี่ยง)
 *   เงินออม ควรได้ 20% ขึ้นไป (ต่ำกว่า 5% = ยังไม่มีกันชน)
 *   รายจ่ายจำเป็น ไม่ควรเกิน 50%
 */
export function checkupResult(answers: CheckupAnswers): CheckupResult {
  const income = groupTotal(answers, "income");
  const need = groupTotal(answers, "need");
  const debt = groupTotal(answers, "debt");
  const save = groupTotal(answers, "save");
  const want = groupTotal(answers, "want");
  const spend = need + debt + save + want;
  const left = income - spend;

  const share = (value: number) => (income > 0 ? value / income : 0);
  const needRatio = share(need);
  const debtRatio = share(debt);
  const saveRatio = share(save);
  const wantRatio = share(want);

  /*
    ถ่วงน้ำหนักตามสิ่งที่ทำให้เดือดร้อนจริงเรียงจากมากไปน้อย —
    หนี้ท่วมทำให้เดือดร้อนที่สุด รองมาคือไม่มีเงินเหลือ แล้วค่อยเรื่องออมน้อย
  */
  const score = Math.round(
    100 *
      (0.35 * band(debtRatio, 0.35, 0.6) +
        0.3 * band(share(Math.max(left, 0)), 0.1, 0) +
        0.25 * band(saveRatio, 0.2, 0.05) +
        0.1 * band(needRatio, 0.5, 0.75)),
  );

  const level: CheckupResult["level"] =
    income === 0
      ? {
          key: "fair",
          label: "ยังประเมินไม่ได้",
          tone: "text-gray-600",
          summary: "ยังไม่ได้ใส่รายรับ ลองย้อนกลับไปตอบข้อแรกใหม่อีกครั้ง",
        }
      : score >= 80
        ? {
            key: "great",
            label: "แข็งแรงมาก",
            tone: "text-emerald-700",
            summary: "รายรับ รายจ่าย และเงินออมสมดุลดี รักษาแบบนี้ไว้",
          }
        : score >= 65
          ? {
              key: "good",
              label: "แข็งแรงดี",
              tone: "text-sky-700",
              summary: "ภาพรวมอยู่ในเกณฑ์ดี มีบางจุดที่ปรับแล้วจะดีขึ้นอีก",
            }
          : score >= 50
            ? {
                key: "fair",
                label: "พอไปได้ แต่ต้องระวัง",
                tone: "text-amber-700",
                summary: "ยังไม่ถึงกับมีปัญหา แต่ถ้ามีเรื่องด่วนเข้ามาจะสะเทือนทันที",
              }
            : {
                key: "risk",
                label: "ควรรีบปรับ",
                tone: "text-rose-700",
                summary: "รายจ่ายกับภาระหนี้กินรายรับไปมาก ควรวางแผนแก้ตั้งแต่ตอนนี้",
              };

  const advice: CheckupResult["advice"] = [];

  if (income === 0) {
    advice.push({
      title: "ยังไม่ได้ใส่รายรับ",
      detail: "ผลตรวจคิดจากสัดส่วนต่อรายรับทั้งหมด ถ้ารายรับเป็น 0 จะเทียบอะไรไม่ได้เลย",
    });
  }

  if (left < 0) {
    advice.push({
      title: `เดือนนี้ใช้เกินตัว ${money(Math.abs(left))} บาท`,
      detail:
        "รายจ่ายรวมมากกว่ารายรับ ถ้าเป็นแบบนี้ทุกเดือนแปลว่ากำลังกินเงินเก็บหรือก่อหนี้ใหม่มาโปะ — ลองดูกลุ่มรายจ่ายตามใจก่อน เพราะลดได้เร็วที่สุด",
    });
  } else if (income > 0 && left / income < 0.1) {
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

  if (income > 0 && saveRatio < 0.05) {
    advice.push({
      title: "เงินออมยังน้อยกว่า 5% ของรายรับ",
      detail:
        "การส่งค่าหุ้นรายเดือนก็คือการออมอย่างหนึ่ง และเงินฝากออมทรัพย์พิเศษของสหกรณ์ได้ดอกเบี้ยสูงกว่าออมทรัพย์ทั่วไป เริ่มจากเดือนละไม่กี่ร้อยก็ยังดีกว่าไม่เริ่ม",
      href: "/deposits/",
      linkLabel: "ดูอัตราดอกเบี้ยเงินรับฝาก",
    });
  } else if (income > 0 && saveRatio < 0.2) {
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
      title: `รายจ่ายตามใจสูงถึง ${Math.round(wantRatio * 100)}% ของรายรับ`,
      detail:
        "กลุ่มนี้คือกลุ่มที่ลดได้เร็วที่สุดโดยไม่กระทบชีวิตประจำวันมากนัก ลองเลือกลดสักสองข้อที่รู้สึกว่าจ่ายไปแบบไม่ค่อยได้อะไรกลับมา",
    });
  }

  if (needRatio > 0.5) {
    advice.push({
      title: `รายจ่ายจำเป็นกินไป ${Math.round(needRatio * 100)}% ของรายรับ`,
      detail:
        "สูงกว่าเกณฑ์ 50% ที่ควรเป็น ของกลุ่มนี้ลดยากกว่ากลุ่มอื่นเพราะเป็นของที่ต้องใช้จริง แต่ค่าน้ำค่าไฟและค่าเดินทางมักลดได้ถ้าตั้งใจ",
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
    สวัสดิการอยู่ท้ายสุดเสมอ — ไม่ใช่คำแนะนำจากผลตรวจ แต่เป็นของที่สมาชิกมีสิทธิ์อยู่แล้ว
    และมักไม่รู้ว่ามี ถือเป็นรายรับที่ลืมนับไปในหลายกรณี
  */
  advice.push({
    title: "อย่าลืมสิทธิ์ที่มีอยู่แล้ว",
    detail:
      "สวัสดิการสมาชิกหลายอย่างต้องยื่นขอเองถึงจะได้ เช่น ค่ารักษาพยาบาล ทุนการศึกษาบุตร และสวัสดิการผู้สูงอายุ — บางรายการมีกำหนดวันยื่นด้วย",
    href: "/welfare/",
    linkLabel: "ดูสวัสดิการทั้งหมด",
  });

  return {
    income,
    need,
    debt,
    save,
    want,
    spend,
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
