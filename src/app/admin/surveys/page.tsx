import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { ADMIN_HOME, canArea } from "@/lib/permissions";
import { db } from "@/lib/db";
import { readItems, surveyStatus, surveyUrl } from "@/lib/survey";
import { TEMPLATES } from "@/lib/surveyTemplates";
import SurveysList from "@/components/admin/SurveysList";
import { statusCounts } from "@/lib/surveyVerify";
import { queueKeys } from "@/lib/surveyQueue";
import SurveyQueueSetup from "@/components/admin/SurveyQueueSetup";
import MemberSyncPanel from "@/components/admin/MemberSyncPanel";
import { syncStatus } from "@/lib/memberSync";
import { thaiDateTime } from "@/lib/surveyTime";

export default async function AdminSurveysPage() {
  const user = await currentUser();
  if (!user) redirect("/login/");
  // ไม่ได้ดูแลส่วนนี้ก็ไม่ต้องเห็น — เมนูซ่อนให้แล้ว ตรงนี้กันคนพิมพ์ที่อยู่เข้ามาเอง
  if (!canArea(user, "surveys")) redirect(ADMIN_HOME);

  const surveys = await db.survey.findMany({ orderBy: { createdAt: "desc" } });
  const counts = await statusCounts(surveys.map((s) => s.id));

  // ค่าที่ต้องตั้งเป็น secret ของ Cloudflare Worker (cloudflare/survey-edge/) — เฉพาะ ADMIN (มีโทเคนลับ)
  let snippet: string | null = null;
  if (user.role === "ADMIN") {
    const keys = await queueKeys();
    snippet = [
      "# รันในโฟลเดอร์ cloudflare/survey-edge/ — ระบบถามค่า ให้วางทีละค่า",
      "npx wrangler secret put QUEUE_TOKEN",
      keys.token,
      "",
      "npx wrangler secret put PUBLIC_KEY",
      keys.publicKey.trim(),
    ].join("\n");
  }

  const sync = await syncStatus();
  const received = sync.state ? new Date(sync.state.receivedAt) : null;
  // generated_at ของ sync-agent เป็นเวลาไทยไม่มีโซน ("2026-10-26T08:50:01") — มีโซนมาแล้วก็ไม่เติมซ้ำ
  const genRaw = sync.state?.generatedAt ?? "";
  const generated = genRaw ? new Date(/(Z|[+-]\d\d:?\d\d)$/.test(genRaw) ? genRaw : `${genRaw}+07:00`) : null;

  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="mb-1 text-xl font-bold text-gray-800">แบบประเมิน</h1>
      <p className="mb-5 text-sm text-gray-500">
        ตั้งคำถามความพึงพอใจ แล้วส่งลิงก์ให้สมาชิกตอบ · สมาชิกยืนยันตัวตนด้วยเลขที่สมาชิกคู่กับเบอร์มือถือก่อนตอบ
      </p>

      <div className="mb-4">
        <MemberSyncPanel
          count={sync.count}
          receivedAt={received ? thaiDateTime(received) : null}
          generatedAt={generated && !Number.isNaN(generated.getTime()) ? thaiDateTime(generated) : genRaw || null}
          canClear={user.role === "ADMIN"}
          stale={sync.stale}
          configured={sync.configured}
          endpoint={`${(process.env.PUBLIC_SITE_URL || "https://spsccoop.org").replace(/\/+$/, "")}/api/eval/members/`}
        />
      </div>

      {snippet && (
        <div className="mb-4">
          <SurveyQueueSetup snippet={snippet} />
        </div>
      )}

      <SurveysList
        templates={TEMPLATES.map((t) => ({ key: t.key, label: t.label, hint: t.hint }))}
        items={surveys.map((s) => ({
          id: s.id,
          title: s.title,
          url: surveyUrl(s.code, process.env.SURVEY_PUBLIC_URL),
          status: surveyStatus(s),
          opensAt: s.opensAt?.toISOString() ?? null,
          closesAt: s.closesAt?.toISOString() ?? null,
          closedAt: s.closedAt?.toISOString() ?? null,
          questions: readItems(s.questions).filter((q) => q.kind !== "section" && !q.hidden).length,
          responses: counts[s.id].verified,
          // รายการที่ระบบตรวจไม่ลงตัว รอเจ้าหน้าที่ — โชว์เป็นป้ายเตือนในรายการ
          toReview: counts[s.id].review,
          pending: counts[s.id].pending,
        }))}
      />
    </main>
  );
}
