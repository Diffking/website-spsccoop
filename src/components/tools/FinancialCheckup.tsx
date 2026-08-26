"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  Coins,
  Lock,
  Maximize2,
  Phone,
  Printer,
  RotateCcw,
  Wallet,
  X,
} from "lucide-react";
import { STACKED, fadeSwap } from "@/lib/slideMotion";
import {
  GROUP_HINT,
  GROUP_LABEL,
  GROUP_ORDER,
  GROUP_TONE,
  GUIDES,
  NET_MIN_RATIO,
  SCALES,
  checkupResult,
  type CheckupAnswers,
  type CheckupQuestion,
} from "@/lib/financialCheckup";
import type { CheckupImages } from "@/lib/programPages";

/**
 * ตรวจสุขภาพการเงิน — ถามทีละข้อ ตอบด้วยการเลื่อนสเกล แล้วสรุปผลให้
 *
 * ⚠️ **ไม่ส่งคำตอบไปไหนทั้งนั้น** ทุกอย่างอยู่ใน state ของหน้านี้ล้วน ๆ
 * ไม่มี fetch ไม่มี localStorage — ปิดแท็บแล้วหายหมด
 *
 * ⚠️ **หน้านี้จงใจไม่มีช่องพิมพ์ตัวเลขเลย** ใครขอให้เพิ่มต้องถามเจ้าของเว็บก่อน
 *
 * คำถามส่งเข้ามาจากฝั่งเซิร์ฟเวอร์ (เจ้าหน้าที่แก้เองได้ที่หลังบ้าน) จำนวนข้อจึงไม่ตายตัว
 * — ห้ามเขียนโค้ดที่อ้างว่ามี 21 ข้อเสมอ
 */

const baht = (n: number) => n.toLocaleString("th-TH");

export default function FinancialCheckup({
  questions,
  images,
  contactPhone,
}: {
  questions: CheckupQuestion[];
  images: CheckupImages;
  /** เบอร์สหกรณ์ที่โชว์ตอนแนะนำให้ขอคำปรึกษา — แอดมินแก้ได้ที่ หลังบ้าน → ส่วนท้ายเว็บ */
  contactPhone: string;
}) {
  /** -1 = หน้าเริ่มต้น · 0..n-1 = คำถาม · n = หน้าผลตรวจ */
  const [at, setAt] = useState(-1);
  const [answers, setAnswers] = useState<CheckupAnswers>({});
  /** รายรับ — ไม่ได้อยู่ใน 21 ข้อ ถามทีหลังที่หน้าผลเพื่อปลดล็อกคะแนน */
  const [income, setIncome] = useState(0);
  /**
   * ข้อที่ผู้ใช้กดปิดไม่ให้คิดในหน้าสรุป — เก็บเป็นรหัสข้อ
   *
   * เจ้าของเว็บขอไว้ 26 ส.ค. 2026: อยากให้กดเล่นได้ที่หน้าสุดท้ายว่า "ถ้าตัดข้อนี้ออกจะเป็นยังไง"
   * ⚠️ **ปิดแล้วคำตอบเดิมยังอยู่ครบ** ไม่ได้ล้างเป็น 0 — เปิดกลับมาต้องได้ตัวเลขเดิมทันที
   */
  const [off, setOff] = useState<Set<string>>(new Set());

  const total = questions.length;
  const question = at >= 0 && at < total ? questions[at] : null;

  /** คำตอบที่เอาไปคิดจริง — ข้อที่ปิดไว้นับเป็น 0 */
  const counted = useMemo(() => {
    const out: CheckupAnswers = {};
    for (const q of questions) out[q.id] = off.has(q.id) ? 0 : (answers[q.id] ?? 0);
    return out;
  }, [questions, answers, off]);

  const result = useMemo(
    () => checkupResult(questions, counted, income),
    [questions, counted, income],
  );

  const restart = () => {
    setAnswers({});
    setIncome(0);
    setOff(new Set());
    setAt(-1);
  };

  const toggle = (id: string) =>
    setOff((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (total === 0) {
    return (
      <p className="rounded-2xl bg-white p-8 text-center text-gray-500 shadow-sm ring-1 ring-black/5">
        ยังไม่มีคำถามในโปรแกรมนี้
      </p>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      {question && (
        <div className="mb-4">
          <div className="mb-2 flex items-baseline justify-between text-sm">
            <span className={`font-semibold ${GROUP_TONE[question.group].text}`}>
              {GROUP_LABEL[question.group]}
            </span>
            <span className="tabular-nums text-gray-500">
              ข้อ {at + 1} จาก {total}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-100">
            <div
              className={`h-full rounded-full transition-all duration-300 ${GROUP_TONE[question.group].bar}`}
              style={{ width: `${((at + 1) / total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/*
        วางทุกหน้าจอไว้ในช่องกริดเดียวกัน (STACKED) แล้วจางสลับ — ห้ามใส่ mode="wait"
        ไม่งั้นจะมีจังหวะว่างหนึ่งวูบทุกครั้งที่กดถัดไป (กฎเดียวกับสไลด์ทั้งเว็บ ดู AGENTS.md)
      */}
      <div className="grid">
        <AnimatePresence initial={false}>
          {at === -1 && (
            <motion.div key="intro" {...fadeSwap(0.35)} style={STACKED}>
              <Intro onStart={() => setAt(0)} total={total} />
            </motion.div>
          )}

          {question && (
            <motion.div key={question.id} {...fadeSwap(0.35)} style={STACKED}>
              <QuestionCard
                image={images[question.id]}
                question={question}
                value={answers[question.id] ?? 0}
                onPick={(next) => setAnswers((a) => ({ ...a, [question.id]: next }))}
              />
            </motion.div>
          )}

          {at === total && (
            <motion.div key="result" {...fadeSwap(0.35)} style={STACKED}>
              <Result
                result={result}
                income={income}
                contactPhone={contactPhone}
                questions={questions}
                answers={answers}
                off={off}
                onToggle={toggle}
                onCountAll={() => setOff(new Set())}
                onIncome={setIncome}
                onRestart={restart}
                onBack={() => setAt(total - 1)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ปุ่มเดินหน้า/ถอยหลัง — อยู่นอกกรอบที่จางสลับ จะได้ไม่กระพริบตามทุกครั้งที่เปลี่ยนข้อ */}
      {question && (
        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setAt(at - 1)}
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-medium text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
          >
            <ArrowLeft className="h-4 w-4" />
            {at === 0 ? "กลับหน้าแรก" : "ข้อก่อนหน้า"}
          </button>
          <button
            type="button"
            onClick={() => setAt(at + 1)}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-brand-700"
          >
            {at === total - 1 ? "ดูผลตรวจ" : "ข้อถัดไป"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * สเกลเลื่อนเลือกจำนวนเงิน — ใช้ทั้งหน้าคำถามและช่องรายรับในหน้าผล
 * ------------------------------------------------------------------ */

function MoneyScale({
  steps,
  guides,
  value,
  label,
  tone,
  onPick,
}: {
  steps: number[];
  /** ปุ่มลัดใต้สเกล — เลขกลม ๆ ที่กำหนดไว้ ไม่ได้หารช่วงสเกลเอา (ดู GUIDES) */
  guides: number[];
  value: number;
  label: string;
  tone: string;
  onPick: (next: number) => void;
}) {
  const last = steps.length - 1;
  // ค่าที่ไม่ตรงขั้นไหนเลย (เช่นของเก่าที่เคยเลือกไว้ตอนสเกลคนละแบบ) ให้ถอยไปขั้นแรก
  const index = Math.max(0, steps.indexOf(value));

  return (
    <>
      {/*
        เลื่อนด้วย "ลำดับขั้น" ไม่ใช่จำนวนเงินตรง ๆ — ขั้นถี่ตอนเงินน้อย ห่างตอนเงินเยอะ
        ถ้าผูกกับจำนวนเงินตรง ๆ ช่วงหลักร้อยจะเลื่อนยากมากบนมือถือ
      */}
      <input
        type="range"
        min={0}
        max={last}
        step={1}
        value={index}
        onChange={(e) => onPick(steps[Number(e.target.value)] ?? 0)}
        aria-label={label}
        aria-valuetext={`${baht(value)} บาทต่อเดือน`}
        className="money-scale mt-5"
      />
      <div className="mt-1 flex justify-between text-xs text-gray-400">
        <span>ไม่มี</span>
        <span className="tabular-nums">{baht(steps[last])}+</span>
      </div>

      {/*
        ปุ่มลัดเลขกลม ๆ — กดทีเดียวจบ ไม่ต้องเลื่อนหาทีละขั้น
        กันไว้ไม่ให้เกินเพดานของสเกล เผื่อวันหลังมีสเกลที่เตี้ยกว่าไกด์ตัวท้าย
      */}
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {guides
          .filter((amount) => amount <= steps[last])
          .map((amount) => (
            <button
              key={amount}
              type="button"
              onClick={() => onPick(amount)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium tabular-nums transition ${
                value === amount
                  ? `${tone} text-white shadow`
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {amount === 0 ? "ไม่มี" : baht(amount)}
            </button>
          ))}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ *
 * หน้าเริ่มต้น
 * ------------------------------------------------------------------ */

function Intro({ onStart, total }: { onStart: () => void; total: number }) {
  return (
    <div className="rounded-3xl bg-gradient-to-b from-white to-brand-50/70 p-7 text-center shadow-sm ring-1 ring-brand-100 md:p-10">
      <p className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/25">
        <Wallet className="h-8 w-8" />
      </p>
      <h2 className="mt-5 text-2xl font-bold text-brand-900 md:text-3xl">
        เดือนหนึ่ง เงินของเราไปไหนหมด?
      </h2>
      <p className="mx-auto mt-3 max-w-xl text-gray-600">
        ตอบคำถาม {total} ข้อ เกี่ยวกับรายจ่ายในหนึ่งเดือน
        แล้วระบบจะรวมให้ว่าเดือนหนึ่งต้องใช้เงินเท่าไร และเงินไหลไปทางไหนมากที่สุด
      </p>

      <ul className="mx-auto mt-6 grid max-w-lg gap-2.5 text-left text-sm text-gray-600">
        {[
          "ตอบด้วยการเลื่อนสเกล ไม่ต้องพิมพ์ตัวเลข",
          "ใช้เวลาประมาณ 3 นาที ย้อนกลับไปแก้ข้อเดิมได้ตลอด",
          "ตัวเลขกลม ๆ พอ ไม่ต้องเป๊ะถึงหลักบาท",
        ].map((line) => (
          <li key={line} className="flex items-start gap-2">
            <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
            {line}
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onStart}
        className="mt-7 inline-flex items-center gap-2 rounded-full bg-brand-600 px-8 py-3 text-base font-semibold text-white shadow-lg shadow-brand-600/25 transition hover:bg-brand-700"
      >
        เริ่มตรวจ <ArrowRight className="h-5 w-5" />
      </button>

      {/* บอกเรื่องความเป็นส่วนตัวตั้งแต่ก่อนเริ่ม — คนไม่กล้าตอบเรื่องเงินถ้าไม่รู้ว่าข้อมูลไปไหน */}
      <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-gray-400">
        <Lock className="h-3.5 w-3.5" />
        คำตอบอยู่ในเครื่องของคุณเท่านั้น ไม่ถูกส่งหรือเก็บไว้ที่สหกรณ์
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * การ์ดคำถาม
 * ------------------------------------------------------------------ */

function QuestionCard({
  question,
  value,
  image,
  onPick,
}: {
  question: CheckupQuestion;
  value: number;
  image?: string;
  onPick: (next: number) => void;
}) {
  const tone = GROUP_TONE[question.group];
  const [zoom, setZoom] = useState(false);

  // กด Esc ปิดภาพเต็มจอ — คนที่ใช้คีย์บอร์ดคาดหวังแบบนี้เสมอ
  useEffect(() => {
    if (!zoom) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZoom(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoom]);

  return (
    <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/5">
      {/*
        ภาพประกอบของข้อนี้ — **ต้องเห็นเต็มใบ ห้ามครอบตัด** (เจ้าของเว็บสั่ง 26 ส.ค. 2026)
        จึงใช้ object-contain ไม่ใช่ object-cover · ภาพที่อัปมาสัดส่วนไม่เท่ากันทุกใบ
        ถ้าครอบให้เต็มกรอบจะโดนตัดหัวตัดท้าย ยอมมีขอบว่างข้างภาพดีกว่าเห็นไม่ครบ

        ⚠️ **ความสูงผูกกับความสูงจอ (vh) ไม่ใช่ค่าคงที่เป็นพิกเซล** — จอสูงก็ได้ภาพใหญ่
        จอเตี้ย (มือถือแนวนอน) ก็ยังเหลือที่ให้สเกลกับปุ่ม · แต่ยังคงที่เท่ากันทุกข้อ
        การ์ดจึงไม่กระตุกตอนเปลี่ยนข้อ (ข้อที่ไม่มีภาพก็สูงเท่ากัน)

        กดที่ภาพแล้วขยายเต็มจอได้อีกชั้น สำหรับใบที่มีตัวหนังสือเยอะ
      */}
      <div
        className={`relative grid h-[38vh] max-h-[420px] min-h-[190px] place-items-center overflow-hidden ${tone.bg}`}
      >
        {image ? (
          <>
            <button
              type="button"
              onClick={() => setZoom(true)}
              title="กดเพื่อดูภาพเต็มจอ"
              className="h-full w-full cursor-zoom-in"
            >
              {/* รูปมาจากหลังบ้าน ไม่รู้ขนาดล่วงหน้า จึงใช้ <img> ธรรมดา */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image} alt="" className="h-full w-full object-contain" />
            </button>
            <span
              aria-hidden
              className="pointer-events-none absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-medium text-white"
            >
              <Maximize2 className="h-3 w-3" /> กดที่ภาพเพื่อดูเต็มจอ
            </span>
          </>
        ) : (
          <Coins className={`h-12 w-12 opacity-30 ${tone.text}`} />
        )}
      </div>

      {/* ภาพเต็มจอ — กดที่ไหนก็ปิด ไม่ต้องเล็งปุ่มกากบาท */}
      {zoom && image && (
        <div
          role="presentation"
          onClick={() => setZoom(false)}
          className="fixed inset-0 z-50 grid cursor-zoom-out place-items-center bg-black/90 p-3"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt={question.text} className="max-h-full max-w-full object-contain" />
          <button
            type="button"
            aria-label="ปิดภาพ"
            className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      <div className="p-5 md:p-7">
        <h2 className="text-lg font-bold leading-snug text-gray-800 md:text-xl">{question.text}</h2>
        {question.hint && <p className="mt-1.5 text-sm leading-relaxed text-gray-500">{question.hint}</p>}

        {/* ตัวเลขตัวโต — สิ่งเดียวที่ต้องมองตอนเลื่อน */}
        <p className="mt-5 text-center">
          <span className={`text-5xl font-extrabold tabular-nums ${tone.text}`}>{baht(value)}</span>
          <span className="ml-2 text-lg font-semibold text-gray-400">บาท / เดือน</span>
        </p>

        <MoneyScale
          steps={SCALES[question.scale]}
          guides={GUIDES[question.scale]}
          value={value}
          label={question.text}
          tone={tone.bar}
          onPick={onPick}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * หน้าผลตรวจ
 * ------------------------------------------------------------------ */

function Result({
  result,
  income,
  contactPhone,
  questions,
  answers,
  off,
  onToggle,
  onCountAll,
  onIncome,
  onRestart,
  onBack,
}: {
  result: ReturnType<typeof checkupResult>;
  income: number;
  contactPhone: string;
  questions: CheckupQuestion[];
  answers: CheckupAnswers;
  off: Set<string>;
  onToggle: (id: string) => void;
  onCountAll: () => void;
  onIncome: (next: number) => void;
  onRestart: () => void;
  onBack: () => void;
}) {
  /*
    เรียงตามลำดับหมวดที่เจ้าของเว็บกำหนด (ดู GROUP_ORDER) — หมวดที่ยอดเป็น 0
    ไม่ต้องขึ้นแท่ง เพราะยังไม่มีคำถามในหมวดนั้น หรือคนตอบไม่มีค่าใช้จ่ายด้านนั้นเลย
  */
  const parts = GROUP_ORDER.map((group) => ({ group, value: result[group] })).filter(
    (part) => part.value > 0,
  );
  const widthBase = Math.max(result.spend, 1);

  return (
    <div className="space-y-4">
      {/* ยอดรายจ่ายรวม — คำตอบหลักที่โปรแกรมนี้มีให้ ต้องเด่นที่สุดในหน้า */}
      <div className="rounded-3xl bg-gradient-to-b from-white to-brand-50/70 p-7 text-center shadow-sm ring-1 ring-brand-100 md:p-9">
        <p className="text-sm font-semibold text-gray-500">เดือนหนึ่งท่านต้องใช้เงินทั้งหมด</p>
        <p className="mt-2">
          <span className="text-5xl font-extrabold tabular-nums text-brand-800 md:text-6xl">
            {baht(result.spend)}
          </span>
          <span className="ml-2 text-lg font-semibold text-gray-400">บาท</span>
        </p>
        <p className="mt-1 text-sm text-gray-500">
          หรือประมาณปีละ{" "}
          <span className="font-semibold tabular-nums text-gray-700">{baht(result.spend * 12)}</span> บาท
        </p>
      </div>

      {/*
        สวิตช์คิด/ไม่คิดรายข้อ — กดแล้วทุกอย่างข้างล่างคิดใหม่ทันที ไม่มีปุ่มยืนยัน
        (ยอดรวม · กราฟ · เกณฑ์ 30% · คะแนน · คำแนะนำ อ่านจากผลชุดเดียวกันหมด)
      */}
      <ExcludeList
        questions={questions}
        answers={answers}
        off={off}
        onToggle={onToggle}
        onCountAll={onCountAll}
      />

      {/* เงินไปไหนบ้าง — แท่งเทียบสัดส่วน ทำด้วย CSS ล้วนเหมือนกราฟในหลังบ้าน */}
      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 md:p-8">
        <h3 className="text-base font-bold text-gray-800">เงินไปไหนบ้าง</h3>
        <ul className="mt-4 space-y-3">
          {parts.map((part) => {
            const tone = GROUP_TONE[part.group];
            const percent = result.spend > 0 ? Math.round((part.value / result.spend) * 100) : 0;
            return (
              <li key={part.group}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className={`font-semibold ${tone.text}`}>{GROUP_LABEL[part.group]}</span>
                  <span className="shrink-0 tabular-nums text-gray-500">
                    {baht(part.value)} บาท
                    <span className="ml-1.5 text-gray-400">({percent}%)</span>
                  </span>
                </div>
                <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className={`h-full rounded-full ${tone.bar}`}
                    style={{ width: `${(part.value / widthBase) * 100}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-gray-400">{GROUP_HINT[part.group]}</p>
              </li>
            );
          })}
        </ul>
      </div>

      {/*
        รายรับเป็นของแถม ไม่ได้อยู่ใน 21 ข้อ — เลื่อนเพิ่มแล้วถึงจะให้คะแนนได้
        ไม่เลื่อนก็ยังได้ยอดรายจ่ายรวมไปแล้ว ซึ่งเป็นคำตอบหลักของโปรแกรมนี้
      */}
      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 md:p-8">
        <h3 className="text-base font-bold text-gray-800">อยากรู้ว่าพอไหม? ใส่รายได้ต่อเดือนเพิ่ม</h3>
        <p className="mt-1 text-sm text-gray-500">
          เลื่อนสเกลใส่รายได้ที่ได้รับจริงต่อเดือน (รวมรายได้เสริม) แล้วระบบจะให้คะแนนสุขภาพการเงิน
          — จะข้ามไปก็ได้ ไม่บังคับ
        </p>
        <p className="mt-5 text-center">
          <span className="text-4xl font-extrabold tabular-nums text-emerald-700">{baht(income)}</span>
          <span className="ml-2 text-base font-semibold text-gray-400">บาท / เดือน</span>
        </p>
        <MoneyScale
          steps={SCALES.large}
          guides={GUIDES.large}
          value={income}
          label="รายได้ต่อเดือน"
          tone="bg-emerald-500"
          onPick={onIncome}
        />
      </div>

      {/*
        เกณฑ์คงเหลือสุทธิ 30% — อ้างอิงแนวทางแก้ไขปัญหาหนี้สินภาครัฐ
        เจ้าของเว็บเขียนข้อความมาเอง 26 ส.ค. 2026 · **ห้ามแก้ถ้อยคำเองโดยไม่ถาม**
        เพราะเป็นการอ้างอิงเกณฑ์ราชการ ไม่ใช่คำโปรยที่คิดขึ้นเอง

        ฐานคิดคือ "รายได้ − รายจ่ายทั้ง 21 ข้อ" (เจ้าของเว็บเลือกเอง) ซึ่งเข้มกว่าเกณฑ์
        ราชการที่หักเฉพาะรายการหักหนี้ — จึงบอกฐานคิดไว้ใต้ตัวเลขให้เห็นชัด ๆ
      */}
      {result.passNet !== null && <NetRuleCard result={result} contactPhone={contactPhone} />}

      {/* คะแนน — โผล่เฉพาะตอนใส่รายรับแล้ว */}
      {result.score !== null && result.level && (
        <div className="rounded-3xl bg-white p-7 text-center shadow-sm ring-1 ring-black/5 md:p-9">
          <p className="text-sm font-semibold text-gray-400">คะแนนสุขภาพการเงินของท่าน</p>
          {/* วงแหวนวาดด้วย conic-gradient ล้วน ไม่ต้องพึ่งไลบรารีกราฟ */}
          <div
            className={`mx-auto mt-4 grid h-40 w-40 place-items-center rounded-full ${result.level.tone}`}
            style={{ background: `conic-gradient(currentColor ${result.score * 3.6}deg, #e5e7eb 0deg)` }}
          >
            <span className="grid h-32 w-32 place-items-center rounded-full bg-white">
              <span className="text-5xl font-extrabold tabular-nums">{result.score}</span>
            </span>
          </div>
          <p className={`mt-4 text-2xl font-bold ${result.level.tone}`}>{result.level.label}</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">{result.level.summary}</p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-gray-50 p-4">
              <p className="text-xs text-gray-400">รายได้ต่อเดือน</p>
              <p className="mt-0.5 text-xl font-extrabold tabular-nums text-emerald-700">
                {baht(result.income)}
              </p>
            </div>
            <div className="rounded-2xl bg-gray-50 p-4">
              <p className="text-xs text-gray-400">
                {result.left < 0 ? "ใช้เกินตัวเดือนละ" : "เหลือปลายเดือน"}
              </p>
              <p
                className={`mt-0.5 text-xl font-extrabold tabular-nums ${
                  result.left < 0 ? "text-rose-700" : "text-brand-700"
                }`}
              >
                {baht(Math.abs(result.left))}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* คำแนะนำ — เรียงจากเรื่องที่ควรทำก่อน */}
      <div className="space-y-3">
        {result.advice.map((item) => (
          <div key={item.title} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
            <p className="font-bold text-gray-800">{item.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-gray-600">{item.detail}</p>
            {item.href && (
              <Link
                href={item.href}
                className="mt-2.5 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline"
              >
                {item.linkLabel} <ChevronRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-medium text-gray-500 transition hover:bg-gray-100"
        >
          <ArrowLeft className="h-4 w-4" /> กลับไปแก้คำตอบ
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-200"
        >
          <Printer className="h-4 w-4" /> พิมพ์ผลตรวจ
        </button>
        <button
          type="button"
          onClick={onRestart}
          className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-brand-700"
        >
          <RotateCcw className="h-4 w-4" /> ตรวจใหม่อีกครั้ง
        </button>
      </div>

      <p className="pt-1 text-center text-xs text-gray-400">
        ผลตรวจนี้เป็นการประเมินเบื้องต้นจากตัวเลขที่กรอกเอง ไม่ใช่คำแนะนำทางการเงินรายบุคคล
        · อยากคุยรายละเอียดติดต่อเจ้าหน้าที่สหกรณ์ได้เลย
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * เกณฑ์เงินเดือนคงเหลือสุทธิ 30%
 * ------------------------------------------------------------------ */

function NetRuleCard({
  result,
  contactPhone,
}: {
  result: ReturnType<typeof checkupResult>;
  contactPhone: string;
}) {
  const pass = result.passNet === true;
  // ปัดลงเสมอ — 29.6% ต้องไม่แสดงเป็น 30% ทั้งที่ยังไม่ผ่านเกณฑ์
  const percent = Math.floor(result.netRatio * 100);
  const minPercent = Math.round(NET_MIN_RATIO * 100);

  return (
    <div
      className={`rounded-3xl p-6 shadow-sm ring-1 md:p-8 ${
        pass ? "bg-emerald-50 ring-emerald-200" : "bg-rose-50 ring-rose-200"
      }`}
    >
      <div className="flex items-start gap-4">
        <span className="text-4xl leading-none" aria-hidden>
          {pass ? "🟢" : "🔴"}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className={`text-lg font-bold md:text-xl ${pass ? "text-emerald-800" : "text-rose-800"}`}>
            {pass ? "สภาพคล่องทางการเงินของคุณอยู่ในเกณฑ์ดี" : "เงินเดือนคงเหลือต่ำกว่าเกณฑ์มาตรฐาน"}
          </h3>

          <p className="mt-2 leading-relaxed text-gray-700">
            {pass ? (
              <>
                คุณมีเงินเดือนคงเหลือสุทธิ{" "}
                <b className="tabular-nums text-emerald-800">{percent}%</b>{" "}
                (ไม่น้อยกว่า {minPercent}% ของรายได้ทั้งหมด)
                ซึ่งเพียงพอต่อการดำรงชีพและมีสภาพคล่องทางการเงินที่ปลอดภัย
              </>
            ) : (
              <>
                คุณมีเงินเดือนคงเหลือสุทธิเพียง{" "}
                <b className="tabular-nums text-rose-800">{percent}%</b>{" "}
                ซึ่งน้อยกว่าเกณฑ์มาตรฐาน {minPercent}% อาจส่งผลกระทบต่อการดำรงชีพ
              </>
            )}
          </p>

          {/* บอกฐานคิดเสมอ — ไม่งั้นสมาชิกเอา % นี้ไปเทียบกับที่หน่วยงานคิดให้แล้วงงว่าทำไมไม่ตรง */}
          <p className="mt-2 text-xs text-gray-500">
            คิดจาก รายได้ {baht(result.income)} บาท − รายจ่ายที่ตอบไว้ทั้งหมด {baht(result.spend)} บาท
            = คงเหลือ {baht(result.left)} บาท
          </p>

          {!pass && (
            <div className="mt-4 space-y-3 border-t border-rose-200 pt-4">
              <div>
                <p className="text-sm font-bold text-rose-900">คำแนะนำเบื้องต้น</p>
                <p className="mt-1 text-sm leading-relaxed text-gray-700">
                  ควรลดภาระค่าใช้จ่ายที่ไม่จำเป็น หรือปรับโครงสร้างหนี้
                </p>
              </div>
              <div>
                <p className="text-sm font-bold text-rose-900">ขอคำปรึกษา</p>
                <p className="mt-1 text-sm leading-relaxed text-gray-700">
                  แนะนำติดต่อ <b>เจ้าหน้าที่สหกรณ์</b>{" "}
                  เพื่อรับคำแนะนำและวางแผนแก้ไขปัญหาหนี้สินร่วมกัน
                </p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {contactPhone && (
                    <a
                      href={`tel:${contactPhone.replace(/[^0-9+]/g, "")}`}
                      className="inline-flex items-center gap-1.5 rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-rose-700"
                    >
                      <Phone className="h-4 w-4" /> โทร {contactPhone}
                    </a>
                  )}
                  <Link
                    href="/about/contact/"
                    className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-rose-700 ring-1 ring-rose-200 transition hover:bg-rose-100"
                  >
                    ช่องทางติดต่อทั้งหมด <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * เลือกว่าจะคิดข้อไหนบ้าง — กดเล่นได้ที่หน้าสรุป
 * ------------------------------------------------------------------ */

function ExcludeList({
  questions,
  answers,
  off,
  onToggle,
  onCountAll,
}: {
  questions: CheckupQuestion[];
  answers: CheckupAnswers;
  off: Set<string>;
  onToggle: (id: string) => void;
  onCountAll: () => void;
}) {
  /*
    ข้อที่ตอบ 0 ไม่มีผลกับยอดรวมอยู่แล้ว กดเปิดปิดก็ไม่เกิดอะไร — ซ่อนไว้ท้ายรายการ
    ดีกว่าเอามาปนกับข้อที่มีตัวเลข เพราะ 21 แถวยาวเกินกว่าจะกวาดตาหาเจอ
  */
  const filled = questions.filter((q) => (answers[q.id] ?? 0) > 0);
  const empty = questions.length - filled.length;

  // ตัดออกไปแล้วประหยัดได้เท่าไร — ตัวเลขที่คนกดเล่นอยากเห็นที่สุด
  const cut = filled
    .filter((q) => off.has(q.id))
    .reduce((sum, q) => sum + (answers[q.id] ?? 0), 0);

  if (filled.length === 0) return null;

  return (
    <div className="no-print rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 md:p-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-bold text-gray-800">ลองตัดออกดูสิ ว่าจะเหลือเท่าไร</h3>
        {cut > 0 && (
          <button
            type="button"
            onClick={onCountAll}
            className="text-xs font-medium text-gray-400 transition hover:text-brand-700"
          >
            คิดทุกข้อเหมือนเดิม
          </button>
        )}
      </div>
      <p className="mt-1 text-sm text-gray-500">
        กดสวิตช์ปิดข้อไหนก็ได้ แล้วทุกอย่างข้างล่างจะคิดใหม่ให้ทันที — คำตอบเดิมไม่หาย
        กดเปิดกลับได้ตลอด
      </p>

      {cut > 0 && (
        <p className="mt-3 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
          ตัดออก {off.size} ข้อ ประหยัดได้เดือนละ{" "}
          <b className="tabular-nums">{baht(cut)}</b> บาท · ปีละ{" "}
          <b className="tabular-nums">{baht(cut * 12)}</b> บาท
        </p>
      )}

      <ul className="mt-4 divide-y divide-gray-100">
        {filled.map((question) => {
          const tone = GROUP_TONE[question.group];
          const skipped = off.has(question.id);
          return (
            <li key={question.id}>
              {/*
                ทั้งแถวเป็นปุ่มเดียว — นิ้วบนมือถือกดตรงไหนของแถวก็ได้ ไม่ต้องเล็งที่สวิตช์
                (สวิตช์กว้าง 44px ซึ่งเล็กเกินกว่าจะเป็นเป้ากดเดี่ยว ๆ)
              */}
              <button
                type="button"
                onClick={() => onToggle(question.id)}
                aria-pressed={!skipped}
                className="flex w-full items-center gap-3 py-2.5 text-left transition hover:bg-gray-50"
              >
                {/* สวิตช์ — สีตามกลุ่มตอนเปิด สีเทาตอนปิด */}
                <span
                  aria-hidden
                  className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                    skipped ? "bg-gray-300" : tone.bar
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                      skipped ? "left-0.5" : "left-[1.375rem]"
                    }`}
                  />
                </span>

                <span className={`min-w-0 flex-1 text-sm ${skipped ? "text-gray-400 line-through" : "text-gray-700"}`}>
                  {question.text}
                </span>

                <span
                  className={`shrink-0 text-sm font-semibold tabular-nums ${
                    skipped ? "text-gray-300 line-through" : tone.text
                  }`}
                >
                  {baht(answers[question.id] ?? 0)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {empty > 0 && (
        <p className="mt-3 text-xs text-gray-400">
          อีก {empty} ข้อที่ตอบไว้ว่าไม่มี ไม่ได้เอามาคิดอยู่แล้ว จึงไม่ต้องแสดงตรงนี้
        </p>
      )}
    </div>
  );
}
