"use client";

import { useState, useSyncExternalStore } from "react";
import { AlertTriangle, CheckCircle2, CloudCog, HardDrive, RefreshCw } from "lucide-react";
import type { MirrorStatus } from "@/lib/mirror";

/**
 * สถานะสำเนาหน้าเว็บบนโฮสต์ + ปุ่มสั่งอุ่นเอง
 *
 * สมาชิกอ่านเว็บจากสำเนาที่โฮสต์ของ www.spsccoop.com เก็บไว้ ไม่ใช่จากเครื่องนี้โดยตรง
 * ปกติสำเนาอัปเดตเองอยู่แล้ว (กดบันทึกก็ล้างให้ทันที + มีตัวอุ่นทุกชั่วโมง) แต่เจ้าหน้าที่
 * ควรมองเห็นว่ามันยังทำงานอยู่จริงไหม และสั่งเองได้เมื่อไม่แน่ใจ
 */

const thaiDateTime = new Intl.DateTimeFormat("th-TH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Bangkok",
});

const mb = (bytes: number) => `${(bytes / 1_048_576).toFixed(1)} MB`;

/** "3 นาทีที่แล้ว" อ่านง่ายกว่าเวลาเต็ม เวลาดูว่าระบบยังเดินอยู่ไหม */
function ago(seconds: number): string {
  if (seconds < 90) return `${Math.max(0, Math.round(seconds))} วินาทีที่แล้ว`;
  if (seconds < 5400) return `${Math.round(seconds / 60)} นาทีที่แล้ว`;
  if (seconds < 172_800) return `${Math.round(seconds / 3600)} ชั่วโมงที่แล้ว`;
  return `${Math.round(seconds / 86_400)} วันที่แล้ว`;
}

/*
 * นาฬิกาสำหรับข้อความ "อุ่นล่าสุดเมื่อ ... ที่แล้ว"
 *
 * ฝั่งเซิร์ฟเวอร์คืน null เพราะเวลาที่นั่นกับในเครื่องคนใช้ไม่ตรงกัน ถ้าวาดค่ามาเลย
 * ข้อความจะกระพริบเปลี่ยนตอนหน้าโหลดเสร็จ · ฝั่งเครื่องคนใช้ปัดเป็นช่วงละครึ่งนาที
 * เพื่อให้ค่าที่คืนคงที่ระหว่างการวาดแต่ละรอบ (ไม่งั้น React จะวาดวนไม่หยุด)
 */
function tickEvery30s(onChange: () => void): () => void {
  const timer = setInterval(onChange, 30_000);
  return () => clearInterval(timer);
}

const clientNow = () => Math.floor(Date.now() / 30_000) * 30_000;
const serverNow = () => null;

export default function MirrorPanel({ initial }: { initial: MirrorStatus }) {
  const [status, setStatus] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function warm(force: boolean) {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/mirror/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      const data = (await res.json()) as { ok: boolean; text: string; status: MirrorStatus };
      setResult(data.text);
      setStatus(data.status);
    } catch {
      setResult("สั่งไม่สำเร็จ — ตรวจว่าเครื่องนี้ต่ออินเทอร์เน็ตได้หรือไม่");
    } finally {
      setBusy(false);
    }
  }

  const now = useSyncExternalStore(tickEvery30s, clientNow, serverNow);

  const last = status.last;
  const lastAgo = last && now ? ago(now / 1000 - last.time) : null;
  // อุ่นทุกชั่วโมง ถ้าเกินสองชั่วโมงแล้วยังไม่ขยับ แปลว่ามีอะไรไม่ปกติ
  const stale = !last || (now !== null && now / 1000 - last.time > 7200);
  const failed = last ? last.pages.fail + (last.assets?.fail ?? 0) : 0;

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
            <CloudCog className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-semibold text-gray-800">สำเนาหน้าเว็บบนโฮสต์</h2>
            <p className="mt-0.5 text-xs leading-relaxed text-gray-500">
              สมาชิกอ่านเว็บจากสำเนาที่ www.spsccoop.com เก็บไว้ — ระบบอุ่นสำเนาให้เองทุกชั่วโมง
              และล้างให้ทันทีทุกครั้งที่กดบันทึก
            </p>
          </div>
        </div>

        {status.reachable && !stale ? (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
            <CheckCircle2 className="h-3.5 w-3.5" /> ปกติ
          </span>
        ) : (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
            <AlertTriangle className="h-3.5 w-3.5" /> ต้องตรวจสอบ
          </span>
        )}
      </div>

      {!status.configured ? (
        <p className="mt-4 rounded-xl bg-gray-50 p-3 text-xs leading-relaxed text-gray-600">
          ยังไม่ได้ตั้งค่าตัวมิเรอร์ — ใส่ <code className="font-mono">MIRROR_WARM_URL</code> กับ{" "}
          <code className="font-mono">MIRROR_PURGE_TOKEN</code> ในไฟล์{" "}
          <code className="font-mono">.env</code> ก่อน
        </p>
      ) : (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-gray-50 p-3">
              <p className="text-xs text-gray-500">อุ่นสำเนาล่าสุด</p>
              <p className="mt-1 text-sm font-medium text-gray-800">
                {last ? (lastAgo ?? "เพิ่งอุ่นไป") : "ยังไม่เคยอุ่น"}
              </p>
              {last && (
                <p className="mt-0.5 text-xs text-gray-400">
                  {thaiDateTime.format(new Date(last.time * 1000))} น. · ใช้เวลา {last.seconds}{" "}
                  วินาที
                </p>
              )}
            </div>
            <div className="rounded-xl bg-gray-50 p-3">
              <p className="text-xs text-gray-500">สำเนาที่เก็บไว้</p>
              <p className="mt-1 text-sm font-medium tabular-nums text-gray-800">
                {status.cache
                  ? `${status.cache.pages.toLocaleString("th-TH")} หน้า · ${status.cache.items.toLocaleString("th-TH")} รายการ`
                  : "—"}
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 p-3">
              <p className="text-xs text-gray-500">พื้นที่บนโฮสต์</p>
              <p className="mt-1 flex items-center gap-1.5 text-sm font-medium tabular-nums text-gray-800">
                <HardDrive className="h-4 w-4 text-gray-400" />
                {status.cache ? mb(status.cache.bytes) : "—"}
              </p>
            </div>
          </div>

          {last && (
            <p className="mt-3 text-xs text-gray-500">
              รอบล่าสุด: หน้าเว็บสำเร็จ {last.pages.ok} จาก {last.pages.total} หน้า
              {last.assets && ` · ไฟล์ประกอบสำเร็จ ${last.assets.ok} ข้าม ${last.assets.skip}`}
              {failed > 0 && (
                <span className="font-medium text-amber-700"> · ไม่สำเร็จ {failed} รายการ</span>
              )}
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => warm(false)}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-50"
            >
              <RefreshCw className={busy ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
              {busy ? "กำลังอุ่นสำเนา…" : "อุ่นสำเนาเดี๋ยวนี้"}
            </button>
            <button
              type="button"
              onClick={() => warm(true)}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-200 disabled:opacity-50"
            >
              ดึงใหม่ทั้งหมด
            </button>
          </div>

          <p className="mt-2 text-xs text-gray-400">
            &ldquo;ดึงใหม่ทั้งหมด&rdquo; รวมรูปและไฟล์แนบด้วย ใช้เวลาหลายนาทีและกินเน็ตมาก
            ใช้เมื่อสงสัยว่าสำเนาเพี้ยนเท่านั้น
          </p>

          {result && (
            <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-xl bg-gray-50 p-3 text-xs leading-relaxed text-gray-700">
              {result}
            </pre>
          )}

          {status.error && (
            <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
              ติดต่อโฮสต์ไม่ได้: {status.error} — เว็บที่สมาชิกเห็นยังใช้ได้ตามปกติเพราะเสิร์ฟจากสำเนาเดิม
              แต่เนื้อหาใหม่จะยังไม่ขึ้นจนกว่าจะติดต่อกันได้
            </p>
          )}
        </>
      )}
    </section>
  );
}
