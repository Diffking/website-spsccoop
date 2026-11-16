"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Wrench } from "lucide-react";

/**
 * สวิตช์ "กำลังอัปเดตข้อมูล" ของการ์ดคณะกรรมการบนหน้าแรก (16 พ.ย. 2569)
 *
 * ปิดไว้ระหว่างเปลี่ยนชุดกรรมการ — แก้ชื่อ อัปรูป จัดลำดับด้านล่างได้ตามปกติ
 * สมาชิกเห็นแค่กล่องแจ้ง จนกว่าจะกดเปิด · บันทึกทันทีที่กด
 */
export default function CommitteeUpdatingSwitch({ initial }: { initial: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function toggle() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/admin/home/", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ committeeUpdating: !on }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      setError("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง");
      return;
    }
    setOn(!on);
    router.refresh();
  }

  return (
    <section className={`rounded-2xl p-4 shadow-sm ring-1 ${on ? "bg-orange-50 ring-orange-200" : "bg-white ring-black/5"}`}>
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
            on ? "bg-orange-100 text-orange-600" : "bg-gray-100 text-gray-400"
          }`}
        >
          <Wrench className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1 text-sm">
          {on ? (
            <>
              <p className="font-semibold text-orange-800">กำลังอัปเดตข้อมูล — หน้าแรกโชว์กล่องแจ้งแทนรายชื่อ</p>
              <p className="text-gray-600">แก้รายชื่อ รูป และลำดับด้านล่างให้เสร็จ แล้วกดเปิดให้สมาชิกเห็น</p>
            </>
          ) : (
            <>
              <p className="font-semibold text-gray-700">การ์ดคณะกรรมการแสดงบนหน้าแรกอยู่</p>
              <p className="text-gray-500">จะเปลี่ยนชุดกรรมการ กดปิดก่อน สมาชิกจะไม่เห็นข้อมูลครึ่ง ๆ กลาง ๆ</p>
            </>
          )}
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void toggle()}
          className={`inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold text-white transition disabled:opacity-50 ${
            on ? "bg-emerald-600 hover:bg-emerald-700" : "bg-orange-500 hover:bg-orange-600"
          }`}
        >
          {on ? "อัปเดตเสร็จแล้ว เปิดให้สมาชิกเห็น" : "ปิดเพื่ออัปเดต"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </section>
  );
}
