"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn, Loader2 } from "lucide-react";
import LineMark from "@/components/admin/LineMark";

/**
 * หน้าเข้าสู่ระบบ — ปุ่ม LINE เป็นทางหลัก รหัสผ่านเป็นทางเข้าครั้งแรก
 *
 * คนที่ผูก LINE แล้วจะใส่รหัสผ่านไม่ผ่าน (API ตอบ 403 พร้อม useLine)
 * เพราะรหัสผ่านของระบบนี้อ่อน — ตั้งต้นเป็นเลข 4 ตัวท้ายเบอร์ซึ่งคนในสำนักงานรู้กันหมด
 *
 * ⚠️ **อย่าอธิบายซ้ำหลายที่ในจอเดียว** — รอบแรกเขียนไว้ทั้งบนแถบคั่น ทั้งใต้ปุ่ม
 * ทั้งในกล่องเตือน สามชุดพูดเรื่องเดียวกัน อ่านแล้วไม่รู้ว่าต้องทำอะไรกันแน่
 * ตอนนี้เหลือที่เดียว: กล่องเตือนบอกว่าให้ทำอะไรต่อ ที่เหลือเป็นแค่ป้ายสั้น ๆ
 */

/** ข้อความอธิบายว่าทำไมกลับมาที่หน้านี้ — รหัสมาจาก /api/auth/line/callback */
const LINE_MESSAGE: Record<string, string> = {
  denied: "ยกเลิกการเข้าสู่ระบบด้วย LINE แล้ว",
  expired: "หมดเวลา กรุณากดปุ่ม LINE ใหม่อีกครั้ง",
  state: "คำขอไม่ถูกต้อง กรุณาเริ่มใหม่จากหน้านี้",
  verify: "ยืนยันตัวตนกับ LINE ไม่สำเร็จ กรุณาลองใหม่",
  toomany: "ลองหลายครั้งเกินไป กรุณารอสักครู่",
  nolink: "บัญชี LINE นี้ยังไม่ได้ผูก — ใส่ชื่อผู้ใช้และรหัสผ่านด้านล่างก่อน",
};

export default function LoginForm({
  lineReady,
  lineNotice,
}: {
  lineReady: boolean;
  lineNotice?: string;
}) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [useLine, setUseLine] = useState(false);
  const [busy, setBusy] = useState(false);

  const notice = lineNotice ? (LINE_MESSAGE[lineNotice] ?? "เข้าสู่ระบบด้วย LINE ไม่สำเร็จ") : "";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setUseLine(false);

    // ต้องมี / ปิดท้าย — next.config ตั้ง trailingSlash ไว้ ไม่งั้นโดน redirect 308
    const response = await fetch("/api/auth/login/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (response.ok) {
      // มาจาก /login/ ซึ่งพอเข้าระบบได้แล้วไม่มีอะไรให้ดูต่อ — พาไปหลังบ้านเลย
      router.replace("/admin/");
      router.refresh();
      return;
    }

    const data = await response.json().catch(() => ({}));
    setError(data.error ?? "เข้าสู่ระบบไม่สำเร็จ");
    setUseLine(data.useLine === true);
    setBusy(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl bg-white p-7 shadow-lg ring-1 ring-black/5">
        <h1 className="text-xl font-bold text-gray-800">หลังบ้านเว็บไซต์</h1>
        <p className="mt-1 text-sm text-gray-500">สหกรณ์ออมทรัพย์สาธารณสุขสงขลา จำกัด</p>

        {notice && (
          <p className="mt-5 rounded-lg bg-amber-50 px-3 py-2 text-sm leading-relaxed text-amber-800">
            {notice}
          </p>
        )}

        {lineReady && (
          <>
            {/*
              ลิงก์ธรรมดา ไม่ใช่ fetch — ขั้นตอนของ LINE ต้องพาเบราว์เซอร์ออกไปทั้งหน้า
              ให้เจ้าหน้าที่เห็นว่ากำลังอยู่ที่ line.me จริง ก่อนกดยินยอม
            */}
            <a
              href="/api/auth/line/start/?mode=login"
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#06C755] px-4 py-3 font-medium text-white transition hover:bg-[#05b34c]"
            >
              <LineMark className="h-6 w-6" />
              เข้าสู่ระบบด้วย LINE
            </a>

            <div className="mt-5 flex items-center gap-3">
              <span className="h-px flex-1 bg-gray-200" />
              <span className="text-xs text-gray-400">หรือ</span>
              <span className="h-px flex-1 bg-gray-200" />
            </div>
          </>
        )}

        <form onSubmit={submit}>
          <label className="mt-5 block text-sm font-medium text-gray-700">
            ชื่อผู้ใช้
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </label>

          <label className="mt-4 block text-sm font-medium text-gray-700">
            รหัสผ่าน
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </label>

          {error && (
            <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm leading-relaxed text-red-700">
              {error}
              {useLine && (
                <a
                  href="/api/auth/line/start/?mode=login"
                  className="mt-2 inline-flex items-center gap-1.5 font-medium text-[#06C755] hover:underline"
                >
                  <LineMark />
                  กดที่นี่เพื่อเข้าด้วย LINE
                </a>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className={`mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 font-medium transition disabled:opacity-60 ${
              lineReady
                ? "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                : "bg-brand-600 text-white hover:bg-brand-700"
            }`}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
            เข้าสู่ระบบด้วยรหัสผ่าน
          </button>
        </form>
      </div>
    </main>
  );
}
