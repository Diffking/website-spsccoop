"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck, Unlink } from "lucide-react";
import LineMark from "@/components/admin/LineMark";

/**
 * ผูก/ยกเลิกการผูกบัญชี LINE ของตัวเอง
 *
 * ผูกแล้วจะเข้าระบบด้วยปุ่ม LINE อย่างเดียว รหัสผ่านบนโดเมนสาธารณะถูกปิดไปเอง
 * (ยังใช้ที่ localhost ของเครื่องที่รันเว็บได้เสมอ เผื่อ LINE ล่ม — ดู AGENTS.md)
 *
 * ยกเลิกการผูกต้องใส่รหัสผ่านเดิม บาร์เดียวกับการเปลี่ยนรหัสผ่าน เพราะการปลดแล้วผูกใหม่
 * คือการเปลี่ยนกุญแจของบัญชี ถ้ากดได้เลยตอนเจ้าตัวลุกจากโต๊ะ คนที่มายืมเครื่องจะสลับ
 * ให้เป็น LINE ของตัวเองได้เงียบ ๆ
 */

/** ผลลัพธ์จาก /api/auth/line/callback — แปลงเป็นข้อความที่เจ้าหน้าที่อ่านรู้เรื่อง */
const NOTICE: Record<string, { kind: "ok" | "error"; text: string }> = {
  ok: { kind: "ok", text: "ผูกบัญชี LINE เรียบร้อยแล้ว ครั้งต่อไปกดปุ่ม LINE ที่หน้าเข้าสู่ระบบได้เลย" },
  denied: { kind: "error", text: "ยกเลิกการผูกบัญชี LINE แล้ว" },
  expired: { kind: "error", text: "ขั้นตอนหมดอายุ (เกิน 10 นาที) กรุณากดผูกใหม่อีกครั้ง" },
  state: { kind: "error", text: "คำขอไม่ถูกต้อง กรุณาเริ่มใหม่จากหน้านี้" },
  verify: { kind: "error", text: "ยืนยันตัวตนกับ LINE ไม่สำเร็จ กรุณาลองใหม่" },
  taken: {
    kind: "error",
    text: "บัญชี LINE นี้ถูกผูกกับเจ้าหน้าที่คนอื่นไปแล้ว — บัญชี LINE หนึ่งอันผูกได้คนเดียว",
  },
  already: {
    kind: "error",
    text: "บัญชีนี้ผูก LINE อื่นไว้อยู่แล้ว ถ้าจะเปลี่ยนให้กดยกเลิกการผูกก่อน",
  },
  viewonly: { kind: "error", text: "กำลังอยู่ในมุมมองผู้ใช้อื่น ซึ่งดูได้อย่างเดียว" },
};

export default function LineLinkCard({
  userId,
  linked,
  linkedAt,
  ready,
  notice,
}: {
  userId: string;
  linked: boolean;
  linkedAt: string | null;
  ready: boolean;
  notice?: string;
}) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(
    notice ? (NOTICE[notice] ?? { kind: "error", text: "ผูกบัญชี LINE ไม่สำเร็จ" }) : null,
  );

  async function unlink(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setStatus(null);

    const response = await fetch(`/api/admin/users/${userId}/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unlinkLine: true, currentPassword: password }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setStatus({ kind: "error", text: data.error ?? "ยกเลิกการผูกไม่สำเร็จ" });
      setBusy(false);
      return;
    }

    setPassword("");
    setAsking(false);
    setBusy(false);
    setStatus({ kind: "ok", text: "ยกเลิกการผูกบัญชี LINE แล้ว — เข้าระบบด้วยรหัสผ่านได้ตามเดิม" });
    router.refresh();
  }

  if (!ready) {
    return (
      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <p className="font-semibold text-gray-800">เข้าสู่ระบบด้วย LINE</p>
        <p className="mt-1 text-sm text-gray-500">
          ยังไม่ได้ตั้งค่าช่อง LINE ของสหกรณ์ — ผู้ดูแลระบบต้องใส่ค่าใน <code>.env</code> ก่อน
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 rounded-lg p-2 ${linked ? "bg-[#06C755]/10 text-[#06C755]" : "bg-gray-100 text-gray-400"}`}
        >
          <LineMark />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-gray-800">เข้าสู่ระบบด้วย LINE</p>
          {linked ? (
            <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm text-gray-500">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              ผูกบัญชีแล้ว
              {linkedAt && <span className="text-gray-400">· เมื่อ {linkedAt}</span>}
            </p>
          ) : (
            <p className="mt-0.5 text-sm text-gray-500">
              ยังไม่ได้ผูก — ตอนนี้เข้าระบบด้วยรหัสผ่านอยู่
            </p>
          )}
        </div>
      </div>

      {status && (
        <p
          className={`mt-3 rounded-lg px-3 py-2 text-sm leading-relaxed ${
            status.kind === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"
          }`}
        >
          {status.text}
        </p>
      )}

      {!linked && (
        <>
          <a
            href="/api/auth/line/start/?mode=link"
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#06C755] px-4 py-2.5 font-medium text-white transition hover:bg-[#05b34c]"
          >
            <LineMark />
            ผูกบัญชี LINE ของฉัน
          </a>
          <p className="mt-3 text-xs leading-relaxed text-gray-500">
            ผูกแล้วจะเข้าระบบด้วยปุ่ม LINE อย่างเดียว รหัสผ่านจะใช้ไม่ได้อีก —
            ปลอดภัยกว่าเพราะรหัสผ่านตั้งต้นของระบบคือเลข 4 ตัวท้ายเบอร์โทร ซึ่งคนอื่นเดาได้
          </p>
        </>
      )}

      {linked && !asking && (
        <button
          type="button"
          onClick={() => setAsking(true)}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
        >
          <Unlink className="h-4 w-4" />
          ยกเลิกการผูก
        </button>
      )}

      {linked && asking && (
        <form onSubmit={unlink} className="mt-4 rounded-xl bg-gray-50 p-3">
          <label className="block text-sm font-medium text-gray-700">
            ยืนยันด้วยรหัสผ่านเดิม
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2 text-base outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </label>
          <p className="mt-2 text-xs text-gray-500">
            จำรหัสเดิมไม่ได้? ให้ผู้ดูแลระบบกด “ตั้งรหัสใหม่จากเบอร์โทร” ให้ก่อน
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="submit"
              disabled={busy || password.length === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlink className="h-4 w-4" />}
              ยกเลิกการผูก
            </button>
            <button
              type="button"
              onClick={() => {
                setAsking(false);
                setPassword("");
              }}
              className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100"
            >
              ไม่เอาแล้ว
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
