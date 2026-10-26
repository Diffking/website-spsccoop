"use client";

import { useState } from "react";
import { Check, Copy, Server } from "lucide-react";

/**
 * ค่าที่ต้องตั้งเป็น secret ของ Cloudflare Worker — ให้กล่องพักคำตอบทำงาน (ดู src/lib/surveyQueue.ts)
 * โชว์เฉพาะ ADMIN เพราะมีโทเคนลับของกล่อง · ไม่มี PHP บนโฮสต์เกี่ยวข้องแล้ว
 */
export default function SurveyQueueSetup({ snippet }: { snippet: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(snippet).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <details className="group rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold text-gray-800">
        <Server className="h-5 w-5 text-brand-600" />
        ตั้งค่ากล่องพักคำตอบ (Cloudflare Worker)
        <span className="text-xs font-normal text-gray-400">(ผู้ดูแลระบบ · ทำครั้งเดียว)</span>
      </summary>
      <div className="mt-3 space-y-2 text-sm text-gray-600">
        <p>
          ให้สมาชิกส่งคำตอบได้ตอนเครื่องสำนักงานปิด — Worker ที่ survey.spsccoop.org พักคำตอบไว้
          (เข้ารหัส Cloudflare อ่านไม่ได้) แล้วเครื่องนี้ไปดึงมาเองเมื่อเปิด · ไม่ใช้ PHP บนโฮสต์
        </p>
        <ol className="list-decimal space-y-1 pl-5 text-xs leading-relaxed">
          <li>ทำตามขั้นตอนใน <code>cloudflare/survey-edge/README.md</code> (สร้างฐาน D1 · ผูกโดเมน)</li>
          <li>ตั้ง secret สองตัวตามด้านล่าง — สร้างกุญแจใหม่ที่นี่เมื่อไหร่ ต้องตั้งใหม่ที่ Worker ด้วย</li>
        </ol>
        <div className="relative">
          <pre className="max-h-72 overflow-auto rounded-xl bg-gray-900 p-3 text-[11px] leading-relaxed text-gray-100">{snippet}</pre>
          <button
            type="button"
            onClick={copy}
            className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1 text-xs text-white transition hover:bg-white/20"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "คัดลอกแล้ว" : "คัดลอก"}
          </button>
        </div>
        <p className="text-[11px] text-amber-700">⚠️ มีโทเคนลับ — อย่าส่งต่อทางแชทหรืออีเมล</p>
      </div>
    </details>
  );
}
