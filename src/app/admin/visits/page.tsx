import { redirect } from "next/navigation";
import { BarChart3 } from "lucide-react";
import { currentUser } from "@/lib/auth";
import { ADMIN_HOME } from "@/lib/permissions";
import { VISITOR_MANUAL_KEY, fiscalVisitHistory, parseCount } from "@/lib/analytics";
import { fiscalRangeLabel } from "@/lib/galleryShared";
import { getSetting, getSiteInfo } from "@/lib/settings";
import VisitHistoryTable from "@/components/admin/VisitHistoryTable";

/**
 * สถิติผู้เข้าชมรายปีบัญชี — ADMIN เท่านั้น (เจ้าของเว็บสั่ง 19 พ.ย. 2569)
 * ตัวนับท้ายเว็บนับเฉพาะปีบัญชีปัจจุบัน · หน้านี้เก็บยอดปีปัจจุบัน + 5 ปีย้อนหลัง
 * ปีไหนไม่มีข้อมูลเว้นว่างไว้ ไอทีพิมพ์ยอดเองได้
 */

export const dynamic = "force-dynamic";

const dShort = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Bangkok",
});

export default async function VisitsPage() {
  const user = await currentUser();
  if (!user || user.role !== "ADMIN") redirect(ADMIN_HOME);

  const [manual, info] = await Promise.all([
    getSetting<Record<string, number>>(VISITOR_MANUAL_KEY, {}),
    getSiteInfo(),
  ]);
  const history = await fiscalVisitHistory(manual);
  const current = history[0].year;
  const carriedOver = parseCount(info.visitorCarriedOver);

  const rows = history.map((r) => ({
    year: r.year,
    range: fiscalRangeLabel(r.year),
    current: r.year === current,
    system: r.system,
    // ระบบนับได้ไม่เต็มปี — บอกช่วงที่มีข้อมูลจริง (ปีปัจจุบันบอก "ถึงวันนี้")
    coverage:
      r.firstDay && r.lastDay
        ? `${dShort.format(r.firstDay)} – ${r.year === current ? "ปัจจุบัน" : dShort.format(r.lastDay)}`
        : null,
    manual: r.manual,
  }));

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
          <BarChart3 className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-xl font-bold text-gray-800">สถิติผู้เข้าชมรายปี</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            จำนวนครั้งที่เปิดเว็บไซต์ แยกตามปีบัญชี (1 ต.ค. – 30 ก.ย.) · ตัวนับท้ายเว็บแสดงเฉพาะปีบัญชี {current}{" "}
            และเริ่มนับใหม่เองทุก 1 ต.ค.
          </p>
        </div>
      </header>

      <VisitHistoryTable rows={rows} />

      <section className="space-y-1.5 rounded-2xl bg-white p-5 text-sm text-gray-600 shadow-sm ring-1 ring-black/5">
        <p className="font-semibold text-gray-800">หมายเหตุ</p>
        <p>
          · ระบบนี้เริ่มนับเองตั้งแต่ 11 ส.ค. 2569 — ปีก่อนหน้านั้นไม่มีข้อมูลในระบบ พิมพ์ยอดจากเว็บเดิมเองได้
        </p>
        <p>· ช่อง &quot;ยอดที่กำหนดเอง&quot; มีค่าเมื่อไหร่ จะใช้แทนยอดที่ระบบนับได้ทั้งปี (ไม่บวกกัน) · ลบตัวเลขออก = กลับไปใช้ยอดของระบบ</p>
        <p>· นับเป็น &quot;ครั้ง&quot; ไม่ใช่ &quot;คน&quot; — คนเดิมเปิดเว็บซ้ำก็นับเพิ่ม เหมือนตัวนับของเว็บเดิม</p>
        {carriedOver > 0 && (
          <p>
            · ตัวนับเดิมยกยอดจากเว็บเก่ามา {carriedOver.toLocaleString("th-TH")} ครั้ง (ยอดสะสมหลายปีรวมกัน
            แยกรายปีไม่ได้) — ไม่ได้ใช้คิดแล้ว เก็บไว้เป็นข้อมูลอ้างอิงเท่านั้น
          </p>
        )}
        <p>· ข้อมูลรายวันไม่ถูกลบ ปีที่เก่ากว่า 5 ปีแค่ไม่แสดงในตาราง</p>
      </section>
    </div>
  );
}
