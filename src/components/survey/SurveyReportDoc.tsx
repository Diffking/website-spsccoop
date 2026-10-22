/**
 * เนื้อรายงานผลแบบประเมินรูปแบบราชการ — ตาราง x̄ · S.D. · ระดับ ตามที่เจ้าของเว็บเลือก (22 ต.ค. 2569)
 * วาดฝั่งเซิร์ฟเวอร์ล้วน ใช้ทั้งหน้ารายงาน PDF ในหลังบ้าน และหน้าลิงก์กรรมการ
 *
 * ไม่มีข้อมูลรายคนเลย — มีแต่ผลรวม · ข้อความที่สมาชิกพิมพ์เองไม่ขึ้น (ขึ้นแค่สรุปกลุ่มที่เจ้าหน้าที่ตรวจแล้ว)
 */

import type { FeedbackGroup } from "@/components/admin/SurveyCharts";
import { shortTitle, type Report } from "@/lib/surveyReport";

const fmt = (v: number | null) => (v === null ? "–" : v.toFixed(2));
const pct = (a: number, b: number) => (b ? ((a / b) * 100).toFixed(2) : "0.00");

const th = "border border-gray-400 bg-gray-100 px-2 py-1.5 text-center font-semibold";
const td = "border border-gray-400 px-2 py-1";

export default function SurveyReportDoc({
  coopName,
  title,
  period,
  report,
  feedback,
}: {
  coopName: string;
  title: string;
  /** "ผลสุดท้าย (ปิดรับคำตอบแล้ว)" หรือ "ผล ณ ... 12:00 น." */
  period: string;
  report: Report;
  feedback: FeedbackGroup[];
}) {
  let tableNo = 0;
  const caption = (text: string) => (
    <p className="mb-1 mt-5 text-[15px] font-semibold text-gray-900">
      ตารางที่ {++tableNo} {text}
    </p>
  );

  return (
    <article className="text-[14px] leading-relaxed text-gray-900">
      <header className="text-center">
        <p className="text-base font-semibold">{coopName}</p>
        <h1 className="mt-1 text-xl font-bold">รายงานผล{title}</h1>
        <p className="mt-1 text-sm text-gray-700">
          {period} · ผู้ตอบที่ตรวจสอบกับทะเบียนสมาชิกแล้ว {report.n.toLocaleString("th-TH")} คน
        </p>
      </header>

      <section className="mt-4 break-inside-avoid rounded border border-gray-300 p-3 text-[13px]">
        <p className="font-semibold">เกณฑ์การแปลผลค่าเฉลี่ย (คะแนนเต็ม 5)</p>
        <p className="mt-1">
          4.51–5.00 = มากที่สุด · 3.51–4.50 = มาก · 2.51–3.50 = ปานกลาง · 1.51–2.50 = น้อย · 1.00–1.50 = น้อยที่สุด
        </p>
        <p className="mt-1 text-gray-600">
          x̄ = ค่าเฉลี่ย · S.D. = ส่วนเบี่ยงเบนมาตรฐาน · ผู้ที่เลือก &quot;ไม่ได้ใช้บริการ / ไม่ทราบ&quot; ไม่นำมาคิดค่าเฉลี่ยในหัวข้อนั้น
        </p>
      </section>

      {/* ---------- สรุปทุกด้าน ---------- */}
      {report.aspects.length > 0 && (
        <div className="break-inside-avoid">
          {caption("สรุปความพึงพอใจภาพรวมรายด้าน")}
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={`${th} w-10`}>ที่</th>
                <th className={th}>ด้าน</th>
                <th className={`${th} w-16`}>x̄</th>
                <th className={`${th} w-16`}>S.D.</th>
                <th className={`${th} w-24`}>ระดับ</th>
              </tr>
            </thead>
            <tbody>
              {report.aspects.map((a, i) => (
                <tr key={a.id}>
                  <td className={`${td} text-center`}>{i + 1}</td>
                  <td className={td}>{a.title}</td>
                  <td className={`${td} text-center tabular-nums`}>{fmt(a.overall.mean)}</td>
                  <td className={`${td} text-center tabular-nums`}>{fmt(a.overall.sd)}</td>
                  <td className={`${td} text-center`}>{a.overall.level ?? "–"}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className={`${td} text-center`} colSpan={2}>
                  รวมทุกด้าน
                </td>
                <td className={`${td} text-center tabular-nums`}>{fmt(report.overall.mean)}</td>
                <td className={`${td} text-center tabular-nums`}>{fmt(report.overall.sd)}</td>
                <td className={`${td} text-center`}>{report.overall.level ?? "–"}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* ---------- รายข้อ ตามลำดับในแบบประเมิน ---------- */}
      {report.items.map((item) => {
        if (item.kind === "choice") {
          const rows = [...item.options.map((o) => ({ label: o.label, count: o.count })), ...(item.other ? [{ label: "อื่น ๆ", count: item.other.count }] : [])];
          return (
            <div key={item.id} className="break-inside-avoid">
              {caption(`${shortTitle(item.title)} (n = ${item.respondents}${item.multi ? " · ตอบได้หลายข้อ" : ""})`)}
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className={th}>รายการ</th>
                    <th className={`${th} w-20`}>จำนวน</th>
                    <th className={`${th} w-20`}>ร้อยละ</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.label}>
                      <td className={td}>{r.label}</td>
                      <td className={`${td} text-center tabular-nums`}>{r.count}</td>
                      <td className={`${td} text-center tabular-nums`}>{pct(r.count, item.respondents)}</td>
                    </tr>
                  ))}
                  {!item.multi && (
                    <tr className="font-semibold">
                      <td className={`${td} text-center`}>รวม</td>
                      <td className={`${td} text-center tabular-nums`}>{item.respondents}</td>
                      <td className={`${td} text-center tabular-nums`}>100.00</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          );
        }
        if (item.kind === "grid") {
          return (
            <div key={item.id} className="break-inside-avoid">
              {caption(`ความพึงพอใจ${shortTitle(item.title)}`)}
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className={`${th} w-10`}>ที่</th>
                    <th className={th}>รายการ</th>
                    <th className={`${th} w-14`}>n</th>
                    <th className={`${th} w-16`}>x̄</th>
                    <th className={`${th} w-16`}>S.D.</th>
                    <th className={`${th} w-24`}>ระดับ</th>
                  </tr>
                </thead>
                <tbody>
                  {item.rows.map((r, i) => (
                    <tr key={r.id}>
                      <td className={`${td} text-center`}>{i + 1}</td>
                      <td className={td}>
                        {r.label}
                        {r.na > 0 && <span className="text-gray-500"> ({item.naLabel ?? "ไม่ประเมิน"} {r.na} คน)</span>}
                      </td>
                      <td className={`${td} text-center tabular-nums`}>{r.n}</td>
                      <td className={`${td} text-center tabular-nums`}>{fmt(r.mean)}</td>
                      <td className={`${td} text-center tabular-nums`}>{fmt(r.sd)}</td>
                      <td className={`${td} text-center`}>{r.level ?? "–"}</td>
                    </tr>
                  ))}
                  <tr className="font-semibold">
                    <td className={`${td} text-center`} colSpan={3}>
                      รวม
                    </td>
                    <td className={`${td} text-center tabular-nums`}>{fmt(item.overall.mean)}</td>
                    <td className={`${td} text-center tabular-nums`}>{fmt(item.overall.sd)}</td>
                    <td className={`${td} text-center`}>{item.overall.level ?? "–"}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          );
        }
        if (item.kind === "scale") {
          return (
            <div key={item.id} className="break-inside-avoid">
              {caption(shortTitle(item.title))}
              <p>
                x̄ = {fmt(item.overall.mean)} · S.D. = {fmt(item.overall.sd)} · {item.overall.level ?? ""} (n = {item.overall.n})
              </p>
            </div>
          );
        }
        return null;
      })}

      {feedback.length > 0 && (
        <div className="break-inside-avoid">
          {caption("ข้อเสนอแนะที่สมาชิกพูดถึงบ่อย (จัดกลุ่มความเห็นที่พูดเรื่องเดียวกัน)")}
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={`${th} w-10`}>ที่</th>
                <th className={th}>ประเด็น</th>
                <th className={`${th} w-20`}>จำนวน (คน)</th>
              </tr>
            </thead>
            <tbody>
              {feedback.map((g, i) => (
                <tr key={i}>
                  <td className={`${td} text-center`}>{i + 1}</td>
                  <td className={td}>{g.topic}</td>
                  <td className={`${td} text-center tabular-nums`}>{g.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}
