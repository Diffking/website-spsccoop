"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check } from "lucide-react";
import SlideProgress from "@/components/ui/SlideProgress";
import { useAutoRotate } from "@/lib/useAutoRotate";
import { STACKED, fadeSwap } from "@/lib/slideMotion";
import { CardDocs, DocTables } from "@/components/site/DocLinks";
import type { DocTable } from "@/lib/pageDocs";
import type { RateGroup } from "@/lib/rateGroups";

/**
 * อัตราดอกเบี้ย — วางแบบการ์ดราคา (อิงหน้าตา Pricing Sections ของ Tailwind)
 * แยกเป็นกลุ่มตามประเภทแล้วเลื่อนสลับกลุ่มเอง · ใช้ได้ทั้งเงินฝากและเงินกู้
 * (กลุ่มกับสีคิดมาจากฝั่งเซิร์ฟเวอร์แล้ว ดู src/lib/rateGroups.ts)
 *
 * ทำไมต้องเป็น component ไม่ใช่ HTML ที่แทนที่ตอน render เหมือนเมื่อก่อน:
 * ต้องกดสลับกลุ่มได้และเลื่อนเอง ซึ่งต้องมี state ฝั่งเบราว์เซอร์
 *
 * ใช้ `useAutoRotate` ตัวกลางเดียวกับสไลด์บนหน้าแรก จึงได้มาฟรีทั้ง
 * **หยุดรอจนกว่าจะเลื่อนมาเห็น · หยุดตอนเอาเมาส์ชี้ · กดเองแล้วรีเซ็ตนาฬิกา**
 * (ดูกฎใน AGENTS.md — ของที่เลื่อนเองทุกตัวต้องผ่านตัวกลางนี้ ห้ามเขียน setInterval เอง)
 *
 * จังหวะ 7.5 วินาที — ช้ากว่าสไลด์บนหน้าแรกทุกตัว เพราะนี่คือหน้าอ้างอิงที่คนตั้งใจ
 * มาอ่านตัวเลข ไม่ใช่แบนเนอร์ที่กวาดตาผ่าน · เลขไม่ลงตัวกับของหน้าแรกด้วย
 */
const GROUP_MS = 7500;

/**
 * การ์ดอัตราหนึ่งประเภท — ตัวเลข ชื่อประเภท แล้วปิดท้ายด้วยระเบียบ/แบบฟอร์มของประเภทนั้น
 *
 * แถบเอกสารเป็นพื้นขาวคาดใต้การ์ด (ไม่ใช่สีเดียวกับการ์ด) เพื่อให้เห็นว่าเป็นคนละชั้นกัน
 * — ข้างบนคือ "ข้อมูล" ข้างล่างคือ "ของที่กดได้" · ประเภทที่ยังไม่มีเอกสารก็ไม่มีแถบนี้
 */
function Card({ row, group }: { row: RateGroup["rows"][number]; group: RateGroup }) {
  return (
    <div
      className={`flex flex-col overflow-hidden rounded-2xl ring-1 ${group.tone.card} ${group.tone.ring}`}
    >
      <div className="p-5">
        <p className={`text-sm font-semibold ${group.tone.text}`}>{group.label}</p>
        {/*
          ตัวเลขต้องมาก่อนชื่อ — คนเปิดหน้านี้มาหาตัวเลข ไม่ได้มาอ่านชื่อประเภท
          tabular-nums = เลขกว้างเท่ากันทุกตัว คอลัมน์จึงไม่ขยับตอนสลับกลุ่ม
        */}
        <p className="mt-2 flex items-baseline gap-1">
          <span className={`text-4xl font-bold tracking-tight tabular-nums ${group.tone.text}`}>
            {row.rate}
          </span>
          <span className={`text-xl font-semibold ${group.tone.text}`}>%</span>
          <span className="text-sm text-gray-500">ต่อปี</span>
        </p>
        <p className="mt-3 flex items-start gap-2 text-sm leading-relaxed text-gray-700">
          <Check className={`mt-0.5 h-4 w-4 shrink-0 ${group.tone.text}`} />
          {/* min-w-0 = ชื่อประเภทยาว ๆ ภาษาไทยต้องยอมตกบรรทัด ไม่ดันการ์ดให้กว้างเกิน */}
          <span className="min-w-0">{row.label}</span>
        </p>
      </div>

      {/* mt-auto = แถบเอกสารติดขอบล่างเสมอ การ์ดในแถวเดียวกันจึงมีแถบล่างระดับเดียวกัน */}
      <div className="mt-auto bg-white/70">
        <CardDocs files={row.files} />
      </div>
    </div>
  );
}

export default function RateSections({
  groups,
  tables = [],
}: {
  groups: RateGroup[];
  tables?: DocTable[];
}) {
  const [at, setAt] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const auto = useAutoRotate({
    target: box,
    count: groups.length,
    at,
    step: () => setAt((v) => (v + 1) % groups.length),
    ms: GROUP_MS,
  });

  if (groups.length === 0) return null;
  const group = groups[Math.min(at, groups.length - 1)];

  return (
    <div ref={box} {...auto.hover} className="my-6">
      {/* ปุ่มสลับกลุ่ม — กดเลือกเองได้ ไม่ต้องรอให้มันเลื่อนไปถึง */}
      <div className="flex flex-wrap justify-center gap-2">
        {groups.map((g, i) => (
          <button
            key={g.key}
            onClick={() => setAt(i)}
            aria-current={i === at ? "true" : undefined}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              i === at ? g.tone.active : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {g.label}
            <span className="ml-1.5 text-xs opacity-70">{g.rows.length}</span>
          </button>
        ))}
      </div>

      {groups.length > 1 && (
        <div className="mx-auto mt-3 h-1 max-w-md overflow-hidden rounded-full bg-gray-100">
          <SlideProgress
            ms={GROUP_MS}
            at={at}
            paused={auto.paused}
            className={`block rounded-full bg-gradient-to-r ${group.tone.bar}`}
          />
        </div>
      )}

      {/*
        กรอบนอกเป็น grid แล้ววางกลุ่มเก่ากับกลุ่มใหม่ไว้ในช่องเดียวกัน (STACKED)
        ทั้งคู่จึงซ้อนทับกันตอนจางสลับ ความสูงเท่ากลุ่มที่สูงสุดเสมอ ไม่มีวูบว่าง
        — ห้ามใส่ mode="wait" (ดู AGENTS.md)
      */}
      <div className="mt-4 grid">
        <AnimatePresence initial={false}>
          <motion.div
            key={group.key}
            {...fadeSwap(0.7)}
            style={STACKED}
            // grid-cols-N แบบมีเลขปลอดภัย Tailwind ใส่ minmax(0,1fr) ให้เอง
            className="grid grid-cols-1 gap-4 sm:grid-cols-2"
          >
            {group.rows.map((row) => (
              <Card key={row.label} row={row} group={group} />
            ))}
          </motion.div>
        </AnimatePresence>
      </div>

      <DocTables tables={tables} />

      <p className="mt-4 text-center text-xs text-gray-400">
        * อัตราดอกเบี้ยอาจเปลี่ยนแปลงตามประกาศสหกรณ์ ยึดตามประกาศฉบับล่าสุดเป็นสำคัญ
      </p>
    </div>
  );
}
