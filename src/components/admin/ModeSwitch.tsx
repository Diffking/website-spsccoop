"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Sparkles, PencilLine } from "lucide-react";
import type { UpdateMode } from "@/lib/settings";

/**
 * สวิตช์เลือกวิธีอัปเดตของ component นั้น ๆ — พิมพ์เอง หรือ ให้ AI อ่านจากภาพ
 * เก็บลง Setting คีย์ componentModes เพื่อให้จำค่าไว้ข้ามการเข้าใช้งาน
 */
export default function ModeSwitch({
  component,
  value,
  aiReady,
}: {
  component: "slides" | "rates";
  value: UpdateMode;
  aiReady: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<UpdateMode>(value);
  const [busy, setBusy] = useState(false);

  async function pick(next: UpdateMode) {
    if (next === mode || busy) return;
    setMode(next);
    setBusy(true);
    await fetch("/api/admin/modes/", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [component]: next }),
    });
    setBusy(false);
    router.refresh();
  }

  const options: { key: UpdateMode; label: string; icon: typeof Sparkles }[] = [
    { key: "manual", label: "พิมพ์เอง", icon: PencilLine },
    { key: "ai", label: "ให้ AI อ่าน", icon: Sparkles },
  ];

  return (
    <div>
      <div className="inline-flex rounded-full bg-gray-100 p-1">
        {options.map((option) => {
          const active = mode === option.key;
          return (
            <button
              key={option.key}
              onClick={() => pick(option.key)}
              disabled={busy}
              className={`relative inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition disabled:opacity-60 ${
                active ? "text-white" : "text-gray-600 hover:text-gray-800"
              }`}
            >
              {active && (
                <motion.span
                  layoutId={`mode-${component}`}
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  className="absolute inset-0 rounded-full bg-brand-600"
                />
              )}
              <option.icon className="relative h-3.5 w-3.5" />
              <span className="relative">{option.label}</span>
            </button>
          );
        })}
      </div>

      {mode === "ai" && !aiReady && (
        <p className="mt-2 rounded-lg bg-amber-50 p-2.5 text-xs leading-relaxed text-amber-800">
          ยังใช้โหมด AI ไม่ได้ — ต้องใส่ <code className="font-mono">ANTHROPIC_API_KEY</code> ใน
          ไฟล์ <code className="font-mono">.env</code> แล้วรีสตาร์ตระบบก่อน ระหว่างนี้พิมพ์เองได้ตามปกติ
        </p>
      )}
    </div>
  );
}
