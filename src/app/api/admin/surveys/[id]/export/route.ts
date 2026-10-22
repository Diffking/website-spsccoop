import { NextResponse } from "next/server";
import { requireWrite } from "@/lib/apiAuth";
import { db } from "@/lib/db";
import { HAS_OPTIONS, numberOf, readItems, surveyStatus } from "@/lib/survey";
import { OTHER, type Answers, type CheckboxAnswer, type ChoiceAnswer, type GridAnswer } from "@/lib/surveyAnswers";
import { buildReport, shortTitle } from "@/lib/surveyReport";
import { thaiDateTime } from "@/lib/surveyTime";

type Params = { params: Promise<{ id: string }> };

/** ช่อง CSV — ครอบเครื่องหมายคำพูดเสมอ กันจุลภาค/ขึ้นบรรทัดในคำตอบ */
const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
const line = (cells: unknown[]) => cells.map(cell).join(",");
/** 0812345678 → 081-xxx-5678 */
const maskPhone = (p: string | null) => (p ? p.replace(/^(\d{3})\d{3}(\d{4})$/, "$1-xxx-$2") : "");

/**
 * ส่งออก CSV — Excel เปิดภาษาไทยได้ทันที (ใส่ BOM) ไม่ต้องลงไลบรารี Excel เพิ่มในคอนเทนเนอร์
 *   ?kind=raw      ข้อมูลดิบ คนละแถว (เฉพาะ "ตรวจแล้ว")
 *   ?kind=summary  สรุปแบบรายงาน — ค่าเฉลี่ย S.D. แปลผล การกระจาย
 *   &full=1        เบอร์โทรเต็ม (ค่าตั้งต้นปิดบังบางส่วน)
 *
 * ส่งออกได้หลังปิดรับแล้วเท่านั้น (ตกลงกับเจ้าของเว็บ 22 ต.ค. 2569) — ระหว่างเปิดตัวเลขยังขยับ
 * ใช้ requireWrite เพราะมีข้อมูลส่วนบุคคล — มุมมองผู้ใช้ (ดูอย่างเดียว) ก็ไม่ควรดึงไฟล์ออกไปได้
 */
export async function GET(request: Request, { params }: Params) {
  const auth = await requireWrite("surveys");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const survey = await db.survey.findUnique({ where: { id } });
  if (!survey) return NextResponse.json({ error: "ไม่พบแบบประเมินนี้" }, { status: 404 });
  if (surveyStatus(survey) !== "closed") {
    return NextResponse.json({ error: "ส่งออกได้หลังกด \"สิ้นสุดการประเมิน\" แล้ว" }, { status: 409 });
  }

  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") === "summary" ? "summary" : "raw";
  const full = url.searchParams.get("full") === "1";
  const items = readItems(survey.questions);
  const rows = await db.surveyResponse.findMany({
    where: { surveyId: id, status: "verified" },
    orderBy: { submittedAt: "asc" },
  });

  const lines: string[] = [];
  if (kind === "raw") {
    const cols = items.filter((i) => i.kind !== "section" && !i.hidden);
    const head = ["เลขที่สมาชิก", "ชื่อ-สกุล", "เบอร์โทร", "หน่วยงาน", "วันเวลาที่ส่ง", "ช่องทาง"];
    for (const it of cols) {
      const n = numberOf(items, it.id);
      if (it.kind === "grid") for (const r of it.rows) head.push(`ข้อ ${n} ${shortTitle(it.title)} — ${r.label}`);
      else head.push(`ข้อ ${n} ${it.title}`);
    }
    lines.push(line(head));

    for (const r of rows) {
      const a = (r.answers ?? {}) as Answers;
      const out: unknown[] = [
        r.membNo,
        r.name,
        full ? r.phone : maskPhone(r.phone),
        r.department,
        thaiDateTime(r.submittedAt),
        r.source === "queued" ? "ฝากไว้ตอนระบบไม่พร้อม" : "ยืนยันตัวตนสด",
      ];
      for (const it of cols) {
        const v = a[it.id];
        if (it.kind === "grid") {
          for (const row of it.rows) {
            const col = it.columns.find((c) => c.id === (v as GridAnswer | undefined)?.[row.id]);
            out.push(col ? (col.na ? col.label : col.score) : "");
          }
        } else if (HAS_OPTIONS.includes(it.kind)) {
          const picked = it.kind === "checkbox" ? ((v as CheckboxAnswer | undefined)?.v ?? []) : v ? [(v as ChoiceAnswer).v] : [];
          out.push(
            picked
              .map((pid) => (pid === OTHER ? `อื่น ๆ: ${(v as ChoiceAnswer).other ?? ""}` : (it.options.find((o) => o.id === pid)?.label ?? "")))
              .join(" / "),
          );
        } else {
          out.push(v ?? "");
        }
      }
      lines.push(line(out));
    }
  } else {
    const report = buildReport(
      items,
      rows.map((r) => ({
        answers: (r.answers ?? {}) as Answers,
        submittedAt: r.submittedAt,
        department: r.department,
        profile: (r.profile ?? {}) as Record<string, unknown>,
      })),
    );
    const f = (v: number | null) => (v === null ? "" : v.toFixed(2));
    lines.push(line([survey.title]));
    lines.push(line([`ผู้ตอบที่ตรวจกับทะเบียนสมาชิกแล้ว ${report.n} คน · ปิดรับ ${thaiDateTime(survey.closedAt ?? survey.closesAt)}`]));
    lines.push(line([`ความพึงพอใจเฉลี่ยรวม ${f(report.overall.mean)} · S.D. ${f(report.overall.sd)} · ${report.overall.level ?? ""}`]));
    lines.push("");
    lines.push(line(["ด้าน", "หัวข้อ", "จำนวนผู้ให้คะแนน", "ค่าเฉลี่ย", "S.D.", "แปลผล", "5", "4", "3", "2", "1", "ไม่ประเมิน"]));
    for (const it of report.items) {
      if (it.kind !== "grid") continue;
      const title = shortTitle(it.title);
      for (const r of it.rows) lines.push(line([title, r.label, r.n, f(r.mean), f(r.sd), r.level ?? "", ...r.dist, r.na]));
      lines.push(line([title, "รวมด้าน", it.overall.n, f(it.overall.mean), f(it.overall.sd), it.overall.level ?? ""]));
    }
    lines.push("");
    lines.push(line(["ข้อ", "ตัวเลือก", "จำนวน", "ร้อยละ"]));
    for (const it of report.items) {
      if (it.kind !== "choice") continue;
      for (const o of it.options) lines.push(line([shortTitle(it.title), o.label, o.count, it.respondents ? ((o.count / it.respondents) * 100).toFixed(1) : "0"]));
      if (it.other) lines.push(line([shortTitle(it.title), "อื่น ๆ", it.other.count, it.respondents ? ((it.other.count / it.respondents) * 100).toFixed(1) : "0"]));
    }
  }

  return new NextResponse("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      // ชื่อไฟล์ใน header ต้องเป็น ASCII — ไทยแล้ว throw ByteString (กฎใน AGENTS.md)
      "Content-Disposition": `attachment; filename="survey-${survey.code}-${kind}${full ? "-full" : ""}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
