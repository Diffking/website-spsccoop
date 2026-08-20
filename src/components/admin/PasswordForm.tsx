"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";

/**
 * ตั้งรหัสผ่านของตัวเอง
 *
 * เดิมรหัสผ่านคือเลข 4 ตัวท้ายเบอร์โทร ซึ่งเดาได้แค่หมื่นแบบ และคนในสหกรณ์
 * รู้เบอร์กันเองอยู่แล้ว — ใครตั้งรหัสเองแล้วระบบจะเลิกเขียนทับด้วยเลขท้ายเบอร์
 * แม้จะไปแก้เบอร์โทรทีหลังก็ตาม (ดู User.ownPassword)
 *
 * ถามรหัสเดิมด้วยทั้งที่ล็อกอินอยู่แล้ว เพราะกันคนมาเปลี่ยนรหัสยึดบัญชี
 * ตอนที่เจ้าตัวลุกจากโต๊ะโดยไม่ได้ล็อกหน้าจอ
 */
export default function PasswordForm({ userId, ownPassword }: { userId: string; ownPassword: boolean }) {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const tooShort = next.length > 0 && next.trim().length < 8;
  const mismatch = again.length > 0 && next !== again;
  const ready = current.length > 0 && next.trim().length >= 8 && next === again;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setStatus(null);

    const response = await fetch(`/api/admin/users/${userId}/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: next, currentPassword: current }),
    });
    const data = await response.json().catch(() => ({}));
    setBusy(false);

    if (!response.ok) {
      setStatus({ kind: "error", text: data.error ?? "เปลี่ยนรหัสผ่านไม่สำเร็จ" });
      return;
    }
    setCurrent("");
    setNext("");
    setAgain("");
    setStatus({ kind: "ok", text: "เปลี่ยนรหัสผ่านแล้ว ครั้งหน้าเข้าระบบด้วยรหัสใหม่" });
    router.refresh();
  }

  const field =
    "mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base outline-none focus:border-brand-500";

  return (
    <form onSubmit={submit} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
          <KeyRound className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="font-semibold text-gray-800">ตั้งรหัสผ่านของคุณเอง</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            {ownPassword
              ? "คุณตั้งรหัสผ่านเองไว้แล้ว — เปลี่ยนใหม่ได้ตลอดที่นี่"
              : "ตอนนี้คุณยังใช้รหัสตั้งต้น (เลข 4 ตัวท้ายเบอร์โทร) ซึ่งคนอื่นเดาได้ง่าย ควรตั้งรหัสของตัวเอง"}
          </p>
        </div>
      </div>

      {!ownPassword && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2.5 text-sm leading-relaxed text-amber-800">
          เลข 4 ตัวท้ายเบอร์โทรมีความเป็นไปได้แค่ 10,000 แบบ และคนในสหกรณ์รู้เบอร์กันอยู่แล้ว
          ตั้งรหัสของตัวเองจะปลอดภัยกว่ามาก
        </p>
      )}

      <div className="mt-4 space-y-3">
        <label className="block text-sm font-medium text-gray-700">
          รหัสผ่านที่ใช้อยู่ตอนนี้
          <input
            type={show ? "text" : "password"}
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
            required
            className={field}
          />
        </label>

        <label className="block text-sm font-medium text-gray-700">
          รหัสผ่านใหม่
          <span className="ml-1 text-xs font-normal text-gray-400">(อย่างน้อย 8 ตัวอักษร)</span>
          <input
            type={show ? "text" : "password"}
            value={next}
            onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password"
            required
            className={field}
          />
          {tooShort && <span className="mt-1 block text-xs text-red-600">ยังสั้นไป ต้องอย่างน้อย 8 ตัวอักษร</span>}
        </label>

        <label className="block text-sm font-medium text-gray-700">
          พิมพ์รหัสผ่านใหม่อีกครั้ง
          <input
            type={show ? "text" : "password"}
            value={again}
            onChange={(e) => setAgain(e.target.value)}
            autoComplete="new-password"
            required
            className={field}
          />
          {mismatch && <span className="mt-1 block text-xs text-red-600">สองช่องยังไม่ตรงกัน</span>}
        </label>

        <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={show}
            onChange={(e) => setShow(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300"
          />
          {show ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          แสดงรหัสผ่านที่พิมพ์
        </label>
      </div>

      {status && (
        <p
          className={`mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
            status.kind === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
          }`}
        >
          {status.kind === "ok" && <Check className="h-4 w-4 shrink-0" />}
          {status.text}
        </p>
      )}

      {/*
        รายการที่ต้องครบก่อนกดได้ — ติ๊กเขียวทีละข้อ
        เดิมปุ่มแค่จางลงเฉย ๆ ใครกรอกรหัสใหม่สั้นไปจะกดแล้วไม่มีอะไรเกิดขึ้น
        แล้วนึกว่าระบบเสีย (เกิดขึ้นจริงกับ 07337) — ต้องบอกให้เห็นว่าติดตรงไหน
      */}
      <ul className="mt-4 space-y-1 text-xs">
        {[
          { ok: current.length > 0, text: "ใส่รหัสผ่านที่ใช้อยู่ตอนนี้" },
          { ok: next.trim().length >= 8, text: "รหัสผ่านใหม่ยาวอย่างน้อย 8 ตัวอักษร" },
          { ok: next.length > 0 && next === again, text: "พิมพ์รหัสผ่านใหม่ซ้ำให้ตรงกัน" },
        ].map((item) => (
          <li
            key={item.text}
            className={`flex items-center gap-1.5 ${item.ok ? "text-emerald-700" : "text-gray-400"}`}
          >
            <Check className={`h-3.5 w-3.5 shrink-0 ${item.ok ? "" : "opacity-30"}`} />
            {item.text}
          </li>
        ))}
      </ul>

      <button
        type="submit"
        disabled={busy || !ready}
        className="mt-3 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
        เปลี่ยนรหัสผ่าน
      </button>
      {!ready && !busy && (
        <span className="ml-3 text-xs text-gray-400">กรอกให้ครบทั้ง 3 ข้อก่อนถึงจะกดได้</span>
      )}

      <p className="mt-3 text-xs leading-relaxed text-gray-400">
        จำรหัสไม่ได้ให้แจ้งผู้ดูแลระบบ (07337) กด “ตั้งรหัสใหม่จากเบอร์โทร” ให้
        แล้วกลับมาตั้งรหัสของตัวเองอีกครั้ง
      </p>
    </form>
  );
}
