import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { ADMIN_HOME, canArea } from "@/lib/permissions";
import { getBrand } from "@/lib/nav";
import { memberSourceReady } from "@/lib/memberLookup";
import { verifyResponses } from "@/lib/surveyVerify";
import { drawState, shortHash } from "@/lib/surveyDraw";
import DrawStage from "@/components/admin/DrawStage";

type Params = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

/**
 * จอจับรางวัล — เปิดจากหน้าเตรียมจับรางวัล (แท็บใหม่ ขึ้นโปรเจกเตอร์)
 *
 * เปิดจอ = ตรวจผู้ตอบทุกคนกับทะเบียนสมาชิกซ้ำอีกรอบก่อน (ตกลงไว้: ตรวจซ้ำก่อนจับรางวัล)
 * ใครพ้นสภาพสมาชิกระหว่างนั้นจะตกไปเป็น "ให้เจ้าหน้าที่ดู" แล้วจอจะบอกว่ายังจับไม่ได้
 */
export default async function DrawPage({ params }: Params) {
  const user = await currentUser();
  if (!user) redirect("/login/");
  if (!canArea(user, "surveys")) redirect(ADMIN_HOME);

  const { id } = await params;
  if (await memberSourceReady()) {
    await verifyResponses({ surveyId: id, recheck: true }).catch((e) => console.error("ตรวจซ้ำก่อนจับรางวัลไม่สำเร็จ:", e));
  }
  const state = await drawState(id);
  if (!state) notFound();
  const brand = await getBrand();

  return (
    <DrawStage
      surveyId={id}
      title={state.survey.title}
      coopName={brand.name}
      round={state.round}
      prizes={state.prizes.map((p) => ({ id: p.id, name: p.name, mode: p.mode, quantity: p.quantity, remaining: p.remaining }))}
      poolHash={state.poolHash}
      fingerprint={shortHash(state.poolHash)}
      poolSize={state.pool.length}
      names={state.pool.map((p) => p.name)}
      blockers={state.blockers}
    />
  );
}
