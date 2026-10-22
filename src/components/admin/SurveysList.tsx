"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ClipboardCheck,
  Copy,
  FilePlus2,
  LayoutTemplate,
  Loader2,
  Users,
  ChevronRight,
} from "lucide-react";
import { STATUS_LABEL, type SurveyStatus } from "@/lib/survey";
import { thaiDateTime } from "@/lib/surveyTime";

export type SurveyRow = {
  id: string;
  title: string;
  url: string;
  status: SurveyStatus;
  opensAt: string | null;
  closesAt: string | null;
  closedAt: string | null;
  questions: number;
  /** ผู้ตอบที่ตรวจกับฐานสมาชิกแล้ว */
  responses: number;
  toReview: number;
  pending: number;
};

/** สีป้ายสถานะ — ใช้ชุดเดียวกันในหน้าแก้ไข */
export const STATUS_TONE: Record<SurveyStatus, string> = {
  draft: "bg-gray-100 text-gray-600",
  scheduled: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  open: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  closed: "bg-slate-800 text-white",
};

/** ช่วงเวลาเปิดรับเป็นข้อความเดียว */
function period(s: SurveyRow): string {
  if (s.closedAt) return `ปิดเมื่อ ${thaiDateTime(s.closedAt)}`;
  const from = s.opensAt ? thaiDateTime(s.opensAt) : "เปิดทันทีที่เผยแพร่";
  const to = s.closesAt ? thaiDateTime(s.closesAt) : "จนกว่าจะกดปิด";
  return `${from} – ${to}`;
}

export default function SurveysList({
  items,
  templates,
}: {
  items: SurveyRow[];
  templates: { key: string; label: string; hint: string }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function create(body: Record<string, string>, key: string) {
    setBusy(key);
    setError(null);
    const response = await fetch("/api/admin/surveys/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setBusy(null);
      setError(data.error ?? "สร้างแบบประเมินไม่สำเร็จ");
      return;
    }
    // ไปหน้าแก้ไขเลย — สร้างแล้วสิ่งแรกที่ทำคือแก้ชื่อกับคำถาม
    router.push(`/admin/surveys/${data.id}/`);
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <h2 className="font-semibold text-gray-800">สร้างแบบประเมินใหม่</h2>
        <p className="mt-0.5 text-xs text-gray-500">
          สร้างแล้วเป็น &quot;ร่าง&quot; ก่อน ยังไม่มีใครเห็นจนกว่าจะกดเผยแพร่
        </p>

        <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
          {templates.map((t) => (
            <button
              key={t.key}
              onClick={() => create({ template: t.key }, t.key)}
              disabled={busy !== null}
              className="flex items-start gap-3 rounded-xl border border-brand-200 bg-brand-50/60 p-3 text-left transition hover:border-brand-400 hover:bg-brand-50 disabled:opacity-60"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-600 text-white">
                {busy === t.key ? <Loader2 className="h-5 w-5 animate-spin" /> : <LayoutTemplate className="h-5 w-5" />}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-brand-800">{t.label}</span>
                <span className="mt-0.5 block text-xs text-gray-500">{t.hint}</span>
              </span>
            </button>
          ))}
          <button
            onClick={() => create({}, "blank")}
            disabled={busy !== null}
            className="flex items-start gap-3 rounded-xl border border-dashed border-gray-300 p-3 text-left transition hover:border-brand-400 hover:bg-gray-50 disabled:opacity-60"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gray-100 text-gray-500">
              {busy === "blank" ? <Loader2 className="h-5 w-5 animate-spin" /> : <FilePlus2 className="h-5 w-5" />}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-gray-700">แบบประเมินเปล่า</span>
              <span className="mt-0.5 block text-xs text-gray-500">เริ่มจากศูนย์ ตั้งคำถามเองทั้งหมด</span>
            </span>
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <h2 className="font-semibold text-gray-800">
          แบบประเมินทั้งหมด <span className="text-sm font-normal text-gray-400">({items.length})</span>
        </h2>

        {items.length === 0 ? (
          <p className="mt-4 grid place-items-center gap-2 rounded-xl bg-gray-50 py-10 text-center text-sm text-gray-400">
            <ClipboardCheck className="h-6 w-6 text-gray-300" />
            ยังไม่มีแบบประเมิน — สร้างชุดแรกจากด้านบน
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-gray-100">
            {items.map((s) => (
              <li key={s.id} className="flex items-center gap-3 py-3">
                <Link href={`/admin/surveys/${s.id}/`} className="group flex min-w-0 flex-1 items-center gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_TONE[s.status]}`}>
                        {STATUS_LABEL[s.status]}
                      </span>
                      <span className="min-w-0 truncate text-sm font-medium text-gray-800 group-hover:text-brand-700">
                        {s.title}
                      </span>
                    </span>
                    <span className="mt-1 block truncate text-xs text-gray-500">
                      {s.questions} ข้อ · {period(s)}
                    </span>
                  </span>
                  {s.toReview > 0 && (
                    <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-amber-200">
                      รอเจ้าหน้าที่ดู {s.toReview}
                    </span>
                  )}
                  {s.pending > 0 && (
                    <span className="shrink-0 rounded-full bg-sky-50 px-2 py-0.5 text-[11px] text-sky-700 ring-1 ring-sky-200">
                      รอตรวจ {s.pending}
                    </span>
                  )}
                  <span className="inline-flex shrink-0 items-center gap-1 text-sm text-gray-600" title="ผู้ตอบที่ตรวจกับฐานสมาชิกแล้ว">
                    <Users className="h-4 w-4 text-gray-400" />
                    {s.responses.toLocaleString("th-TH")}
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-gray-300 group-hover:text-brand-500" />
                </Link>
                <button
                  onClick={() => create({ copyFrom: s.id }, s.id)}
                  disabled={busy !== null}
                  title="ทำสำเนา — ได้คำถามชุดเดิม เป็นร่างใหม่ ไม่มีคำตอบติดมา"
                  className="shrink-0 rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-brand-600 disabled:opacity-50"
                >
                  {busy === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
