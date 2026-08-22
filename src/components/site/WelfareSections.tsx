"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CalendarClock, FileText } from "lucide-react";
import SlideProgress from "@/components/ui/SlideProgress";
import { useAutoRotate } from "@/lib/useAutoRotate";
import { STACKED, fadeSwap } from "@/lib/slideMotion";
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

export default function WelfareSections({ groups }: { groups: WelfareGroup[] }) {
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
            {group.items.map((item) => (
              <div
                key={item.name}
                className={`flex flex-col rounded-2xl p-5 ring-1 ${group.tone.card} ${group.tone.ring}`}
              >
                <p className={`text-base font-bold leading-snug ${group.tone.text}`}>{item.name}</p>

                {/* การจ่าย — บรรทัดเดียวก็เป็นย่อหน้า หลายบรรทัดค่อยทำเป็นรายการ */}
                <div className="mt-3 space-y-1 text-sm leading-relaxed text-gray-700">
                  {item.pay.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>

                {/*
                  เอกสารที่ต้องยื่นดันไปติดขอบล่างเสมอ (mt-auto) การ์ดในแถวเดียวกัน
                  จึงมีเส้นคั่นอยู่ระดับเดียวกัน ต่อให้เงื่อนไขการจ่ายยาวไม่เท่ากัน
                */}
                <div className="mt-auto flex items-start gap-2 border-t border-black/5 pt-3 text-sm text-gray-600">
                  {/* นาฬิกา = มีกำหนดเวลา · แฟ้ม = ยื่นตามระเบียบไม่มีกำหนดวัน */}
                  {group.label.includes("ภายใน") ? (
                    <CalendarClock className={`mt-0.5 h-4 w-4 shrink-0 ${group.tone.text}`} />
                  ) : (
                    <FileText className={`mt-0.5 h-4 w-4 shrink-0 ${group.tone.text}`} />
                  )}
                  <span className="min-w-0 space-y-0.5">
                    {item.doc.map((line) => (
                      <span key={line} className="block">
                        {line}
                      </span>
                    ))}
                  </span>
                </div>
              </div>
            ))}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
