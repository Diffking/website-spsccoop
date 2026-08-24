"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CalendarClock, FileText } from "lucide-react";
import SlideProgress from "@/components/ui/SlideProgress";
import { useAutoRotate } from "@/lib/useAutoRotate";
import { STACKED, fadeSwap } from "@/lib/slideMotion";
import { CardDocs, DocTables } from "@/components/site/DocLinks";
import type { DocTable } from "@/lib/pageDocs";
import type { WelfareGroup } from "@/lib/welfareGroups";

/**
 * สวัสดิการสมาชิก — วางเป็นการ์ดแบบเดียวกับอัตราดอกเบี้ย แยกกลุ่มตามกำหนดยื่นเอกสาร
 *
 * ของเดิมเป็นตารางสามคอลัมน์ ซึ่งอ่านยากบนมือถือ (ต้องเลื่อนซ้ายขวา) และดูน่าเบื่อ
 * เจ้าของเว็บขอให้ทำแบบเดียวกับ `RateSections` 22 ส.ค. 2026
 *
 * ข้อมูลยังเก็บเป็นตารางในเนื้อหาหน้า เจ้าหน้าที่จึงแก้เองได้ตามปกติ —
 * ฝั่งเซิร์ฟเวอร์อ่านตารางไปทำเป็นกลุ่มก่อนส่งเข้ามา (ดู src/lib/welfareGroups.ts)
 *
 * ใช้ `useAutoRotate` ตัวกลางเดียวกับสไลด์อื่นทั้งเว็บ ตามกฎใน AGENTS.md
 * จึงหยุดรอจนกว่าจะเลื่อนมาเห็น หยุดตอนเอาเมาส์ชี้ และกดปุ่มเองแล้วรีเซ็ตนาฬิกา
 *
 * 11 วินาที — ช้าที่สุดในเว็บ เพราะการ์ดหนึ่งใบมีทั้งเงื่อนไขการจ่ายและเอกสารที่ต้องยื่น
 * ต้องใช้เวลาอ่านจริง ไม่ใช่กวาดตาผ่านเหมือนแบนเนอร์
 */
const GROUP_MS = 11000;

/**
 * ตัวเลขที่สมาชิกมองหา — **จำนวนเงิน** กับ **จำนวนงวดการเป็นสมาชิก**
 *
 * จับเลข (รวมช่วงแบบ 6-60 และเลขมีจุลภาคแบบ 150,000) ที่ตามด้วยคำว่า บาท หรือ งวด
 * แล้วขยายให้ใหญ่กว่าข้อความรอบ ๆ · หน่วย (บาท/งวด) คงขนาดเดิมไว้
 * เพราะถ้าขยายทั้งวลีจะกลายเป็นตัวโตทั้งบรรทัด แล้วไม่มีอะไรเด่นเลย
 *
 * ⚠️ ไม่แตะข้อความอื่น — เนื้อความมาจากประกาศสหกรณ์ ห้ามตัดต่อ แค่เน้นตัวเลขที่มีอยู่
 */
function Emphasize({ text, tone }: { text: string; tone: string }) {
  // สร้าง regex ใหม่ทุกครั้ง — ตัวที่ประกาศไว้นอกคอมโพเนนต์แก้ `lastIndex` ไม่ได้
  // (กฎ react-hooks ห้ามแก้ค่าที่อยู่นอกคอมโพเนนต์ และของที่แชร์กันจะจำตำแหน่งข้ามรอบ)
  const amount = /(\d[\d,]*(?:\s*-\s*\d[\d,]*)?)(\s*(?:บาท|งวด))/g;
  const parts: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = amount.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(
      <span key={m.index} className="whitespace-nowrap">
        <span className={`text-2xl font-extrabold tabular-nums ${tone}`}>{m[1]}</span>
        <span className="ml-0.5 text-sm font-semibold text-gray-500">{m[2]}</span>
      </span>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));

  return <>{parts}</>;
}

export default function WelfareSections({
  groups,
  tables = [],
}: {
  groups: WelfareGroup[];
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
      {/* ปุ่มเลือกกลุ่ม — ตัวเลขบอกว่ากลุ่มนั้นมีกี่รายการ จะได้รู้ว่าคุ้มกดไหม */}
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
            <span className="ml-1.5 text-xs opacity-70">{g.items.length}</span>
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

      {/* กรอบนอกเป็น grid แล้ววางกลุ่มเก่า/ใหม่ในช่องเดียวกัน (STACKED) — ห้ามใส่ mode="wait" */}
      <div className="mt-4 grid">
        <AnimatePresence initial={false}>
          <motion.div
            key={group.key}
            {...fadeSwap(0.7)}
            style={STACKED}
            className="grid grid-cols-1 gap-4 lg:grid-cols-2"
          >
            {/*
              โครงการ์ดคิดจากลำดับที่สายตาควรเจอ — คนไทยอ่านหนังสือน้อย
              ถ้าทุกอย่างขนาดเท่ากันหมดจะไม่มีใครอ่าน ต้องมีจุดให้สายตาเกาะทีละชั้น

                1. หัวการ์ดพื้นสีทึบ ตัวขาว = รู้ทันทีว่าสวัสดิการอะไร
                2. ตัวเลขเงิน/งวด ตัวโตหนา = สิ่งที่สมาชิกอยากรู้ที่สุด
                3. ป้ายเอกสารพื้นอ่อนติดล่าง = ต้องทำอะไรต่อ
            */}
            {group.items.map((item, i) => (
              <div
                key={item.name}
                className={`flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 transition hover:-translate-y-0.5 hover:shadow-lg ${group.tone.ring}`}
              >
                {/* หัวการ์ด — เลขลำดับในวงกลมช่วยให้กวาดตานับได้ว่ามีกี่รายการ */}
                <div className={`flex items-start gap-3 px-5 py-3.5 ${group.tone.active}`}>
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/25 text-sm font-bold tabular-nums">
                    {i + 1}
                  </span>
                  <p className="min-w-0 text-base font-bold leading-snug">{item.name}</p>
                </div>

                {/* leading-8 เพราะมีตัวเลขตัวโตปนอยู่ ถ้าชิดกว่านี้บรรทัดจะชนกัน */}
                <div className="space-y-2 px-5 py-4 text-sm leading-8 text-gray-700">
                  {item.pay.map((line) => (
                    <p key={line}>
                      <Emphasize text={line} tone={group.tone.text} />
                    </p>
                  ))}
                </div>

                {/*
                  ป้ายเอกสารดันไปติดขอบล่างเสมอ (mt-auto) การ์ดในแถวเดียวกัน
                  จึงมีแถบล่างอยู่ระดับเดียวกัน ต่อให้เงื่อนไขการจ่ายยาวไม่เท่ากัน
                */}
                <div
                  className={`mt-auto flex items-start gap-2 px-5 py-3 text-sm font-medium ${group.tone.card} ${group.tone.text}`}
                >
                  {/* นาฬิกา = มีกำหนดเวลา · แฟ้ม = ยื่นตามระเบียบไม่มีกำหนดวัน */}
                  {group.label.includes("ภายใน") ? (
                    <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" />
                  ) : (
                    <FileText className="mt-0.5 h-4 w-4 shrink-0" />
                  )}
                  <span className="min-w-0 space-y-0.5">
                    {item.doc.map((line) => (
                      <span key={line} className="block">
                        {line}
                      </span>
                    ))}
                  </span>
                </div>

                {/*
                  ระเบียบกับแบบฟอร์มของ "เรื่องนี้เรื่องเดียว" — อยู่ล่างสุดเพราะเป็น
                  ขั้นตอนสุดท้าย (รู้ว่าได้เท่าไหร่ → รู้ว่ายื่นเมื่อไหร่ → โหลดกระดาษไปกรอก)
                */}
                <CardDocs files={item.files} />
              </div>
            ))}
          </motion.div>
        </AnimatePresence>
      </div>

      <DocTables tables={tables} />
    </div>
  );
}
