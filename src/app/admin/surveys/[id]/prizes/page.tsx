import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { currentUser } from "@/lib/auth";
import { ADMIN_HOME, canArea } from "@/lib/permissions";
import { drawState, shortHash } from "@/lib/surveyDraw";
import SurveyPrizesManager from "@/components/admin/SurveyPrizesManager";

type Params = { params: Promise<{ id: string }> };

/** เตรียมจับรางวัล — ตั้งของรางวัล · ดูผู้มีสิทธิ์ · ผลจับ · สละสิทธิ์ · ส่งออก */
export default async function SurveyPrizesPage({ params }: Params) {
  const user = await currentUser();
  if (!user) redirect("/login/");
  if (!canArea(user, "surveys")) redirect(ADMIN_HOME);

  const { id } = await params;
  const state = await drawState(id);
  if (!state) notFound();
  const prizeName = new Map(state.prizes.map((p) => [p.id, p.name]));

  return (
    <main className="mx-auto max-w-4xl space-y-4 px-4 py-6">
      <Link href={`/admin/surveys/${id}/`} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-700">
        <ArrowLeft className="h-4 w-4" /> กลับไปหน้าแบบประเมิน
      </Link>
      <h1 className="text-xl font-bold text-gray-800">จับรางวัล · {state.survey.title}</h1>
      <SurveyPrizesManager
        // บันทึกรางวัลแล้วโหลดใหม่ทั้งก้อน — รางวัลที่เพิ่งสร้างได้รหัสจากฐาน ไม่ค้างเป็นของใหม่ (dirty) ตลอดไป
        key={state.prizes.map((p) => `${p.id}:${p.name}:${p.quantity}:${p.mode}:${p.drawn}`).join("|")}
        surveyId={id}
        prizes={state.prizes.map((p) => ({ id: p.id, name: p.name, quantity: p.quantity, mode: p.mode === "batch" ? "batch" : "one", drawn: p.drawn }))}
        draws={state.draws.map((d) => ({
          id: d.id,
          prizeName: prizeName.get(d.prizeId) ?? "",
          round: d.round,
          membNo: d.membNo,
          name: d.name,
          phone: d.phone,
          department: d.department,
          drawnAt: d.drawnAt.toISOString(),
          pressedBy: d.pressedBy,
          voided: d.voided,
          voidReason: d.voidReason,
        }))}
        blockers={state.blockers}
        poolSize={state.pool.length}
        excluded={state.excluded}
        fingerprint={shortHash(state.poolHash)}
        round={state.round}
      />
    </main>
  );
}
