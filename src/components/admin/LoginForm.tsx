"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn, Loader2 } from "lucide-react";

/**
 * หน้าเข้าสู่ระบบ — ปุ่ม LINE เป็นทางหลัก รหัสผ่านเป็นทางเข้าครั้งแรก
 *
 * คนที่ผูก LINE แล้วจะใส่รหัสผ่านไม่ผ่าน (API ตอบ 403 พร้อม useLine)
 * เพราะรหัสผ่านของระบบนี้อ่อน — ตั้งต้นเป็นเลข 4 ตัวท้ายเบอร์ซึ่งคนในสำนักงานรู้กันหมด
 * ผูก LINE แล้วจึงไม่มีเหตุผลจะเปิดทางที่อ่อนกว่าค้างไว้
 */

/** ข้อความอธิบายว่าทำไมกลับมาที่หน้านี้ — รหัสมาจาก /api/auth/line/callback */
const LINE_MESSAGE: Record<string, string> = {
  denied: "ยกเลิกการเข้าสู่ระบบด้วย LINE แล้ว",
  expired: "ขั้นตอนหมดอายุ (เกิน 10 นาที) กรุณากดปุ่ม LINE ใหม่อีกครั้ง",
  state: "คำขอไม่ถูกต้อง กรุณาเริ่มใหม่จากหน้านี้ อย่ากดจากลิงก์ที่คนอื่นส่งมา",
  verify: "ยืนยันตัวตนกับ LINE ไม่สำเร็จ กรุณาลองใหม่",
  toomany: "ลองหลายครั้งเกินไป กรุณารอสักครู่แล้วค่อยลองใหม่",
  nolink:
    "บัญชี LINE นี้ยังไม่ได้ผูกกับเจ้าหน้าที่คนไหน — เข้าด้วยชื่อผู้ใช้และรหัสผ่านก่อน แล้วไปผูกที่เมนู “บัญชีของฉัน”",
};

/** โลโก้ LINE — ฝังไว้ในหน้าเลย ไม่ต้องโหลดไฟล์จากข้างนอก */
function LineMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5" fill="currentColor">
      <path d="M12 2C6.5 2 2 5.6 2 10.1c0 4 3.6 7.4 8.4 8 .3.07.8.22.9.5.1.26.07.66.03.92l-.14.87c-.05.26-.2 1.02.9.56 1.1-.46 5.9-3.48 8.05-5.96C21.6 13.3 22 11.8 22 10.1 22 5.6 17.5 2 12 2ZM8.2 12.9h-2a.53.53 0 0 1-.53-.53V8.3a.53.53 0 0 1 1.06 0v3.54H8.2a.53.53 0 0 1 0 1.06Zm2.07-.53a.53.53 0 0 1-1.06 0V8.3a.53.53 0 0 1 1.06 0v4.07Zm4.75 0a.53.53 0 0 1-.95.32l-2.08-2.83v2.51a.53.53 0 0 1-1.06 0V8.3a.53.53 0 0 1 .95-.32l2.09 2.84V8.3a.53.53 0 0 1 1.05 0v4.07Zm3.2-2.57a.53.53 0 0 1 0 1.06h-1.48v.95h1.48a.53.53 0 0 1 0 1.06h-2a.53.53 0 0 1-.54-.53V8.3a.53.53 0 0 1 .53-.53h2a.53.53 0 0 1 0 1.06h-1.47v.94h1.47Z" />
    </svg>
  );
}

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
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#06C755] px-4 py-3 font-medium text-white transition hover:bg-[#05b34c]"
            >
              <LineMark />
              เข้าสู่ระบบด้วย LINE
            </a>

            <div className="mt-6 flex items-center gap-3">
              <span className="h-px flex-1 bg-gray-200" />
              <span className="text-xs text-gray-400">เข้าครั้งแรก ยังไม่ได้ผูก LINE</span>
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
            className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 font-medium transition disabled:opacity-60 ${
              lineReady
                ? "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                : "bg-brand-600 text-white hover:bg-brand-700"
            }`}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
            เข้าสู่ระบบ
          </button>
        </form>

        {lineReady && (
          <p className="mt-4 text-center text-xs leading-relaxed text-gray-400">
            เข้าด้วยรหัสผ่านได้ครั้งแรกเท่านั้น
            <br />
            เข้าแล้วไปผูก LINE ที่เมนู “บัญชีของฉัน”
          </p>
        )}
      </div>
    </main>
  );
}
