"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  Coins,
  Lock,
  Printer,
  RotateCcw,
  Wallet,
} from "lucide-react";
import { STACKED, fadeSwap } from "@/lib/slideMotion";
import {
  GROUP_HINT,
  GROUP_LABEL,
  GROUP_TONE,
  SCALES,
  checkupResult,
  type CheckupAnswers,
  type CheckupGroup,
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
}: {
  questions: CheckupQuestion[];
  images: CheckupImages;
}) {
  /** -1 = หน้าเริ่มต้น · 0..n-1 = คำถาม · n = หน้าผลตรวจ */
  const [at, setAt] = useState(-1);
  const [answers, setAnswers] = useState<CheckupAnswers>({});
  /** รายรับ — ไม่ได้อยู่ใน 21 ข้อ ถามทีหลังที่หน้าผลเพื่อปลดล็อกคะแนน */
  const [income, setIncome] = useState(0);

  const total = questions.length;
  const question = at >= 0 && at < total ? questions[at] : null;
  const result = useMemo(
    () => checkupResult(questions, answers, income),
    [questions, answers, income],
  );

  const restart = () => {
    setAnswers({});
    setIncome(0);
    setAt(-1);
  };

  if (total === 0) {
    return (
      <p className="rounded-2xl bg-white p-8 text-center text-gray-500 shadow-sm ring-1 ring-black/5">
        ยังไม่มีคำถามในโปรแกรมนี้
      </p>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
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
  value,
  label,
  tone,
  onPick,
}: {
  steps: number[];
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

      {/* ปุ่มลัดสำหรับค่าที่เจอบ่อย — กดทีเดียวจบ ไม่ต้องเลื่อนหาทีละขั้น */}
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {quickPicks(steps).map((amount) => (
          <button
            key={amount}
            type="button"
            onClick={() => onPick(amount)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium tabular-nums transition ${
              value === amount ? `${tone} text-white shadow` : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {amount === 0 ? "ไม่มี" : baht(amount)}
          </button>
        ))}
      </div>
    </>
  );
}

/** ค่าลัด 6 ค่าที่กระจายทั่วสเกล — เอา 0 ไว้ตัวแรกเสมอเพราะเป็นคำตอบที่ใช้บ่อยที่สุด */
function quickPicks(steps: number[]): number[] {
  const picks = new Set<number>([0]);
  for (let i = 1; i <= 5; i += 1) {
    picks.add(steps[Math.round((steps.length - 1) * (i / 6))] ?? 0);
  }
  return [...picks];
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

  return (
    <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/5">
      {/* ภาพประกอบของข้อนี้ — ไม่ได้ใส่ก็เป็นแถบสีอ่อนกับไอคอน ความสูงเท่ากันเสมอ การ์ดจึงไม่กระตุก */}
      <div className={`grid h-36 place-items-center overflow-hidden ${tone.bg} md:h-44`}>
        {image ? (
          // รูปมาจากหลังบ้าน ไม่รู้ขนาดล่วงหน้า จึงใช้ <img> ธรรมดา
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="h-full w-full object-cover" />
        ) : (
          <Coins className={`h-12 w-12 opacity-30 ${tone.text}`} />
        )}
      </div>

      <div className="p-6 md:p-8">
        <h2 className="text-lg font-bold leading-snug text-gray-800 md:text-2xl">{question.text}</h2>
        {question.hint && (
          <p className="mt-2 text-sm leading-relaxed text-gray-500">{question.hint}</p>
        )}

        {/* ตัวเลขตัวโต — สิ่งเดียวที่ต้องมองตอนเลื่อน */}
        <p className="mt-6 text-center">
          <span className={`text-5xl font-extrabold tabular-nums ${tone.text}`}>{baht(value)}</span>
          <span className="ml-2 text-lg font-semibold text-gray-400">บาท / เดือน</span>
        </p>

        <MoneyScale
          steps={SCALES[question.scale]}
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
  onIncome,
  onRestart,
  onBack,
}: {
  result: ReturnType<typeof checkupResult>;
  income: number;
  onIncome: (next: number) => void;
  onRestart: () => void;
  onBack: () => void;
}) {
  const parts: { group: CheckupGroup; value: number }[] = [
    { group: "need", value: result.need },
    { group: "debt", value: result.debt },
    { group: "save", value: result.save },
    { group: "want", value: result.want },
  ];
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
          value={income}
          label="รายได้ต่อเดือน"
          tone="bg-emerald-500"
          onPick={onIncome}
        />
      </div>

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
