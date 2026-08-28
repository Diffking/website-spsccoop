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
  Percent,
  Phone,
  PiggyBank,
  Printer,
  RotateCcw,
  Wallet,
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
  calcInterest,
  daysBetween,
  money,
  plain,
  readNumber,
  readRateText,
  thaiDate,
  todayISO,
  touchesLeapYear,
  type DayBasis,
  type RateKind,
  type RateRow,
} from "@/lib/interestCalc";
import { fadeSwap, STACKED } from "@/lib/slideMotion";
import { INTEREST_CREDIT, INTEREST_VERSION } from "@/lib/programPages";

/**
 * โปรแกรมคำนวณดอกเบี้ย — เดินทีละขั้น 3 ขั้น (เจ้าของเว็บสั่งไว้ 28 ส.ค. 2026)
 *
 *   ขั้นที่ 1 กรอกตัวเลข → ขั้นที่ 2 ผลคำนวณ → ขั้นที่ 3 สรุป
 *
 * ⚠️ **โชว์ทีละขั้น ห้ามเอาทั้งสามขั้นมากองในหน้าเดียว** — ของเดิมวางช่องกรอกกับผลลัพธ์
 * ต่อกันลงมาทั้งหมด หน้าจึงยาวมากและอ่านไม่ออกว่าต้องดูตรงไหนก่อน
 *
 * ⚠️ **กรอกไม่ครบ = ค้างอยู่ขั้นที่ 1** ไม่พาไปขั้นต่อไปและไม่โผล่ผลลัพธ์ครึ่ง ๆ กลาง ๆ
 * ขั้นที่เดินไปไม่ได้จึงถูกกันไว้ **สองชั้น**: ปุ่ม "ดูผลคำนวณ" กดไม่ได้ และตัว `view`
 * ที่คำนวณจากสถานะจริงทุกครั้งที่ render (ไม่ได้เก็บไว้ใน state ตัวที่สอง) — ย้อนกลับ
 * ไปลบตัวเลขในขั้นที่ 1 ทิ้งเมื่อไหร่ ขั้นที่ 2/3 ก็หายเองทันทีโดยไม่ต้องมี useEffect คอยไล่แก้
 *
 * ⚠️ **ไม่มีปุ่ม "คำนวณ" ตั้งใจ** ในขั้นที่ 1 ผลคิดใหม่ทุกครั้งที่พิมพ์อยู่แล้ว
 * ปุ่มที่มีคือปุ่ม "ไปขั้นถัดไป" ไม่ใช่ปุ่มสั่งคิดเลข
 *
 * ⚠️ **ไม่ส่งอะไรไปไหนทั้งนั้น** ไม่มี fetch ไม่มี localStorage — ตัวเลขหนี้สินของสมาชิก
 * เป็นข้อมูลอ่อนไหว หลักเดียวกับโปรแกรมตรวจสุขภาพการเงิน
 *
 * ⚠️ **โปรแกรมนี้พิมพ์ตัวเลขได้ ต่างจากโปรแกรมตรวจสุขภาพการเงินที่ห้ามมีช่องพิมพ์**
 * เพราะที่นี่สมาชิกถือใบเสร็จอยู่ในมือแล้ว ต้องกรอกยอดคงค้างให้ตรงถึงหลักบาท
 * เลื่อนสเกลเอาไม่ได้ · แต่ยังมีปุ่มลัดเลขกลม ๆ ให้กดสำหรับคนที่แค่อยากลองดู
 */

/** ชื่อขั้นที่โชว์บนแถบบอกขั้น — แก้ที่นี่ที่เดียว ทั้งแถบบนและหัวการ์ดใช้ชุดนี้ */
const STEPS = [
  { no: 1, label: "กรอกตัวเลข", hint: "เงินต้น อัตราดอกเบี้ย และจำนวนวัน" },
  { no: 2, label: "ผลคำนวณ", hint: "ดอกเบี้ยที่ได้และวิธีคิด" },
  { no: 3, label: "สรุป", hint: "เก็บไว้ทานกับใบเสร็จหรือสั่งพิมพ์" },
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
    title: string;
    lead: string;
    formula: string;
    principal: string;
    principalHint: string;
    rateHint: string;
    endLabel: string;
    result: string;
    perDayHint: string;
    total: string;
    totalHint: string;
    compare: string;
  }
> = {
  loan: {
    tab: "เงินกู้",
    title: "คำนวณดอกเบี้ยเงินกู้ (ร้อยละต่อปี)",
    lead: "กรอกสามช่อง แล้วกดปุ่มด้านล่างเพื่อดูผล",
    formula: "ดอกเบี้ยที่ต้องจ่าย =",
    principal: "เงินต้นคงค้าง",
    principalHint: "ยอดหนี้ที่ยังไม่ได้ชำระ ณ วันที่เริ่มคิดดอกเบี้ย",
    rateHint: "ดูได้จากสัญญาเงินกู้ หรือกดเลือกจากอัตราของสหกรณ์",
    endLabel: "วันที่ชำระ",
    result: "ดอกเบี้ยที่ต้องจ่าย",
    perDayHint: "ชำระเร็วขึ้น 1 วัน ประหยัดได้เท่านี้",
    total: "เงินต้น + ดอกเบี้ย",
    totalHint: "ยอดรวมถ้าปิดหนี้ทั้งก้อนในวันที่ชำระ",
    compare: "ถ้าเงินต้นและอัตราเท่าเดิม แต่ทิ้งไว้นานขึ้น",
  },
  deposit: {
    tab: "เงินรับฝาก",
    title: "คำนวณดอกเบี้ยเงินรับฝาก (ร้อยละต่อปี)",
    lead: "กรอกสามช่อง แล้วกดปุ่มด้านล่างเพื่อดูผล",
    formula: "ดอกเบี้ยที่จะได้รับ =",
    principal: "เงินที่ฝาก",
    principalHint: "ยอดเงินฝากคงเหลือ ณ วันที่เริ่มคิดดอกเบี้ย",
    rateHint: "กดเลือกจากอัตราเงินรับฝากของสหกรณ์ หรือดูจากสมุดคู่ฝาก",
    endLabel: "วันที่ถอน",
    result: "ดอกเบี้ยที่จะได้รับ",
    perDayHint: "ฝากต่ออีก 1 วัน ได้เพิ่มเท่านี้",
    total: "เงินฝาก + ดอกเบี้ย",
    totalHint: "ยอดรวมถ้าถอนทั้งก้อนในวันที่ถอน",
    compare: "ถ้าเงินฝากและอัตราเท่าเดิม แต่ฝากไว้นานขึ้น",
  },
};

export default function InterestCalculator({
  loanRates,
  depositRates,
  contactPhone,
  lineId,
}: {
  /**
   * อัตราดอกเบี้ยที่ให้ขึ้นเป็นปุ่มลัด — เจ้าหน้าที่ตั้งตัวเลขที่ หลังบ้าน → อัตราดอกเบี้ย
   * แล้วเลือกว่าประเภทไหนให้ขึ้นในโปรแกรมนี้ที่ หลังบ้าน → หน้าโปรแกรม
   * (หน้าเว็บกรองมาให้แล้วด้วย visibleRates — ที่นี่ไม่ต้องกรองซ้ำ)
   */
  loanRates: RateRow[];
  /** อัตราดอกเบี้ยเงินรับฝาก — ชุดเดียวกับที่ขึ้นการ์ดหน้าแรก กรองมาแล้วเหมือนกัน */
  depositRates: RateRow[];
  /** เบอร์สหกรณ์ — แอดมินแก้ได้ที่ หลังบ้าน → ส่วนท้ายเว็บ (ห้ามฝังเบอร์ไว้ในโค้ด) */
  contactPhone: string;
  /** ไอดีไลน์ของสหกรณ์ — มาจากที่เดียวกัน เว้นว่าง = ไม่แสดงบรรทัดไลน์ */
  lineId: string;
}) {
  /* ปุ่มลัดอัตราดอกเบี้ยทั้งสองฝั่ง — เอาเฉพาะรายการที่อ่านเป็นตัวเลขได้ และตัดตัวซ้ำออก */
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
  const rateChips = chipsOf[kind];
  const words = WORDS[kind];

  const [principalText, setPrincipalText] = useState(String(SAMPLE_PRINCIPAL));
  // ตั้งต้นด้วยอัตราจริงของสหกรณ์ถ้ามี — ไม่มีค่อยใช้เลขในตัวอย่างของใบประชาสัมพันธ์
  const [rateText, setRateText] = useState(() => String(chipsOf.loan[0]?.rate ?? SAMPLE_RATE));
  const [daysText, setDaysText] = useState(String(SAMPLE_DAYS));
  const [basis, setBasis] = useState<DayBasis>(365);

  /** นับวันเอง หรือให้ระบบนับจากปฏิทิน */
  const [mode, setMode] = useState<"days" | "dates">("days");
  const [from, setFrom] = useState(() => todayISO());
  const [to, setTo] = useState(() => todayISO());

  /** ขั้นที่กดค้างไว้ — ขั้นที่ "เห็นจริง" คือ view ด้านล่าง ซึ่งกันขั้นที่ยังไปไม่ได้ออกให้เอง */
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // วันที่ออกใบสรุป — ล็อกไว้ตอนเปิดหน้า ไม่ให้เปลี่ยนเองกลางคันตอนข้ามเที่ยงคืน
  const [printedAt] = useState(() => todayISO());

  const principal = readNumber(principalText);
  const rate = readNumber(rateText);

  /** จำนวนวันที่เอาไปคิดจริง — โหมดปฏิทินนับให้จากวันที่สองช่อง */
  const picked = mode === "dates" ? daysBetween(from, to) : null;
  const days = mode === "dates" ? (picked ?? 0) : readNumber(daysText);
  /** วันชำระอยู่ก่อนวันเริ่ม = กรอกสลับกัน ต้องบอกให้แก้ ไม่ใช่คิดเป็น 0 เงียบ ๆ */
  const badRange = mode === "dates" && picked === null;

  const result = useMemo(
    () => calcInterest({ principal, rate, days, basis }),
    [principal, rate, days, basis],
  );

  /** ผ่านขั้นที่ 1 แล้วหรือยัง — ครบทั้งสามช่องและวันที่ไม่สลับกัน */
  const canGo = result.ready && !badRange;

  /**
   * ขั้นที่แสดงจริง — คิดใหม่ทุกครั้งที่ render ไม่ได้เก็บเป็น state อีกตัว
   * (ห้าม setState ใน useEffect ตามกฎ react-hooks/set-state-in-effect ใน AGENTS.md)
   */
  const view: 1 | 2 | 3 = canGo ? step : 1;

  /** ยังขาดอะไรบ้าง — บอกเป็นชื่อช่อง ไม่ใช่ "กรอกไม่ครบ" ลอย ๆ ที่หาไม่เจอว่าช่องไหน */
  const missing = [
    principal > 0 ? "" : words.principal,
    rate > 0 ? "" : "อัตราดอกเบี้ย",
    badRange ? "" : days > 0 ? "" : "จำนวนวันที่คิดดอกเบี้ย",
  ].filter(Boolean);

  /** ช่วงที่เลือกคร่อมปีอธิกสุรทิน — เตือนว่าจะใช้ตัวหาร 366 ก็ได้ */
  const leapHint = mode === "dates" && !badRange && basis === 365 && touchesLeapYear(from, to);

  /** ชื่อประเภทที่ตรงกับอัตราที่กรอก — เอาไปเขียนในใบสรุปให้รู้ว่าคิดของอะไร */
  const rateName = rateChips.find((row) => row.rate === rate)?.label ?? "";

  /**
   * สลับฝั่งเงินกู้ ↔ เงินรับฝาก — **ต้องเปลี่ยนอัตราให้ตามฝั่งใหม่ด้วย**
   * ไม่งั้นจะค้างอัตราเงินกู้ 5-6% ไว้ในหน้าเงินฝากซึ่งเป็นตัวเลขที่เป็นไปไม่ได้
   * (เปลี่ยนตรงนี้ในตัวจัดการปุ่ม ไม่ใช่ใน useEffect — ดูกฎ set-state-in-effect ใน AGENTS.md)
   */
  const switchKind = (next: RateKind) => {
    if (next === kind) return;
    setKind(next);
    setRateText(String(chipsOf[next][0]?.rate ?? (next === "loan" ? SAMPLE_RATE : "")));
    setStep(1);
  };

  const reset = () => {
    setPrincipalText(String(SAMPLE_PRINCIPAL));
    setRateText(String(rateChips[0]?.rate ?? SAMPLE_RATE));
    setDaysText(String(SAMPLE_DAYS));
    setBasis(365);
    setMode("days");
    setFrom(todayISO());
    setTo(todayISO());
    setStep(1);
  };

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
              {/* ---------------- ขั้นที่ 1 กรอกตัวเลข ---------------- */}
              <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/5">
                <div className="border-b border-brand-100 bg-gradient-to-b from-brand-50/80 to-white px-5 py-5 md:px-8">
                  {/*
                    สลับฝั่งก่อนเป็นอย่างแรก — วางไว้เหนือหัวข้อ เพราะมันเปลี่ยนความหมาย
                    ของทุกช่องที่อยู่ใต้ลงไป ถ้าไปวางท้ายฟอร์มคนจะกรอกเสร็จแล้วค่อยเห็น
                  */}
                  <div className="no-print mb-4 inline-flex rounded-full bg-white p-1 text-sm ring-1 ring-brand-100">
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

                  <div className="flex items-center gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/25">
                      {kind === "loan" ? (
                        <Coins className="h-6 w-6" />
                      ) : (
                        <PiggyBank className="h-6 w-6" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <h2 className="text-lg font-bold text-brand-900 md:text-xl">{words.title}</h2>
                      <p className="text-sm text-gray-600">{words.lead}</p>
                    </div>
                  </div>

                  {/*
                    สูตรตั้งต้นแบบเดียวกับใบประชาสัมพันธ์ — วางไว้ตรงนี้ให้เห็นก่อนกรอก
                    สมาชิกที่เคยเห็นใบประชาสัมพันธ์จะจับคู่ได้ทันทีว่าโปรแกรมคิดแบบเดียวกัน
                  */}
                  <div className="mt-4 overflow-x-auto rounded-2xl bg-brand-900 px-4 py-3 text-white">
                    <div className="flex min-w-max items-center gap-2 text-sm md:text-base">
                      <span className="font-semibold">{words.formula}</span>
                      <span>{words.principal}</span>
                      <span className="text-brand-200">×</span>
                      <Fraction top="อัตราดอกเบี้ย" bottom="100" />
                      <span className="text-brand-200">×</span>
                      <Fraction top="จำนวนวันที่คิดดอกเบี้ย" bottom={`${basis} (วัน)`} />
                    </div>
                  </div>
                </div>

                <div className="grid gap-5 px-5 py-6 md:grid-cols-2 md:px-8">
                  {/* เงินต้นคงค้าง */}
                  <Field
                    id="principal"
                    label={words.principal}
                    hint={words.principalHint}
                    icon={<Wallet className="h-4 w-4" />}
                    unit="บาท"
                    value={principalText}
                    onChange={setPrincipalText}
                  >
                    <Chips
                      items={AMOUNT_CHIPS.map((amount) => ({ key: amount, label: plain(amount) }))}
                      active={principal}
                      onPick={(next) => setPrincipalText(String(next))}
                    />
                  </Field>

                  {/* อัตราดอกเบี้ย */}
                  <Field
                    id="rate"
                    label="อัตราดอกเบี้ย (ร้อยละต่อปี)"
                    hint={words.rateHint}
                    icon={<Percent className="h-4 w-4" />}
                    unit="% ต่อปี"
                    value={rateText}
                    onChange={setRateText}
                  >
                    {rateChips.length > 0 ? (
                      <Chips
                        items={rateChips.map((row) => ({
                          key: row.rate,
                          label: `${row.label} ${row.rate}%`,
                        }))}
                        active={rate}
                        onPick={(next) => setRateText(String(next))}
                      />
                    ) : null}
                  </Field>

                  {/* จำนวนวัน — พิมพ์เองหรือให้ปฏิทินนับให้ */}
                  <div className="md:col-span-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-700">
                        <CalendarDays className="h-4 w-4 text-gray-400" />
                        จำนวนวันที่คิดดอกเบี้ย
                      </span>

                      {/* สลับวิธีกรอก — ปุ่มคู่ ไม่ใช่ช่องติ๊ก จะได้เห็นทั้งสองทางเลือกพร้อมกัน */}
                      <div className="no-print flex rounded-full bg-gray-100 p-1 text-sm">
                        <button
                          type="button"
                          onClick={() => setMode("days")}
                          className={`rounded-full px-3.5 py-1.5 font-medium transition ${
                            mode === "days" ? "bg-white text-brand-700 shadow-sm" : "text-gray-500"
                          }`}
                        >
                          ใส่จำนวนวันเอง
                        </button>
                        <button
                          type="button"
                          onClick={() => setMode("dates")}
                          className={`rounded-full px-3.5 py-1.5 font-medium transition ${
                            mode === "dates" ? "bg-white text-brand-700 shadow-sm" : "text-gray-500"
                          }`}
                        >
                          เลือกจากปฏิทิน
                        </button>
                      </div>
                    </div>

                    {mode === "days" ? (
                      <>
                        <NumberBox
                          id="days"
                          unit="วัน"
                          value={daysText}
                          onChange={setDaysText}
                          className="mt-2"
                        />
                        <Chips
                          items={DAY_CHIPS.map((chip) => ({ key: chip.days, label: chip.label }))}
                          active={days}
                          onPick={(next) => setDaysText(String(next))}
                        />
                      </>
                    ) : (
                      <>
                        <div className="mt-2 grid gap-3 sm:grid-cols-2">
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
                  </div>

                  {/* ตัวหาร 365 / 366 */}
                  <div className="md:col-span-2">
                    <span className="text-sm font-semibold text-gray-700">
                      จำนวนวันใน 1 ปี (ตัวหาร)
                    </span>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {DAY_BASES.map((value) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setBasis(value)}
                          className={`rounded-full px-4 py-1.5 text-sm font-medium tabular-nums transition ${
                            basis === value
                              ? "bg-brand-600 text-white shadow"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          {value} วัน
                        </button>
                      ))}
                      <span className="text-xs text-gray-500">
                        ปกติใช้ 365 วัน · บางกิจการคิด 366 วันตามจำนวนวันจริงของปีนั้น ๆ
                      </span>
                    </div>
                    {leapHint && (
                      <p className="mt-2 inline-flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        ช่วงวันที่เลือกไว้คร่อมปีอธิกสุรทิน (เดือนกุมภาพันธ์มี 29 วัน)
                        ถ้าเจ้าหนี้คิดตามวันจริงของปี ให้เลือกตัวหาร 366 วัน
                      </p>
                    )}
                  </div>
                </div>

                {/* ปุ่มไปขั้นที่ 2 — กดไม่ได้จนกว่าจะกรอกครบ และบอกด้วยว่าขาดช่องไหน */}
                <div className="no-print border-t border-gray-100 bg-gray-50/70 px-5 py-4 md:px-8">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-gray-500">
                      {canGo ? (
                        <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700">
                          <Check className="h-4 w-4" /> กรอกครบแล้ว กดดูผลได้เลย
                        </span>
                      ) : (
                        <>ยังต้องกรอก: <b className="text-gray-700">{missing.join(" · ") || "แก้วันที่ให้ถูกต้อง"}</b></>
                      )}
                    </p>
                    <button
                      type="button"
                      disabled={!canGo}
                      onClick={() => setStep(2)}
                      className={`inline-flex items-center gap-1.5 rounded-full px-6 py-2.5 text-sm font-semibold shadow transition ${
                        canGo
                          ? "bg-brand-600 text-white hover:bg-brand-700"
                          : "cursor-not-allowed bg-gray-200 text-gray-400 shadow-none"
                      }`}
                    >
                      ดูผลคำนวณ <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </section>
            </motion.div>
          )}

          {view === 2 && (
            <motion.div key="step2" {...fadeSwap(0.35)} style={STACKED}>
              {/* ---------------- ขั้นที่ 2 ผลคำนวณ ---------------- */}
              <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/5">
                <div className="px-5 py-6 md:px-8">
                  <p className="text-sm font-medium text-gray-500">{words.result}</p>
                  <p className="mt-1 text-4xl font-bold tabular-nums text-brand-700 md:text-5xl">
                    {money(result.interest)}{" "}
                    <span className="text-2xl font-semibold text-brand-600 md:text-3xl">บาท</span>
                  </p>

                  {/*
                    วิธีคิดเป็นตัวเลขจริง — หัวใจของโปรแกรมนี้
                    สมาชิกที่สงสัยว่าสหกรณ์คิดมาได้ยังไง จะได้เอาไปทานกับใบเสร็จทีละตัว
                    (เลื่อนแนวนอนได้บนมือถือ ไม่ตัดบรรทัดกลางสูตร)
                  */}
                  <div className="mt-4 overflow-x-auto rounded-2xl bg-gray-50 px-4 py-3 ring-1 ring-gray-100">
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

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <Tile
                      label="ดอกเบี้ยวันละ"
                      value={`${money(result.perDay)} บาท`}
                      hint={words.perDayHint}
                    />
                    <Tile
                      label={words.total}
                      value={`${money(result.total)} บาท`}
                      hint={words.totalHint}
                      strong
                    />
                  </div>

                  {/* ตารางเทียบ — ตอบคำถามที่ตามมาเสมอว่า "แล้วถ้าปล่อยไว้อีกล่ะ" */}
                  <div className="mt-5">
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
                                <td className="py-2 text-right tabular-nums">
                                  {money(row.interest)}
                                </td>
                                <td className="py-2 text-right tabular-nums">{money(row.total)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <FootNote kind={kind} over={result.overLegal} rate={rate} />
              </section>
            </motion.div>
          )}

          {view === 3 && (
            <motion.div key="step3" {...fadeSwap(0.35)} style={STACKED}>
              {/* ---------------- ขั้นที่ 3 สรุป ---------------- */}
              <div className="space-y-4">
                <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/5">
                  <div className="border-b border-brand-100 bg-gradient-to-b from-brand-50/80 to-white px-5 py-5 md:px-8">
                    <div className="flex items-center gap-3">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/25">
                        <ClipboardList className="h-6 w-6" />
                      </span>
                      <div className="min-w-0">
                        <h2 className="text-lg font-bold text-brand-900 md:text-xl">
                          สรุปผลการคำนวณ
                        </h2>
                        <p className="text-sm text-gray-600">
                          {words.tab} · คำนวณเมื่อ {thaiDate(printedAt)} · สั่งพิมพ์เก็บไว้ได้
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="px-5 py-6 md:px-8">
                    <p className="text-sm font-semibold text-gray-700">ตัวเลขที่ใช้คำนวณ</p>
                    <dl className="mt-2 divide-y divide-gray-100 rounded-2xl bg-gray-50 px-4 ring-1 ring-gray-100">
                      <Row label={words.principal} value={`${plain(principal)} บาท`} />
                      <Row
                        label="อัตราดอกเบี้ย"
                        value={`${rate}% ต่อปี`}
                        note={rateName || undefined}
                      />
                      <Row
                        label="จำนวนวันที่คิดดอกเบี้ย"
                        value={`${plain(days)} วัน`}
                        note={
                          mode === "dates" ? `${thaiDate(from)} ถึง ${thaiDate(to)}` : undefined
                        }
                      />
                      <Row label="จำนวนวันใน 1 ปี (ตัวหาร)" value={`${basis} วัน`} />
                    </dl>

                    <p className="mt-5 text-sm font-semibold text-gray-700">ผลที่คำนวณได้</p>
                    <div className="mt-2 rounded-2xl bg-brand-50 px-5 py-4 ring-1 ring-brand-100">
                      <p className="text-sm font-medium text-brand-700">{words.result}</p>
                      <p className="mt-0.5 text-3xl font-bold tabular-nums text-brand-800 md:text-4xl">
                        {money(result.interest)}{" "}
                        <span className="text-xl font-semibold md:text-2xl">บาท</span>
                      </p>

                      {/* วิธีคิดติดไปกับใบสรุปด้วย — พิมพ์ออกมาแล้วต้องอธิบายตัวเองได้โดยไม่ต้องเปิดเว็บ */}
                      <div className="mt-3 overflow-x-auto rounded-xl bg-white/70 px-4 py-2.5">
                        <div className="flex min-w-max items-center gap-2 text-sm text-gray-700">
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

                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <Tile
                        label="ดอกเบี้ยวันละ"
                        value={`${money(result.perDay)} บาท`}
                        hint={words.perDayHint}
                      />
                      <Tile
                        label={words.total}
                        value={`${money(result.total)} บาท`}
                        hint={words.totalHint}
                        strong
                      />
                    </div>
                  </div>

                  <FootNote kind={kind} over={result.overLegal} rate={rate} />
                </section>

                {/* ปุ่มพิมพ์/เริ่มใหม่ อยู่ในขั้นสรุปเท่านั้น — สองขั้นแรกยังไม่มีอะไรให้พิมพ์ */}
                <div className="no-print flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-200"
                  >
                    <Printer className="h-4 w-4" /> พิมพ์ใบสรุป
                  </button>
                  <button
                    type="button"
                    onClick={reset}
                    className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-brand-700"
                  >
                    <RotateCcw className="h-4 w-4" /> เริ่มใหม่
                  </button>
                </div>

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
                      href="/loans/"
                      className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-200"
                    >
                      ดูอัตราดอกเบี้ยเงินกู้ทุกประเภท <ChevronRight className="h-4 w-4" />
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
            onClick={() => setStep(view === 3 ? 2 : 1)}
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
              ดูสรุป <ArrowRight className="h-4 w-4" />
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

/**
 * เศษส่วนแบบในใบประชาสัมพันธ์ — ตัวเศษอยู่บน ตัวส่วนอยู่ล่าง มีเส้นคั่นกลาง
 * เขียนเป็น a/b บรรทัดเดียวก็ได้ แต่คนที่จับคู่กับใบประชาสัมพันธ์จะอ่านยากกว่ามาก
 */
function Fraction({ top, bottom }: { top: string; bottom: string }) {
  return (
    <span className="inline-flex flex-col items-center leading-tight">
      <span className="px-1.5 tabular-nums">{top}</span>
      <span className="my-0.5 h-px w-full self-stretch bg-current opacity-60" />
      <span className="px-1.5 tabular-nums">{bottom}</span>
    </span>
  );
}

/** ช่องกรอกตัวเลขพร้อมหน่วยท้ายช่อง */
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
      {/*
        ⚠️ type="text" + inputMode ตั้งใจ ไม่ใช้ type="number"
        — บนมือถือยังได้แป้นตัวเลขเหมือนกัน แต่ไม่มีลูกศรขึ้นลงมากวน
        และไม่โดนเบราว์เซอร์ล้างค่าทิ้งทั้งช่องเวลาพิมพ์จุลภาคหรือเลขไทยติดมา
      */}
      <input
        id={id}
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-4 pr-16 text-lg font-semibold tabular-nums text-gray-800 shadow-sm outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
      />
      <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm font-medium text-gray-400">
        {unit}
      </span>
    </div>
  );
}

function Field({
  id,
  label,
  hint,
  icon,
  unit,
  value,
  onChange,
  children,
}: {
  id: string;
  label: string;
  hint: string;
  icon: React.ReactNode;
  unit: string;
  value: string;
  onChange: (next: string) => void;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-700"
      >
        <span className="text-gray-400">{icon}</span>
        {label}
      </label>
      <p className="mt-0.5 text-xs text-gray-500">{hint}</p>
      <NumberBox id={id} unit={unit} value={value} onChange={onChange} className="mt-2" />
      {children}
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
    <div className="no-print mt-2 flex flex-wrap gap-2">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => onPick(item.key)}
          className={`rounded-full px-3 py-1.5 text-sm font-medium tabular-nums transition ${
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

function Tile({
  label,
  value,
  hint,
  strong = false,
}: {
  label: string;
  value: string;
  hint: string;
  strong?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl px-4 py-3 ring-1 ${
        strong ? "bg-brand-50 ring-brand-100" : "bg-gray-50 ring-gray-100"
      }`}
    >
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p
        className={`mt-0.5 text-xl font-bold tabular-nums ${strong ? "text-brand-800" : "text-gray-800"}`}
      >
        {value}
      </p>
      <p className="mt-0.5 text-xs text-gray-500">{hint}</p>
    </div>
  );
}
