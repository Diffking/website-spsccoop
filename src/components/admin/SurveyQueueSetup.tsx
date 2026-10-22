"use client";

import { useState } from "react";
import { Check, Copy, Server } from "lucide-react";

/**
 * ค่าที่ต้องคัดลอกไปใส่ config.php บนโฮสต์ — ให้กล่องพักคำตอบทำงาน (ดู src/lib/surveyQueue.ts)
 * โชว์เฉพาะ ADMIN เพราะมีโทเคนลับของกล่อง · รหัสฐาน MySQL ไม่โชว์ ให้กรอกเองบนโฮสต์
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
        ตั้งค่ากล่องพักคำตอบบนโฮสต์
        <span className="text-xs font-normal text-gray-400">(ผู้ดูแลระบบ · ทำครั้งเดียว)</span>
      </summary>
      <div className="mt-3 space-y-2 text-sm text-gray-600">
        <p>
          ให้สมาชิกส่งคำตอบได้ตอนเครื่องสำนักงานปิด — www.spsccoop.com พักคำตอบไว้ (เข้ารหัส โฮสต์อ่านไม่ได้)
          แล้วส่งตามมาเมื่อเครื่องเปิด
        </p>
        <ol className="list-decimal space-y-1 pl-5 text-xs leading-relaxed">
          <li>คัดลอกค่าด้านล่างไปวางใน <code>config.php</code> บนโฮสต์ ก่อนบรรทัด <code>];</code> ตัวสุดท้าย</li>
          <li>แก้ <code>pass</code> เป็นรหัสฐาน <code>spsccoop_cast</code> ที่สร้างไว้ใน DirectAdmin</li>
          <li>อัปไฟล์ <code>index.php</code> · <code>lib/queue.php</code> · <code>warm.php</code> จากโฟลเดอร์ <code>php-frontend/</code> ผ่าน File Manager</li>
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
