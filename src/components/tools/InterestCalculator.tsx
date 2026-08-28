"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronRight,
  ClipboardList,
  Coins,
  Info,
  Keyboard,
  Phone,
  PiggyBank,
  Printer,
  RotateCcw,
  Share2,
} from "lucide-react";
import {
  AMOUNT_CHIPS,
  COMPARE_DAYS,
  DAY_BASES,
  DAY_CHIPS,
  LEGAL_MAX_MONTHLY,
  LEGAL_MAX_YEARLY,
  SAMPLE_DAYS,
  SAMPLE_PRINCIPAL,
  SAMPLE_RATE,
  autoBasis,
  calcInterest,
  daysBetween,
  money,
  plain,
  readNumber,
  readRateText,
  thaiDate,
  todayISO,
  type DayBasis,
  type RateKind,
  type RateRow,
} from "@/lib/interestCalc";
import { fadeSwap, STACKED } from "@/lib/slideMotion";
import {
  INTEREST_CREDIT,
  INTEREST_VERSION,
  type InterestIntro,
} from "@/lib/programPages";

/**
 * โปรแกรมคำนวณดอกเบี้ย — เดินทีละขั้น 3 ขั้น (เจ้าของเว็บสั่งไว้ 28 ส.ค. 2026)
 *
 *   ขั้นที่ 1 กรอกตัวเลข 3 ข้อย่อย → ขั้นที่ 2 ผลคำนวณ → ขั้นที่ 3 สรุปและอธิบายวิธีคิด
 *
 * ⚠️ **โชว์ทีละขั้น ห้ามเอาทั้งสามขั้นมากองในหน้าเดียว** — ของเดิมวางช่องกรอกกับผลลัพธ์
 * ต่อกันลงมาทั้งหมด หน้าจึงยาวมากและอ่านไม่ออกว่าต้องดูตรงไหนก่อน
 *
 * ⚠️ **กรอกไม่ครบ = ค้างอยู่ขั้นที่ 1** ไม่พาไปขั้นต่อไปและไม่โผล่ผลลัพธ์ครึ่ง ๆ กลาง ๆ
 * ขั้นที่เดินไปไม่ได้จึงถูกกันไว้ **สองชั้น**: ปุ่ม "ดูผลคำนวณ" กดไม่ได้ และตัว `view`
 * ที่คำนวณจากสถานะจริงทุกครั้งที่ render (ไม่ได้เก็บไว้ใน state ตัวที่สอง) — ย้อนกลับ
 * ไปลบตัวเลขในขั้นที่ 1 ทิ้งเมื่อไหร่ ขั้นที่ 2/3 ก็หายเองทันทีโดยไม่ต้องมี useEffect คอยไล่แก้
 *
 * ⚠️ **ห้ามเอาสูตรคณิตศาสตร์กลับมาไว้ขั้นที่ 1 หรือขั้นที่ 2** (เจ้าของเว็บสั่ง 28 ส.ค. 2026)
 * ของเดิมมีเศษส่วนตัวใหญ่คร่อมหัวการ์ดตั้งแต่ยังไม่ได้กรอกอะไร ซึ่งบังตาและทำให้ดูยาก
 * ที่มาของตัวเลขไปอธิบาย **ด้วยภาษาพูดทีละขั้นในขั้นที่ 3** แทน (`Timeline`)
 *
 * ⚠️ **ไม่ส่งอะไรไปไหนทั้งนั้น** ไม่มี fetch ไม่มี localStorage — ตัวเลขหนี้สินของสมาชิก
 * เป็นข้อมูลอ่อนไหว หลักเดียวกับโปรแกรมตรวจสุขภาพการเงิน · ปุ่มแชร์ใช้ share sheet
 * ของเครื่องผู้ใช้เอง (คนกดเป็นคนเลือกปลายทาง) ไม่ได้ยิงข้อความไปที่ไหนเอง
 */

/**
 * ข้อย่อยของขั้นที่ 1 — **ถามทีละข้อ ไม่กองมาพร้อมกันทั้งสามข้อ**
 * (เจ้าของเว็บสั่ง 28 ส.ค. 2026 หลังเห็นของจริงที่ขึ้นครบสามข้อในจอเดียวแล้วรู้สึกแน่น)
 * หลักเดียวกับโปรแกรมตรวจสุขภาพการเงินที่ถามทีละข้อ
 */
type SubStep = 1 | 2 | 3;

/** ชื่อสั้นของข้อย่อย — ใช้ทั้งบนหลอดความคืบหน้าและข้อความ "ยังต้องกรอก" */
const ASK_TITLE: Record<SubStep, string> = {
  1: "เงินต้น",
  2: "อัตราดอกเบี้ย",
  3: "ระยะเวลา",
};

/** ชื่อขั้นที่โชว์บนแถบบอกขั้น — แก้ที่นี่ที่เดียว ทั้งแถบบนและหัวการ์ดใช้ชุดนี้ */
const STEPS = [
  { no: 1, label: "กรอกตัวเลข", hint: "เงินต้น · ดอกเบี้ย · ระยะเวลา" },
  { no: 2, label: "ผลคำนวณ", hint: "ได้/จ่ายดอกเบี้ยกี่บาท" },
  { no: 3, label: "สรุป", hint: "อธิบายที่มาทีละขั้น" },
] as const;

/**
 * ถ้อยคำของสองฝั่ง — **สูตรคิดเลขเหมือนกันเป๊ะ ต่างกันแค่คำที่อ่านและคำเตือนท้ายผล**
 *
 * ⚠️ **ห้ามใช้คำของฝั่งเงินกู้กับเงินฝากปนกัน** สมาชิกอ่านแล้วเข้าใจกลับด้านได้ทันที
 * ("ดอกเบี้ยที่ต้องจ่าย" ในหน้าเงินฝากคือเข้าใจผิดว่าฝากเงินแล้วต้องเสียดอกเบี้ย)
 * เพิ่มข้อความใหม่ในหน้านี้ต้องมาเพิ่มทั้งสองฝั่งที่นี่เสมอ ไม่ใช่เขียนตรง ๆ ใน JSX
 */
const WORDS: Record<
  RateKind,
  {
    tab: string;
    principal: string;
    principalHint: string;
    rateStep: string;
    rateHint: string;
    daysStep: string;
    endLabel: string;
    result: string;
    perDayWord: string;
    total: string;
    totalHint: string;
    compare: string;
    /** ประโยคอธิบายในขั้นที่ 3 — เขียนแบบพูดกับคน ไม่ใช่ภาษาสูตร */
    saidPrincipal: (baht: string, rate: string) => string;
    saidPerDay: (baht: string) => string;
    saidTotal: (days: string, baht: string) => string;
  }
> = {
  loan: {
    tab: "เงินกู้",
    principal: "เงินต้นคงค้าง",
    principalHint: "ยอดหนี้ที่ยังไม่ได้ชำระ ณ วันที่เริ่มคิดดอกเบี้ย",
    rateStep: "เลือกร้อยละดอกเบี้ยเงินกู้",
    rateHint: "กดเลือกจากอัตราของสหกรณ์ หรือดูจากสัญญาเงินกู้แล้วกรอกเอง",
    daysStep: "เลือกระยะเวลาที่คิดดอกเบี้ย",
    endLabel: "วันที่ชำระ",
    result: "ดอกเบี้ยที่ต้องจ่าย",
    perDayWord: "ชำระเร็วขึ้น 1 วัน ประหยัดได้เท่านี้",
    total: "ยอดรวมที่ต้องจ่าย",
    totalHint: "ถ้าปิดหนี้ทั้งก้อนในวันที่ชำระ",
    compare: "ถ้าเงินต้นและอัตราเท่าเดิม แต่ทิ้งไว้นานขึ้น",
    saidPrincipal: (baht, rate) =>
      `ยอดเงินต้นของท่าน ${baht} บาท คิดดอกเบี้ยร้อยละ ${rate} ต่อปี`,
    saidPerDay: (baht) => `ตกเป็นดอกเบี้ยวันละประมาณ ${baht} บาท`,
    saidTotal: (days, baht) => `รวม ${days} วัน จึงเป็นเงินดอกเบี้ยที่ต้องจ่ายทั้งสิ้น ${baht} บาท`,
  },
  deposit: {
    tab: "เงินรับฝาก",
    principal: "เงินที่ฝาก",
    principalHint: "ยอดเงินฝากคงเหลือ ณ วันที่เริ่มคิดดอกเบี้ย",
    rateStep: "เลือกร้อยละดอกเบี้ยเงินรับฝาก",
    rateHint: "กดเลือกจากอัตราของสหกรณ์ หรือดูจากสมุดคู่ฝากแล้วกรอกเอง",
    daysStep: "เลือกระยะเวลาที่ฝาก",
    endLabel: "วันที่ถอน",
    result: "ดอกเบี้ยที่จะได้รับ",
    perDayWord: "ฝากต่ออีก 1 วัน ได้เพิ่มเท่านี้",
    total: "ยอดรวมที่จะได้รับ",
    totalHint: "ถ้าถอนทั้งก้อนในวันที่ถอน",
    compare: "ถ้าเงินฝากและอัตราเท่าเดิม แต่ฝากไว้นานขึ้น",
    saidPrincipal: (baht, rate) => `ยอดเงินฝากของท่าน ${baht} บาท ได้ดอกเบี้ยร้อยละ ${rate} ต่อปี`,
    saidPerDay: (baht) => `ตกเป็นดอกเบี้ยวันละประมาณ ${baht} บาท`,
    saidTotal: (days, baht) => `รวม ${days} วัน จึงเป็นเงินดอกเบี้ยที่จะได้รับทั้งสิ้น ${baht} บาท`,
  },
};

export default function InterestCalculator({
  loanRates,
  depositRates,
  intro,
  contactPhone,
  lineId,
}: {
  /**
   * อัตราดอกเบี้ยที่ให้ขึ้นเป็นการ์ดให้กด — เจ้าหน้าที่ตั้งตัวเลขที่ หลังบ้าน → อัตราดอกเบี้ย
   * แล้วเลือกว่าประเภทไหนให้ขึ้นในโปรแกรมนี้ที่ หลังบ้าน → หน้าโปรแกรม
   * (หน้าเว็บกรองมาให้แล้วด้วย visibleRates — ที่นี่ไม่ต้องกรองซ้ำ)
   */
  loanRates: RateRow[];
  /** อัตราดอกเบี้ยเงินรับฝาก — ชุดเดียวกับที่ขึ้นการ์ดหน้าแรก กรองมาแล้วเหมือนกัน */
  depositRates: RateRow[];
  /** คำอธิบายว่าโปรแกรมนี้มีไว้ทำอะไร — เจ้าหน้าที่แก้ได้ที่ หลังบ้าน → หน้าโปรแกรม */
  intro: InterestIntro;
  /** เบอร์สหกรณ์ — แอดมินแก้ได้ที่ หลังบ้าน → ส่วนท้ายเว็บ (ห้ามฝังเบอร์ไว้ในโค้ด) */
  contactPhone: string;
  /** ไอดีไลน์ของสหกรณ์ — มาจากที่เดียวกัน เว้นว่าง = ไม่แสดงบรรทัดไลน์ */
  lineId: string;
}) {
  /* การ์ดอัตราดอกเบี้ยทั้งสองฝั่ง — เอาเฉพาะรายการที่อ่านเป็นตัวเลขได้ และตัดตัวซ้ำออก */
  const chipsOf = useMemo(() => {
    const build = (rows: RateRow[]) => {
      const seen = new Set<number>();
      return rows
        .map((row) => ({ label: row.label, rate: readRateText(row.rate) }))
        .filter((row) => {
          if (row.rate <= 0 || seen.has(row.rate)) return false;
          seen.add(row.rate);
          return true;
        });
    };
    return { loan: build(loanRates), deposit: build(depositRates) };
  }, [loanRates, depositRates]);

  /** คิดฝั่งไหนอยู่ — เงินกู้ที่ต้องจ่าย หรือเงินรับฝากที่จะได้รับ */
  const [kind, setKind] = useState<RateKind>("loan");
  const rateCards = chipsOf[kind];
  const words = WORDS[kind];

  const [principalText, setPrincipalText] = useState(String(SAMPLE_PRINCIPAL));
  // ตั้งต้นด้วยอัตราจริงของสหกรณ์ถ้ามี — ไม่มีค่อยใช้เลขในตัวอย่างของใบประชาสัมพันธ์
  const [rateText, setRateText] = useState(() => String(chipsOf.loan[0]?.rate ?? SAMPLE_RATE));
  const [daysText, setDaysText] = useState(String(SAMPLE_DAYS));

  /** เลือกอัตราจากการ์ด หรือกรอกเอง — ไม่มีการ์ดให้เลือกเลยก็เหลือทางเดียวคือกรอกเอง */
  const [rateMode, setRateMode] = useState<"pick" | "type">("pick");

  /** นับวันเอง หรือให้ระบบนับจากปฏิทิน */
  const [mode, setMode] = useState<"days" | "dates">("days");
  const [from, setFrom] = useState(() => todayISO());
  const [to, setTo] = useState(() => todayISO());

  /** ขั้นที่กดค้างไว้ — ขั้นที่ "เห็นจริง" คือ view ด้านล่าง ซึ่งกันขั้นที่ยังไปไม่ได้ออกให้เอง */
  const [step, setStep] = useState<1 | 2 | 3>(1);
  /** ข้อย่อยของขั้นที่ 1 ที่กำลังถามอยู่ — ถามทีละข้อ */
  const [sub, setSub] = useState<SubStep>(1);

  // วันที่ออกใบสรุป — ล็อกไว้ตอนเปิดหน้า ไม่ให้เปลี่ยนเองกลางคันตอนข้ามเที่ยงคืน
  const [printedAt] = useState(() => todayISO());

  const principal = readNumber(principalText);
  const rate = readNumber(rateText);

  /** จำนวนวันที่เอาไปคิดจริง — โหมดปฏิทินนับให้จากวันที่สองช่อง */
  const picked = mode === "dates" ? daysBetween(from, to) : null;
  const days = mode === "dates" ? (picked ?? 0) : readNumber(daysText);
  /** วันชำระอยู่ก่อนวันเริ่ม = กรอกสลับกัน ต้องบอกให้แก้ ไม่ใช่คิดเป็น 0 เงียบ ๆ */
  const badRange = mode === "dates" && picked === null;

  /**
   * ตัวหาร 365/366 — **ระบบเลือกให้เอง ไม่ได้โชว์เป็นตัวเลือกกลางหน้าแล้ว**
   * `null` = ให้ระบบเลือก · ใส่เลขมา = คนกดบังคับเองจาก "ตัวเลือกเพิ่มเติม"
   */
  const [forcedBasis, setForcedBasis] = useState<DayBasis | null>(null);
  const suggested = autoBasis(mode === "dates" && !badRange, from, to);
  const basis = forcedBasis ?? suggested;

  const result = useMemo(
    () => calcInterest({ principal, rate, days, basis }),
    [principal, rate, days, basis],
  );

  /** ดอกเบี้ยเต็มปีของเงินต้นก้อนนี้ — ใช้อธิบายที่มาในขั้นที่ 3 */
  const yearly = (principal * rate) / 100;

  /** ผ่านขั้นที่ 1 แล้วหรือยัง — ครบทั้งสามข้อและวันที่ไม่สลับกัน */
  const canGo = result.ready && !badRange;

  /**
   * ขั้นที่แสดงจริง — คิดใหม่ทุกครั้งที่ render ไม่ได้เก็บเป็น state อีกตัว
   * (ห้าม setState ใน useEffect ตามกฎ react-hooks/set-state-in-effect ใน AGENTS.md)
   */
  const view: 1 | 2 | 3 = canGo ? step : 1;

  /** ข้อย่อยที่กำลังถามอยู่ตอบครบแล้วหรือยัง — ปุ่ม "ถัดไป" กดได้ก็ต่อเมื่อข้อนี้ผ่าน */
  const subReady =
    sub === 1 ? principal > 0 : sub === 2 ? rate > 0 : days > 0 && !badRange;

  /** ชื่อประเภทที่ตรงกับอัตราที่เลือก — เอาไปเขียนในใบสรุปให้รู้ว่าคิดของอะไร */
  const rateName = rateCards.find((row) => row.rate === rate)?.label ?? "";

  /**
   * ข้อที่ตอบไปแล้วและไม่ใช่ข้อที่กำลังถามอยู่ — เอาไปทำก้อนสรุปท้ายการ์ด
   * กดก้อนไหนก็กลับไปแก้ข้อนั้นได้ ไม่ต้องกดถอยทีละข้อ
   */
  const answered: { no: SubStep; label: string; value: string }[] = [
    { no: 1 as SubStep, label: "เงินต้น", value: `${plain(principal)} บาท`, ok: principal > 0 },
    { no: 2 as SubStep, label: "ดอกเบี้ย", value: `${rate}% ต่อปี`, ok: rate > 0 },
    { no: 3 as SubStep, label: "ระยะเวลา", value: `${plain(days)} วัน`, ok: days > 0 && !badRange },
  ]
    .filter((item) => item.ok && item.no !== sub)
    .map(({ no, label, value }) => ({ no, label, value }));

  /**
   * สลับฝั่งเงินกู้ ↔ เงินรับฝาก — **ต้องเปลี่ยนอัตราให้ตามฝั่งใหม่ด้วย**
   * ไม่งั้นจะค้างอัตราเงินกู้ 5-6% ไว้ในหน้าเงินฝากซึ่งเป็นตัวเลขที่เป็นไปไม่ได้
   * (เปลี่ยนตรงนี้ในตัวจัดการปุ่ม ไม่ใช่ใน useEffect — ดูกฎ set-state-in-effect ใน AGENTS.md)
   */
  const switchKind = (next: RateKind) => {
    if (next === kind) return;
    setKind(next);
    setRateText(String(chipsOf[next][0]?.rate ?? (next === "loan" ? SAMPLE_RATE : "")));
    setRateMode(chipsOf[next].length > 0 ? "pick" : "type");
    setStep(1);
    setSub(1);
  };

  const reset = () => {
    setPrincipalText(String(SAMPLE_PRINCIPAL));
    setRateText(String(rateCards[0]?.rate ?? SAMPLE_RATE));
    setDaysText(String(SAMPLE_DAYS));
    setRateMode(rateCards.length > 0 ? "pick" : "type");
    setForcedBasis(null);
    setMode("days");
    setFrom(todayISO());
    setTo(todayISO());
    setStep(1);
    setSub(1);
  };

  /** ข้อความที่ส่งให้ลูกหลานอ่าน — สรุปครบในข้อความเดียว ไม่ต้องเปิดเว็บตามก็เข้าใจ */
  const shareText = [
    `${words.tab} ${plain(principal)} บาท · ดอกเบี้ยร้อยละ ${rate} ต่อปี · ${plain(days)} วัน`,
    `${words.result} ${money(result.interest)} บาท`,
    `${words.total} ${money(result.total)} บาท`,
    "คำนวณจากโปรแกรมคำนวณดอกเบี้ย สหกรณ์ออมทรัพย์สาธารณสุขสงขลา จำกัด",
  ].join("\n");

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      {/* ---------------- แถบบอกขั้น ---------------- */}
      <Stepper current={view} canGo={canGo} onPick={setStep} />

      {/*
        ทุกขั้นวางไว้ในช่องกริดเดียวกัน (STACKED) แล้วจางสลับ — ห้ามใส่ mode="wait"
        ไม่งั้นจะมีจังหวะว่างหนึ่งวูบทุกครั้งที่กดขั้นถัดไป (กฎเดียวกับสไลด์ทั้งเว็บ ดู AGENTS.md)
      */}
      <div className="grid">
        <AnimatePresence initial={false}>
          {view === 1 && (
            <motion.div key="step1" {...fadeSwap(0.35)} style={STACKED}>
              {/* ---------------- ขั้นที่ 1 กรอกตัวเลข 3 ข้อย่อย ---------------- */}
              <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/5">
                {/*
                  สลับฝั่งก่อนเป็นอย่างแรก — วางไว้บนสุด เพราะมันเปลี่ยนความหมาย
                  ของทุกข้อที่อยู่ใต้ลงไป ถ้าไปวางท้ายฟอร์มคนจะกรอกเสร็จแล้วค่อยเห็น
                */}
                <div className="no-print flex items-center gap-2 border-b border-gray-100 bg-gray-50/70 px-5 py-3 md:px-8">
                  <span className="text-sm text-gray-500">คิดดอกเบี้ยของ</span>
                  <div className="flex rounded-full bg-white p-1 text-sm ring-1 ring-gray-200">
                    {(["loan", "deposit"] as const).map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => switchKind(value)}
                        className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 font-semibold transition ${
                          kind === value
                            ? "bg-brand-600 text-white shadow"
                            : "text-gray-500 hover:text-brand-700"
                        }`}
                      >
                        {value === "loan" ? (
                          <Coins className="h-4 w-4" />
                        ) : (
                          <PiggyBank className="h-4 w-4" />
                        )}
                        {WORDS[value].tab}
                      </button>
                    ))}
                  </div>
                </div>

                {/* หลอดบอกว่าอยู่ข้อไหนใน 3 ข้อ — ข้อย่อยถามทีละข้อ ไม่กองมาพร้อมกัน */}
                <div className="px-5 pt-5 md:px-8">
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-semibold text-brand-700">ข้อ {sub} จาก 3</span>
                    <span className="text-gray-400">{ASK_TITLE[sub]}</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-brand-500 transition-all duration-300"
                      style={{ width: `${(sub / 3) * 100}%` }}
                    />
                  </div>
                </div>

                {/*
                  ข้อย่อยทั้งสามวางซ้อนในช่องกริดเดียวกันแล้วจางสลับ (หลักเดียวกับขั้นใหญ่)
                  ⚠️ ห้าม mode="wait" — จะมีวูบว่างหนึ่งจังหวะทุกครั้งที่กดข้อถัดไป
                */}
                <div className="grid px-5 py-6 md:px-8">
                  <AnimatePresence initial={false}>
                    {sub === 1 && (
                      <motion.div key="ask1" {...fadeSwap(0.3)} style={STACKED}>
                  <Ask no={1} title={`ระบุ${words.principal}`} hint={words.principalHint}>
                    <div className="relative mt-3">
                      {/*
                        ⚠️ type="text" + inputMode ตั้งใจ ไม่ใช้ type="number"
                        — บนมือถือยังได้แป้นตัวเลขเหมือนกัน แต่ไม่มีลูกศรขึ้นลงมากวน
                        และไม่โดนเบราว์เซอร์ล้างค่าทิ้งทั้งช่องเวลาพิมพ์จุลภาคหรือเลขไทยติดมา
                        ⚠️ ตัวใหญ่พิเศษตั้งใจ (text-3xl) — สมาชิกสูงอายุอ่านเลขในช่องนี้ไม่ชัด
                      */}
                      <input
                        id="principal"
                        type="text"
                        inputMode="decimal"
                        value={principalText}
                        onChange={(e) => setPrincipalText(e.target.value)}
                        onFocus={(e) => e.currentTarget.select()}
                        className="w-full rounded-2xl border-2 border-gray-200 bg-white py-4 pl-5 pr-20 text-3xl font-bold tabular-nums text-gray-800 shadow-sm outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
                      />
                      <span className="pointer-events-none absolute inset-y-0 right-5 flex items-center text-base font-medium text-gray-400">
                        บาท
                      </span>
                    </div>
                    <Chips
                      items={AMOUNT_CHIPS.map((amount) => ({ key: amount, label: plain(amount) }))}
                      active={principal}
                      onPick={(next) => setPrincipalText(String(next))}
                    />
                  </Ask>
                      </motion.div>
                    )}

                    {sub === 2 && (
                      <motion.div key="ask2" {...fadeSwap(0.3)} style={STACKED}>
                  <Ask no={2} title={words.rateStep} hint={words.rateHint}>
                    {rateCards.length > 0 && (
                      <div className="no-print mt-3 flex rounded-full bg-gray-100 p-1 text-sm">
                        <button
                          type="button"
                          onClick={() => setRateMode("pick")}
                          className={`flex-1 rounded-full px-3.5 py-1.5 font-medium transition ${
                            rateMode === "pick" ? "bg-white text-brand-700 shadow-sm" : "text-gray-500"
                          }`}
                        >
                          เลือกจากอัตราของสหกรณ์
                        </button>
                        <button
                          type="button"
                          onClick={() => setRateMode("type")}
                          className={`flex-1 rounded-full px-3.5 py-1.5 font-medium transition ${
                            rateMode === "type" ? "bg-white text-brand-700 shadow-sm" : "text-gray-500"
                          }`}
                        >
                          <span className="inline-flex items-center gap-1.5">
                            <Keyboard className="h-3.5 w-3.5" /> กรอกเอง
                          </span>
                        </button>
                      </div>
                    )}

                    {rateMode === "pick" && rateCards.length > 0 ? (
                      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                        {rateCards.map((row) => {
                          const on = row.rate === rate;
                          return (
                            <li key={row.rate}>
                              <button
                                type="button"
                                onClick={() => setRateText(String(row.rate))}
                                aria-pressed={on}
                                className={`flex h-full w-full items-center gap-3 rounded-2xl px-4 py-3 text-left ring-1 transition ${
                                  on
                                    ? "bg-brand-50 ring-2 ring-brand-500"
                                    : "bg-white ring-gray-200 hover:bg-gray-50"
                                }`}
                              >
                                <span
                                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ring-1 transition ${
                                    on
                                      ? "bg-brand-600 text-white ring-brand-600"
                                      : "bg-white text-transparent ring-gray-300"
                                  }`}
                                >
                                  <Check className="h-3.5 w-3.5" />
                                </span>
                                {/* min-w-0 กันชื่อยาว ๆ ภาษาไทยดันการ์ดจนล้น (ดู AGENTS.md) */}
                                <span className="min-w-0 flex-1 text-sm leading-snug text-gray-700">
                                  {row.label}
                                </span>
                                <span
                                  className={`shrink-0 text-lg font-bold tabular-nums ${on ? "text-brand-700" : "text-gray-800"}`}
                                >
                                  {row.rate}%
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <NumberBox
                        id="rate"
                        unit="% ต่อปี"
                        value={rateText}
                        onChange={setRateText}
                        className="mt-3"
                      />
                    )}
                  </Ask>
                      </motion.div>
                    )}

                    {sub === 3 && (
                      <motion.div key="ask3" {...fadeSwap(0.3)} style={STACKED}>
                  <Ask no={3} title={words.daysStep} hint="กดปุ่มสำเร็จรูป หรือเลือกวันจากปฏิทินก็ได้">
                    <div className="no-print mt-3 flex flex-wrap gap-2">
                      {DAY_CHIPS.map((chip) => {
                        const on = mode === "days" && days === chip.days;
                        return (
                          <button
                            key={chip.days}
                            type="button"
                            onClick={() => {
                              setMode("days");
                              setDaysText(String(chip.days));
                            }}
                            className={`rounded-full px-5 py-2.5 text-base font-semibold tabular-nums transition ${
                              on
                                ? "bg-brand-600 text-white shadow"
                                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                            }`}
                          >
                            {chip.label}
                          </button>
                        );
                      })}
                    </div>

                    <div className="no-print mt-3 flex flex-wrap items-center gap-2 text-sm">
                      <button
                        type="button"
                        onClick={() => setMode(mode === "dates" ? "days" : "dates")}
                        className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 font-medium transition ${
                          mode === "dates"
                            ? "bg-brand-50 text-brand-700 ring-1 ring-brand-200"
                            : "text-gray-500 hover:bg-gray-100"
                        }`}
                      >
                        <CalendarDays className="h-4 w-4" /> เลือกจากปฏิทิน
                      </button>
                      {mode === "days" && (
                        <span className="text-gray-400">
                          หรือพิมพ์จำนวนวันเองในช่องด้านล่าง
                        </span>
                      )}
                    </div>

                    {mode === "days" ? (
                      <NumberBox
                        id="days"
                        unit="วัน"
                        value={daysText}
                        onChange={setDaysText}
                        className="mt-3"
                      />
                    ) : (
                      <>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <DateBox
                            id="from"
                            label="วันที่เริ่มคิดดอกเบี้ย"
                            value={from}
                            onChange={setFrom}
                          />
                          <DateBox id="to" label={words.endLabel} value={to} onChange={setTo} />
                        </div>
                        <p
                          className={`mt-2 text-sm ${badRange ? "font-medium text-red-600" : "text-gray-500"}`}
                        >
                          {badRange
                            ? `${words.endLabel}ต้องไม่อยู่ก่อนวันที่เริ่มคิดดอกเบี้ย — กรอกสลับกันอยู่หรือเปล่า`
                            : `${thaiDate(from)} ถึง ${thaiDate(to)} นับได้ ${plain(days)} วัน`}
                        </p>
                      </>
                    )}
                  </Ask>

                  {/*
                    ตัวหาร 365/366 ถูกย้ายมาซ่อนไว้ตรงนี้ — เจ้าของเว็บสั่ง 28 ส.ค. 2026
                    ⚠️ **ซ่อน ไม่ใช่ถอดทิ้ง** ระบบเลือกให้เองแล้ว (autoBasis) แต่ยังบังคับเองได้
                    เผื่อเจ้าหนี้รายอื่นคิดคนละแบบ · ปิดไว้เป็นค่าตั้งต้น ไม่บังตาคนทั่วไป
                  */}
                  <details className="no-print rounded-xl bg-gray-50 px-4 py-3">
                    <summary className="cursor-pointer text-sm font-medium text-gray-500">
                      ตัวเลือกเพิ่มเติม (ปกติไม่ต้องแตะ)
                    </summary>
                    <p className="mt-2 text-sm text-gray-600">
                      จำนวนวันใน 1 ปีที่ใช้เป็นตัวหาร — ตอนนี้ระบบใช้{" "}
                      <b className="tabular-nums">{basis} วัน</b>
                      {forcedBasis === null ? " (เลือกให้เองจากช่วงวันที่)" : " (ท่านกำหนดเอง)"}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {DAY_BASES.map((value) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setForcedBasis(value)}
                          className={`rounded-full px-4 py-1.5 text-sm font-medium tabular-nums transition ${
                            forcedBasis === value
                              ? "bg-brand-600 text-white shadow"
                              : "bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-100"
                          }`}
                        >
                          {value} วัน
                        </button>
                      ))}
                      {forcedBasis !== null && (
                        <button
                          type="button"
                          onClick={() => setForcedBasis(null)}
                          className="text-sm font-medium text-gray-500 underline-offset-2 hover:underline"
                        >
                          ให้ระบบเลือกให้
                        </button>
                      )}
                    </div>
                  </details>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* ปุ่มเดินหน้า/ถอยหลังของข้อย่อย + สิ่งที่ตอบไปแล้ว */}
                <div className="no-print border-t border-gray-100 bg-gray-50/70 px-5 py-5 md:px-8">
                  {/*
                    สิ่งที่ตอบไปแล้ว — กดก้อนไหนก็กระโดดกลับไปแก้ข้อนั้นได้ทันที
                    ⚠️ **ต้องมี** เพราะถามทีละข้อแล้วข้อก่อนหน้าหายไปจากจอ ถ้าไม่โชว์ค้างไว้
                    สมาชิกจะจำไม่ได้ว่าเมื่อกี้ตอบอะไรไป ต้องกดถอยกลับไปดูทีละข้อ
                  */}
                  {answered.length > 0 && (
                    <div className="mb-3 flex flex-wrap justify-center gap-2">
                      {answered.map((item) => (
                        <button
                          key={item.no}
                          type="button"
                          onClick={() => setSub(item.no)}
                          className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-sm text-gray-600 ring-1 ring-gray-200 transition hover:ring-brand-300"
                        >
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                          {item.label} <b className="tabular-nums text-gray-800">{item.value}</b>
                        </button>
                      ))}
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={sub === 3 ? !canGo : !subReady}
                    onClick={() => (sub === 3 ? setStep(2) : setSub((sub + 1) as SubStep))}
                    className={`flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-4 text-lg font-bold shadow transition ${
                      (sub === 3 ? canGo : subReady)
                        ? "bg-brand-600 text-white hover:bg-brand-700"
                        : "cursor-not-allowed bg-gray-200 text-gray-400 shadow-none"
                    }`}
                  >
                    {sub === 3 ? "ดูผลคำนวณ" : "ถัดไป"} <ArrowRight className="h-5 w-5" />
                  </button>

                  <div className="mt-3 flex items-center justify-between gap-3">
                    {sub > 1 ? (
                      <button
                        type="button"
                        onClick={() => setSub((sub - 1) as SubStep)}
                        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
                      >
                        <ArrowLeft className="h-4 w-4" /> ข้อก่อนหน้า
                      </button>
                    ) : (
                      <span />
                    )}

                    {subReady ? (
                      sub === 3 && canGo ? (
                        <p className="text-right text-sm text-gray-500">
                          กำลังคิดจาก{" "}
                          <b className="tabular-nums text-gray-800">{plain(principal)} บาท</b> · ร้อยละ{" "}
                          <b className="tabular-nums text-gray-800">{rate}</b> ต่อปี ·{" "}
                          <b className="tabular-nums text-gray-800">{plain(days)} วัน</b>
                        </p>
                      ) : (
                        <span />
                      )
                    ) : (
                      <p className="text-right text-sm text-gray-500">
                        ยังต้องกรอก: <b className="text-gray-700">{ASK_TITLE[sub]}</b>
                      </p>
                    )}
                  </div>
                </div>
              </section>

              {/*
                คำอธิบายว่าโปรแกรมนี้มีไว้ทำอะไร — เจ้าของเว็บสั่งใส่ 28 ส.ค. 2026
                ⚠️ **วางไว้ใต้เครื่องคิดเลข ไม่ใช่ขวางก่อนใช้งาน** คนที่มาเพื่อคิดเลขอย่างเดียว
                ต้องได้กรอกทันที ส่วนคนที่อยากรู้ว่ามีไว้ทำอะไรก็เลื่อนลงมาอ่านได้
                (ต่างจากโปรแกรมตรวจสุขภาพการเงินที่มีหน้าเปิดก่อนเริ่ม เพราะอันนั้นต้องตอบ 21 ข้อรวด)
                ⚠️ ขึ้นเฉพาะขั้นที่ 1 — ขั้นที่ 2/3 คนกำลังดูตัวเลขของตัวเองอยู่ อย่าเอาบทความไปแทรก
              */}
              <section className="mt-4 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5 md:p-7">
                <h2 className="text-lg font-bold text-brand-900 md:text-xl">{intro.heading}</h2>
                <p className="mt-2 text-base font-medium leading-relaxed text-gray-700">
                  {intro.lead}
                </p>

                {intro.paragraphs.map((text) => (
                  <p key={text} className="mt-3 text-base leading-relaxed text-gray-600">
                    {text}
                  </p>
                ))}

                {intro.tips.length > 0 && (
                  <div className="mt-5 rounded-2xl bg-brand-50/70 px-4 py-4 ring-1 ring-brand-100">
                    <p className="text-sm font-semibold text-brand-900">ลองฝึกดูแบบนี้</p>
                    <ul className="mt-2 space-y-2">
                      {intro.tips.map((tip) => (
                        <li key={tip} className="flex items-start gap-2.5 text-sm text-brand-900/90">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                          <span className="leading-relaxed">{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            </motion.div>
          )}

          {view === 2 && (
            <motion.div key="step2" {...fadeSwap(0.35)} style={STACKED}>
              {/* ---------------- ขั้นที่ 2 ผลคำนวณ ---------------- */}
              <div className="space-y-4">
                <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/5">
                  <div className="px-5 py-7 text-center md:px-8">
                    <p className="text-base font-medium text-gray-500">{words.result}</p>
                    {/*
                      ⚠️ สีบอกทิศทางของเงิน — เงินกู้ = ที่ต้องจ่าย (น้ำเงิน) ·
                      เงินรับฝาก = ที่จะได้รับ (เขียว) ห้ามใช้สีเดียวกันทั้งสองฝั่ง
                      สมาชิกกวาดตาแล้วต้องรู้ทันทีว่าเป็นเงินออกหรือเงินเข้า
                    */}
                    <p
                      className={`mt-1 text-5xl font-extrabold tabular-nums md:text-6xl ${
                        kind === "loan" ? "text-brand-700" : "text-emerald-600"
                      }`}
                    >
                      {money(result.interest)}
                    </p>
                    <p className="mt-1 text-lg font-semibold text-gray-500">บาท</p>

                    <p className="mt-3 inline-block rounded-full bg-gray-50 px-4 py-1.5 text-sm text-gray-600">
                      ดอกเบี้ยวันละ{" "}
                      <b className="tabular-nums text-gray-800">{money(result.perDay)} บาท</b> ·{" "}
                      {words.perDayWord}
                    </p>
                  </div>

                  {/* แบ่งก้อนเงินให้เห็นชัด: เงินต้น + ดอกเบี้ย = ยอดรวม */}
                  <div className="border-t border-gray-100 px-5 py-6 md:px-8">
                    <div className="grid items-stretch gap-2 sm:grid-cols-[1fr_auto_1fr_auto_1fr]">
                      <Money label={words.principal} value={plain(principal)} />
                      <Sign>+</Sign>
                      <Money label="ดอกเบี้ย" value={money(result.interest)} tone={kind} />
                      <Sign>=</Sign>
                      <Money
                        label={words.total}
                        value={money(result.total)}
                        hint={words.totalHint}
                        strong
                      />
                    </div>
                  </div>

                  <FootNote kind={kind} over={result.overLegal} rate={rate} />
                </section>

                <ShareRow text={shareText} />

                {/* ตารางเทียบ — ตอบคำถามที่ตามมาเสมอว่า "แล้วถ้าปล่อยไว้อีกล่ะ" */}
                <section className="rounded-3xl bg-white px-5 py-5 shadow-sm ring-1 ring-black/5 md:px-8">
                  <p className="text-sm font-semibold text-gray-700">{words.compare}</p>
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full min-w-[22rem] text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 text-left text-gray-500">
                          <th className="py-2 font-medium">จำนวนวัน</th>
                          <th className="py-2 text-right font-medium">ดอกเบี้ย (บาท)</th>
                          <th className="py-2 text-right font-medium">
                            {kind === "loan" ? "รวมกับเงินต้น (บาท)" : "รวมกับเงินฝาก (บาท)"}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {COMPARE_DAYS.map((n) => {
                          const row = calcInterest({ principal, rate, days: n, basis });
                          return (
                            <tr
                              key={n}
                              className={`border-b border-gray-100 ${n === days ? "bg-brand-50/60 font-semibold text-brand-800" : ""}`}
                            >
                              <td className="py-2 tabular-nums">{plain(n)} วัน</td>
                              <td className="py-2 text-right tabular-nums">{money(row.interest)}</td>
                              <td className="py-2 text-right tabular-nums">{money(row.total)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            </motion.div>
          )}

          {view === 3 && (
            <motion.div key="step3" {...fadeSwap(0.35)} style={STACKED}>
              {/* ---------------- ขั้นที่ 3 สรุปและอธิบายวิธีคิด ---------------- */}
              <div className="space-y-4">
                <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/5">
                  <div className="border-b border-brand-100 bg-gradient-to-b from-brand-50/80 to-white px-5 py-5 md:px-8">
                    <div className="flex items-center gap-3">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/25">
                        <ClipboardList className="h-6 w-6" />
                      </span>
                      <div className="min-w-0">
                        <h2 className="text-lg font-bold text-brand-900 md:text-xl">
                          สรุปและที่มาของตัวเลข
                        </h2>
                        <p className="text-sm text-gray-600">
                          {words.tab} · คำนวณเมื่อ {thaiDate(printedAt)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* ---- อธิบายด้วยภาษาพูด ---- */}
                  <div className="px-5 py-6 md:px-8">
                    <ul className="space-y-2.5 text-base leading-relaxed text-gray-700">
                      <Said>{words.saidPrincipal(plain(principal), String(rate))}</Said>
                      <Said>{words.saidPerDay(money(result.perDay))}</Said>
                      <Said strong>{words.saidTotal(plain(days), money(result.interest))}</Said>
                    </ul>

                    {/* ---- ที่มาทีละขั้น ---- */}
                    <p className="mt-6 text-sm font-semibold text-gray-700">
                      ระบบคิดมาแบบนี้ทีละขั้น
                    </p>
                    <Timeline
                      rows={[
                        {
                          title: words.principal,
                          how: "ตัวเลขที่ท่านกรอกเอง",
                          value: `${plain(principal)} บาท`,
                        },
                        {
                          title: "ดอกเบี้ยถ้าครบ 1 ปี",
                          how: `${plain(principal)} × ${rate} ÷ 100`,
                          value: `${money(yearly)} บาท`,
                        },
                        {
                          title: "เฉลี่ยเป็นดอกเบี้ยรายวัน",
                          how: `${money(yearly)} ÷ ${basis} วัน`,
                          value: `${money(result.perDay)} บาท/วัน`,
                        },
                        {
                          title: words.result,
                          how: `${money(result.perDay)} × ${plain(days)} วัน`,
                          value: `${money(result.interest)} บาท`,
                          last: true,
                        },
                      ]}
                    />

                    <p className="mt-3 flex items-start gap-1.5 text-xs text-gray-500">
                      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
                      <span>
                        ตัวเลขในแต่ละขั้นปัดเศษไว้ให้อ่านง่าย ส่วนยอดสุดท้ายคิดจากทศนิยมเต็ม
                        ถ้าเอาเลขที่ปัดแล้วมาคูณเองอาจต่างกันไม่กี่สตางค์ ·
                        ปีนี้ใช้ตัวหาร {basis} วัน
                      </span>
                    </p>

                    {/*
                      สูตรเต็มแบบในใบประชาสัมพันธ์ — เจ้าของเว็บขอให้มีในหน้าสรุป 28 ส.ค. 2026
                      ⚠️ **อยู่ได้เฉพาะขั้นที่ 3 เท่านั้น** ขั้นที่ 1-2 ห้ามมี (สั่งไว้วันเดียวกัน)
                      เขียนสองบรรทัด: บรรทัดบนเป็นสูตรกลาง บรรทัดล่างแทนตัวเลขจริงลงไป
                      คนที่ถือใบประชาสัมพันธ์อยู่จะจับคู่ได้ทันทีว่าโปรแกรมคิดแบบเดียวกัน
                    */}
                    <div className="mt-5 rounded-2xl bg-brand-50/70 px-4 py-4 ring-1 ring-brand-100">
                      <p className="text-sm font-semibold text-brand-900">สูตรที่ใช้คำนวณ</p>

                      {/* เลื่อนแนวนอนได้บนมือถือ ห้ามตัดบรรทัดกลางสูตร ไม่งั้นอ่านไม่รู้เรื่อง */}
                      <div className="mt-2 overflow-x-auto">
                        <div className="flex min-w-max items-center gap-2 text-sm text-brand-900 md:text-base">
                          <span className="font-semibold">{words.result} =</span>
                          <span>{words.principal}</span>
                          <span className="text-brand-400">×</span>
                          <Fraction top="อัตราดอกเบี้ย" bottom="100" />
                          <span className="text-brand-400">×</span>
                          <Fraction top="จำนวนวัน" bottom={`${basis} (วัน)`} />
                        </div>
                      </div>

                      <div className="mt-3 overflow-x-auto border-t border-brand-100 pt-3">
                        <div className="flex min-w-max items-center gap-2 text-sm text-gray-700 md:text-base">
                          <span className="tabular-nums">{plain(principal)}</span>
                          <span className="text-gray-400">×</span>
                          <Fraction top={String(rate)} bottom="100" />
                          <span className="text-gray-400">×</span>
                          <Fraction top={plain(days)} bottom={String(basis)} />
                          <span className="text-gray-400">=</span>
                          <span className="font-bold tabular-nums text-brand-700">
                            {money(result.interest)} บาท
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ---- ตารางสรุปตัวเลขที่ใช้ ---- */}
                  <div className="border-t border-gray-100 px-5 py-6 md:px-8">
                    <p className="text-sm font-semibold text-gray-700">ตัวเลขที่ใช้คำนวณ</p>
                    <dl className="mt-2 divide-y divide-gray-100 rounded-2xl bg-gray-50 px-4 ring-1 ring-gray-100">
                      <Row label={words.principal} value={`${plain(principal)} บาท`} />
                      <Row
                        label="อัตราดอกเบี้ย"
                        value={`${rate}% ต่อปี`}
                        note={rateName || undefined}
                      />
                      <Row
                        label="ระยะเวลา"
                        value={`${plain(days)} วัน`}
                        note={
                          mode === "dates" ? `${thaiDate(from)} ถึง ${thaiDate(to)}` : undefined
                        }
                      />
                      <Row label={words.result} value={`${money(result.interest)} บาท`} />
                      <Row label={words.total} value={`${money(result.total)} บาท`} />
                    </dl>
                  </div>

                  <FootNote kind={kind} over={result.overLegal} rate={rate} />
                </section>

                <ShareRow text={shareText} onReset={reset} />

                <section className="no-print rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5 md:p-6">
                  <h2 className="text-base font-bold text-gray-800">สอบถามเพิ่มเติม</h2>
                  <p className="mt-1 text-sm text-gray-600">
                    ยอดที่คำนวณได้เป็นการประมาณตามตัวเลขที่กรอกเอง
                    ยอดจริงตามสัญญาให้ยึดตามที่สหกรณ์แจ้ง
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {contactPhone && (
                      <a
                        href={`tel:${contactPhone.split(",")[0].replace(/[^\d+]/g, "")}`}
                        className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-brand-700"
                      >
                        <Phone className="h-4 w-4" /> โทรหาเจ้าหน้าที่ {contactPhone}
                      </a>
                    )}
                    {lineId && (
                      <span className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700">
                        ไลน์ {lineId}
                      </span>
                    )}
                    <Link
                      href={kind === "loan" ? "/loans/" : "/deposits/"}
                      className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-200"
                    >
                      {kind === "loan"
                        ? "ดูอัตราดอกเบี้ยเงินกู้ทุกประเภท"
                        : "ดูอัตราดอกเบี้ยเงินรับฝากทุกประเภท"}{" "}
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </div>
                </section>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/*
        ปุ่มเดินหน้า/ถอยหลังของขั้นที่ 2 และ 3 — อยู่นอกกรอบที่จางสลับ
        จะได้ไม่กระพริบตามทุกครั้งที่เปลี่ยนขั้น (หลักเดียวกับโปรแกรมตรวจสุขภาพการเงิน)
      */}
      {view > 1 && (
        <div className="no-print flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              // ย้อนกลับมาแก้ตัวเลข = เริ่มถามใหม่ตั้งแต่ข้อ 1 (กดก้อนสรุปข้ามไปข้ออื่นได้อยู่แล้ว)
              if (view === 3) setStep(2);
              else {
                setStep(1);
                setSub(1);
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-medium text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
          >
            <ArrowLeft className="h-4 w-4" />
            {view === 3 ? "กลับไปดูผล" : "แก้ตัวเลข"}
          </button>
          {view === 2 && (
            <button
              type="button"
              onClick={() => setStep(3)}
              className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-brand-700"
            >
              ดูวิธีคิดทีละขั้น <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      <p className="pb-2 text-center text-xs text-gray-400">
        {INTEREST_CREDIT} · เวอร์ชัน {INTEREST_VERSION}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * ชิ้นส่วนย่อย
 * ------------------------------------------------------------------ */

/**
 * แถบบอกว่าอยู่ขั้นไหนใน 3 ขั้น — กดข้ามกลับไปขั้นก่อนหน้าได้
 *
 * ⚠️ **ขั้นที่ยังไปไม่ได้ต้องกดไม่ได้ด้วย** ไม่ใช่แค่ทำให้จาง ๆ ไว้เฉย ๆ
 * ไม่งั้นกดแล้วหน้าไม่เปลี่ยน (เพราะ view กันไว้อีกชั้น) ซึ่งดูเหมือนเว็บค้าง
 */
function Stepper({
  current,
  canGo,
  onPick,
}: {
  current: 1 | 2 | 3;
  canGo: boolean;
  onPick: (step: 1 | 2 | 3) => void;
}) {
  return (
    <ol className="no-print grid grid-cols-3 gap-2">
      {STEPS.map((item) => {
        const done = item.no < current;
        const now = item.no === current;
        // ขั้นที่ 2/3 เปิดได้ต่อเมื่อกรอกครบแล้วเท่านั้น · ขั้นที่ 1 กลับไปได้เสมอ
        const open = item.no === 1 || canGo;

        return (
          <li key={item.no}>
            <button
              type="button"
              disabled={!open}
              aria-current={now ? "step" : undefined}
              onClick={() => onPick(item.no)}
              className={`w-full rounded-2xl px-3 py-2.5 text-left ring-1 transition ${
                now
                  ? "bg-brand-600 text-white ring-brand-600 shadow"
                  : done
                    ? "bg-white text-brand-700 ring-brand-200 hover:bg-brand-50"
                    : open
                      ? "bg-white text-gray-500 ring-gray-200 hover:bg-gray-50"
                      : "cursor-not-allowed bg-gray-50 text-gray-300 ring-gray-100"
              }`}
            >
              <span className="flex items-center gap-2">
                <span
                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold tabular-nums ${
                    now
                      ? "bg-white/20 text-white"
                      : done
                        ? "bg-brand-100 text-brand-700"
                        : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : item.no}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{item.label}</span>
                  <span
                    className={`hidden truncate text-xs sm:block ${now ? "text-white/80" : "text-gray-400"}`}
                  >
                    {item.hint}
                  </span>
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/** หนึ่งข้อย่อยของขั้นที่ 1 — เลขลำดับตัวโต ๆ อยู่ซ้าย ให้รู้ว่าเหลืออีกกี่ข้อ */
function Ask({
  no,
  title,
  hint,
  children,
}: {
  no: number;
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-start gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-600 text-sm font-bold text-white shadow-sm">
          {no}
        </span>
        <div className="min-w-0">
          <h3 className="text-base font-bold text-gray-800 md:text-lg">{title}</h3>
          <p className="mt-0.5 text-sm text-gray-500">{hint}</p>
        </div>
      </div>
      {/* เยื้องให้ตรงกับหัวข้อเฉพาะจอกว้าง — จอแคบใช้เต็มความกว้าง ปุ่มจะได้ไม่บีบ */}
      <div className="md:pl-11">{children}</div>
    </section>
  );
}

/** ก้อนเงินหนึ่งก้อนในบรรทัด เงินต้น + ดอกเบี้ย = ยอดรวม */
function Money({
  label,
  value,
  hint,
  tone,
  strong = false,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: RateKind;
  strong?: boolean;
}) {
  const color = tone === "deposit" ? "text-emerald-600" : tone ? "text-brand-700" : "text-gray-800";

  return (
    <div
      className={`rounded-2xl px-4 py-3 text-center ring-1 ${
        strong ? "bg-brand-50 ring-brand-200" : "bg-gray-50 ring-gray-100"
      }`}
    >
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p
        className={`mt-0.5 text-xl font-bold tabular-nums md:text-2xl ${strong ? "text-brand-800" : color}`}
      >
        {value}
      </p>
      <p className="text-xs text-gray-400">{hint ?? "บาท"}</p>
    </div>
  );
}

/** เครื่องหมาย + และ = ระหว่างก้อนเงิน — จอแคบวางกลางแนวนอนแทนแนวตั้ง */
function Sign({ children }: { children: string }) {
  return (
    <span className="grid place-items-center text-xl font-bold text-gray-300 sm:text-2xl">
      {children}
    </span>
  );
}

/**
 * ปุ่มพิมพ์กับปุ่มแชร์ — ทำมาเพื่อสมาชิกสูงอายุที่อยากส่งให้ลูกหลานดูต่อ
 *
 * ⚠️ **แชร์ด้วย share sheet ของเครื่องผู้ใช้เอง** (`navigator.share`) เครื่องไหนไม่รองรับ
 * (คอมพิวเตอร์ส่วนใหญ่) จะคัดลอกข้อความให้แทนแล้วบอกว่าคัดลอกแล้ว
 * — **ห้ามยิงข้อความไปที่ไหนเอง** ตัวเลขหนี้สินของสมาชิกต้องไม่ออกจากเครื่องเขาโดยที่เขาไม่ได้สั่ง
 */
function ShareRow({ text, onReset }: { text: string; onReset?: () => void }) {
  const [said, setSaid] = useState("");

  async function share() {
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: "ผลคำนวณดอกเบี้ย", text });
        return;
      }
      await navigator.clipboard?.writeText(text);
      setSaid("คัดลอกข้อความแล้ว วางในไลน์ได้เลย");
      window.setTimeout(() => setSaid(""), 2600);
    } catch {
      // กดยกเลิกหน้าต่างแชร์เองก็เข้าทางนี้ — ไม่ใช่ความผิดพลาด ไม่ต้องขึ้นอะไรให้ตกใจ
    }
  }

  return (
    <div className="no-print">
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-200"
        >
          <Printer className="h-4 w-4" /> พิมพ์ / บันทึกเป็น PDF
        </button>
        <button
          type="button"
          onClick={() => void share()}
          className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-emerald-700"
        >
          <Share2 className="h-4 w-4" /> แชร์ให้ลูกหลาน
        </button>
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-brand-700"
          >
            <RotateCcw className="h-4 w-4" /> เริ่มใหม่
          </button>
        )}
      </div>
      {said && <p className="mt-2 text-center text-sm text-emerald-700">{said}</p>}
    </div>
  );
}

/** หนึ่งประโยคอธิบายในขั้นที่ 3 */
function Said({ children, strong = false }: { children: string; strong?: boolean }) {
  return (
    <li className="flex items-start gap-2.5">
      <span
        className={`mt-2 h-2 w-2 shrink-0 rounded-full ${strong ? "bg-brand-600" : "bg-brand-200"}`}
      />
      <span className={strong ? "font-semibold text-brand-900" : ""}>{children}</span>
    </li>
  );
}

/**
 * ที่มาของตัวเลขทีละขั้น — เอาไว้ตอบคำถาม "คิดมาได้ยังไง" โดยไม่ต้องเขียนเป็นสูตร
 * แต่ละขั้นบอก **เอาอะไรคูณ/หารกับอะไร แล้วได้เท่าไร** ซึ่งสมาชิกกดเครื่องคิดเลขตามได้เลย
 */
function Timeline({
  rows,
}: {
  rows: { title: string; how: string; value: string; last?: boolean }[];
}) {
  return (
    <ol className="mt-3">
      {rows.map((row, index) => (
        <li key={row.title} className="flex gap-3">
          {/* เส้นต่อระหว่างขั้น — ขั้นสุดท้ายไม่มีเส้นห้อยต่อ */}
          <div className="flex flex-col items-center">
            <span
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold tabular-nums ${
                row.last ? "bg-brand-600 text-white" : "bg-brand-50 text-brand-700"
              }`}
            >
              {index + 1}
            </span>
            {index < rows.length - 1 && <span className="w-px flex-1 bg-brand-100" />}
          </div>

          <div className={`min-w-0 flex-1 ${index < rows.length - 1 ? "pb-4" : ""}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <p className="text-sm font-semibold text-gray-800">{row.title}</p>
              <p
                className={`text-base font-bold tabular-nums ${row.last ? "text-brand-700" : "text-gray-700"}`}
              >
                {row.value}
              </p>
            </div>
            <p className="mt-0.5 text-sm tabular-nums text-gray-500">{row.how}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/**
 * หมายเหตุท้ายผล — **คนละเรื่องกันคนละฝั่ง** ใช้ทั้งขั้นที่ 2 และขั้นที่ 3
 *
 * ⚠️ **เพดานร้อยละ 15 ต่อปีเป็นกฎหมายของ "เงินกู้" เท่านั้น** เอาไปขึ้นในฝั่งเงินรับฝาก
 * คือผิดบริบทเต็ม ๆ (เงินฝากไม่มีเพดานแบบนั้น และอัตราจริงแค่ 1-4%)
 * ฝั่งเงินรับฝากจึงบอกข้อจำกัดของการคำนวณแทน ซึ่งเป็นสิ่งที่สมาชิกต้องรู้จริง ๆ
 */
function FootNote({ kind, over, rate }: { kind: RateKind; over: boolean; rate: number }) {
  if (kind === "deposit") {
    return (
      <div className="border-t border-gray-100 bg-gray-50 px-5 py-4 text-sm text-gray-600 md:px-8">
        <p className="flex items-start gap-2">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
          <span>
            ดอกเบี้ยเงินรับฝากคิดจาก<b>ยอดคงเหลือรายวัน</b> — ถ้ามีฝากเพิ่มหรือถอนระหว่างช่วงที่คำนวณ
            ยอดจริงจะไม่ตรงกับที่คิดได้ตรงนี้ · และคิดแบบ<b>ไม่ทบต้น</b>
            ถ้าช่วงที่คำนวณคร่อมรอบจ่ายดอกเบี้ยของสหกรณ์ ของจริงจะได้มากกว่านี้เล็กน้อย ·
            ยอดที่ได้รับจริงให้ยึดตามที่สหกรณ์แจ้ง
          </span>
        </p>
      </div>
    );
  }

  return (
    <div
      className={`border-t px-5 py-4 text-sm md:px-8 ${
        over ? "border-red-200 bg-red-50 text-red-800" : "border-gray-100 bg-gray-50 text-gray-600"
      }`}
    >
      <p className="flex items-start gap-2">
        {over ? (
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        ) : (
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
        )}
        <span>
          {over ? (
            <>
              อัตราที่กรอกไว้ <b className="tabular-nums">{rate}%</b> ต่อปี{" "}
              <b>เกินกว่าอัตราที่กฎหมายกำหนด</b> — การเรียกเก็บดอกเบี้ยเงินกู้ยืมของประชาชนทั่วไป
              เกินกว่าร้อยละ {LEGAL_MAX_YEARLY} ต่อปี หรือร้อยละ {LEGAL_MAX_MONTHLY} ต่อเดือน
              เป็นการเรียกดอกเบี้ยเกินกว่าอัตราที่กฎหมายกำหนด
            </>
          ) : (
            <>
              การเรียกเก็บดอกเบี้ยเงินกู้ยืมของประชาชนทั่วไป เกินกว่าร้อยละ {LEGAL_MAX_YEARLY} ต่อปี
              หรือร้อยละ {LEGAL_MAX_MONTHLY} ต่อเดือน เป็นการเรียกดอกเบี้ยเกินกว่าอัตราที่กฎหมายกำหนด
            </>
          )}
        </span>
      </p>
    </div>
  );
}

/**
 * เศษส่วนแบบในใบประชาสัมพันธ์ — ตัวเศษอยู่บน ตัวส่วนอยู่ล่าง มีเส้นคั่นกลาง
 * เขียนเป็น a/b บรรทัดเดียวก็ได้ แต่คนที่จับคู่กับใบประชาสัมพันธ์จะอ่านยากกว่ามาก
 *
 * ⚠️ **ใช้ได้เฉพาะในขั้นที่ 3 (หน้าสรุป)** ขั้นที่ 1-2 ห้ามมีสูตร (เจ้าของเว็บสั่ง 28 ส.ค. 2026)
 */
function Fraction({ top, bottom }: { top: string; bottom: string }) {
  return (
    <span className="inline-flex flex-col items-center leading-tight">
      <span className="px-1.5 tabular-nums">{top}</span>
      <span className="my-0.5 h-px w-full self-stretch bg-current opacity-50" />
      <span className="px-1.5 tabular-nums">{bottom}</span>
    </span>
  );
}

/** หนึ่งบรรทัดของตารางสรุปในขั้นที่ 3 */
function Row({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2.5">
      <dt className="text-sm text-gray-600">{label}</dt>
      <dd className="text-right">
        <span className="text-base font-semibold tabular-nums text-gray-800">{value}</span>
        {note && <span className="block text-xs text-gray-500">{note}</span>}
      </dd>
    </div>
  );
}

/** ช่องกรอกตัวเลขพร้อมหน่วยท้ายช่อง — ใช้กับอัตราดอกเบี้ยและจำนวนวัน */
function NumberBox({
  id,
  unit,
  value,
  onChange,
  className = "",
}: {
  id: string;
  unit: string;
  value: string;
  onChange: (next: string) => void;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-4 pr-20 text-xl font-semibold tabular-nums text-gray-800 shadow-sm outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
      />
      <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm font-medium text-gray-400">
        {unit}
      </span>
    </div>
  );
}

function DateBox({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-xs font-medium text-gray-500">
        {label}
      </label>
      <input
        id={id}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-base font-semibold text-gray-800 shadow-sm outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
      />
    </div>
  );
}

/** ปุ่มลัดเลขกลม ๆ ใต้ช่องกรอก — กดทีเดียวจบ ไม่ต้องพิมพ์ทีละหลัก */
function Chips({
  items,
  active,
  onPick,
}: {
  items: { key: number; label: string }[];
  active: number;
  onPick: (next: number) => void;
}) {
  if (items.length === 0) return null;

  return (
    <div className="no-print mt-3 flex flex-wrap gap-2">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => onPick(item.key)}
          className={`rounded-full px-4 py-2 text-base font-medium tabular-nums transition ${
            active === item.key
              ? "bg-brand-600 text-white shadow"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
