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
  CHECKUP_QUESTIONS,
  GROUP_LABEL,
  GROUP_TONE,
  checkupResult,
  type CheckupAnswers,
  type CheckupGroup,
} from "@/lib/financialCheckup";
import type { CheckupImages } from "@/lib/programPages";

/**
 * ตรวจสุขภาพการเงิน — ถามทีละข้อ ตอบด้วยการเลื่อนสเกล แล้วสรุปผลให้
 *
 * ⚠️ **ไม่ส่งคำตอบไปไหนทั้งนั้น** ทุกอย่างอยู่ใน state ของหน้านี้ล้วน ๆ
 * ไม่มี fetch ไม่มี localStorage — ปิดแท็บแล้วหายหมด (ดูเหตุผลใน src/lib/financialCheckup.ts)
 *
 * ⚠️ **หน้านี้จงใจไม่มีช่องพิมพ์ตัวเลขเลย** ถ้าวันหลังมีคนขอให้ "พิมพ์เองได้ด้วย"
 * ต้องถามเจ้าของเว็บก่อน — เรื่องนี้ตัดสินใจไปแล้วว่าให้เลื่อนอย่างเดียว
 */

const baht = (n: number) => n.toLocaleString("th-TH");

/** ไอคอนแทนภาพ ตอนที่ข้อนั้นยังไม่ได้ใส่ภาพประกอบ */
const GROUP_ICON: Record<CheckupGroup, typeof Wallet> = {
  income: Wallet,
  need: Coins,
  debt: Coins,
  save: Coins,
  want: Coins,
};

export default function FinancialCheckup({ images }: { images: CheckupImages }) {
  /** -1 = หน้าเริ่มต้น · 0..20 = คำถาม · CHECKUP_QUESTIONS.length = หน้าผลตรวจ */
  const [at, setAt] = useState(-1);
  const [answers, setAnswers] = useState<CheckupAnswers>({});

  const total = CHECKUP_QUESTIONS.length;
  const question = at >= 0 && at < total ? CHECKUP_QUESTIONS[at] : null;
  const result = useMemo(() => checkupResult(answers), [answers]);

  /** ค่าที่เลือกอยู่ของข้อปัจจุบัน — ยังไม่เคยแตะ = 0 (ขั้นแรกสุดของสเกล) */
  const value = question ? (answers[question.id] ?? 0) : 0;
  const stepIndex = question ? Math.max(0, question.steps.indexOf(value)) : 0;

  const setValue = (id: string, next: number) => setAnswers((a) => ({ ...a, [id]: next }));

  const restart = () => {
    setAnswers({});
    setAt(-1);
  };

  return (
    <div className="mx-auto w-full max-w-3xl">
      {/* แถบความคืบหน้า — โผล่เฉพาะตอนกำลังตอบ ไม่กวนหน้าเริ่มต้นกับหน้าผล */}
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
                value={value}
                stepIndex={stepIndex}
                onPick={(next) => setValue(question.id, next)}
              />
            </motion.div>
          )}

          {at === total && (
            <motion.div key="result" {...fadeSwap(0.35)} style={STACKED}>
              <Result result={result} onRestart={restart} onBack={() => setAt(total - 1)} />
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
        ตอบคำถาม {total} ข้อ เกี่ยวกับรายรับและรายจ่ายในหนึ่งเดือน
        แล้วระบบจะสรุปให้ว่าเงินไหลไปทางไหนมากที่สุด และสุขภาพการเงินของคุณอยู่ระดับไหน
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
  stepIndex,
  image,
  onPick,
}: {
  question: (typeof CHECKUP_QUESTIONS)[number];
  value: number;
  stepIndex: number;
  image?: string;
  onPick: (next: number) => void;
}) {
  const tone = GROUP_TONE[question.group];
  const Icon = GROUP_ICON[question.group];
  const last = question.steps.length - 1;

  return (
    <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/5">
      {/* ภาพประกอบของข้อนี้ — ไม่ได้ใส่ก็เป็นแถบสีอ่อนกับไอคอน ความสูงเท่ากันเสมอ การ์ดจึงไม่กระตุก */}
      <div className={`grid h-36 place-items-center overflow-hidden ${tone.bg} md:h-44`}>
        {image ? (
          // รูปมาจากหลังบ้าน ไม่รู้ขนาดล่วงหน้า จึงใช้ <img> ธรรมดา
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="h-full w-full object-cover" />
        ) : (
          <Icon className={`h-12 w-12 opacity-30 ${tone.text}`} />
        )}
      </div>

      <div className="p-6 md:p-8">
        <h2 className="text-xl font-bold leading-snug text-gray-800 md:text-2xl">{question.text}</h2>
        <p className="mt-2 text-sm leading-relaxed text-gray-500">{question.hint}</p>

        {/* ตัวเลขตัวโต — สิ่งเดียวที่ต้องมองตอนเลื่อน */}
        <p className="mt-6 text-center">
          <span className={`text-5xl font-extrabold tabular-nums ${tone.text}`}>{baht(value)}</span>
          <span className="ml-2 text-lg font-semibold text-gray-400">บาท / เดือน</span>
        </p>

        {/*
          สเกลเลื่อน — ขั้นไม่เท่ากัน จึงเลื่อนด้วย "ลำดับขั้น" ไม่ใช่จำนวนเงินตรง ๆ
          (ถ้าใช้จำนวนเงินเป็นค่าของ input ช่วงเงินน้อยจะเลื่อนยากมากบนมือถือ)
        */}
        <input
          type="range"
          min={0}
          max={last}
          step={1}
          value={stepIndex}
          onChange={(e) => onPick(question.steps[Number(e.target.value)] ?? 0)}
          aria-label={question.text}
          aria-valuetext={`${baht(value)} บาทต่อเดือน`}
          className="money-scale mt-5"
        />
        <div className="mt-1 flex justify-between text-xs text-gray-400">
          <span>ไม่มี</span>
          <span className="tabular-nums">{baht(question.steps[last])}+</span>
        </div>

        {/* ปุ่มลัดสำหรับค่าที่เจอบ่อย — กดทีเดียวจบ ไม่ต้องเลื่อนหาทีละขั้น */}
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {quickPicks(question.steps).map((amount) => (
            <button
              key={amount}
              type="button"
              onClick={() => onPick(amount)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium tabular-nums transition ${
                value === amount
                  ? `${tone.bar} text-white shadow`
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {amount === 0 ? "ไม่มี" : baht(amount)}
            </button>
          ))}
        </div>
      </div>
    </div>
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
 * หน้าผลตรวจ
 * ------------------------------------------------------------------ */

function Result({
  result,
  onRestart,
  onBack,
}: {
  result: ReturnType<typeof checkupResult>;
  onRestart: () => void;
  onBack: () => void;
}) {
  const parts: { group: CheckupGroup; value: number }[] = [
    { group: "need", value: result.need },
    { group: "debt", value: result.debt },
    { group: "save", value: result.save },
    { group: "want", value: result.want },
  ];
  const widthBase = Math.max(result.spend, result.income, 1);

  return (
    <div className="space-y-4">
      {/* คะแนนรวม — วงแหวนวาดด้วย conic-gradient ล้วน ไม่ต้องพึ่งไลบรารีกราฟ */}
      <div className="rounded-3xl bg-white p-7 text-center shadow-sm ring-1 ring-black/5 md:p-9">
        <p className="text-sm font-semibold text-gray-400">คะแนนสุขภาพการเงินของคุณ</p>
        <div
          className="mx-auto mt-4 grid h-40 w-40 place-items-center rounded-full"
          style={{
            background: `conic-gradient(currentColor ${result.score * 3.6}deg, #e5e7eb 0deg)`,
          }}
        >
          <span className={`grid h-32 w-32 place-items-center rounded-full bg-white ${result.level.tone}`}>
            <span className="text-5xl font-extrabold tabular-nums">{result.score}</span>
          </span>
        </div>
        <p className={`mt-4 text-2xl font-bold ${result.level.tone}`}>{result.level.label}</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">{result.level.summary}</p>
      </div>

      {/* สามตัวเลขที่คนอยากรู้ที่สุด */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "รายรับต่อเดือน", value: result.income, tone: "text-emerald-700" },
          { label: "รายจ่ายรวมต่อเดือน", value: result.spend, tone: "text-sky-700" },
          {
            label: result.left < 0 ? "ใช้เกินตัวเดือนละ" : "เหลือปลายเดือน",
            value: Math.abs(result.left),
            tone: result.left < 0 ? "text-rose-700" : "text-brand-700",
          },
        ].map((box) => (
          <div key={box.label} className="rounded-2xl bg-white p-5 text-center shadow-sm ring-1 ring-black/5">
            <p className="text-xs text-gray-400">{box.label}</p>
            <p className={`mt-1 text-2xl font-extrabold tabular-nums ${box.tone}`}>{baht(box.value)}</p>
            <p className="text-xs text-gray-400">บาท</p>
          </div>
        ))}
      </div>

      {/* เงินไปไหนบ้าง — แท่งเทียบสัดส่วน ทำด้วย CSS ล้วนเหมือนกราฟในหลังบ้าน */}
      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 md:p-8">
        <h3 className="text-base font-bold text-gray-800">เดือนหนึ่ง เงินไปไหนบ้าง</h3>
        <ul className="mt-4 space-y-3">
          {parts.map((part) => {
            const tone = GROUP_TONE[part.group];
            const percent = result.income > 0 ? Math.round((part.value / result.income) * 100) : 0;
            return (
              <li key={part.group}>
                <div className="flex items-baseline justify-between text-sm">
                  <span className={`font-semibold ${tone.text}`}>{GROUP_LABEL[part.group]}</span>
                  <span className="tabular-nums text-gray-500">
                    {baht(part.value)} บาท
                    {result.income > 0 && <span className="ml-1.5 text-gray-400">({percent}%)</span>}
                  </span>
                </div>
                <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className={`h-full rounded-full ${tone.bar}`}
                    style={{ width: `${(part.value / widthBase) * 100}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </div>

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
