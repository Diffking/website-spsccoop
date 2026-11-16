import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { ADMIN_HOME, canArea } from "@/lib/permissions";
import { db } from "@/lib/db";
import { readItems, surveyStatus, surveyUrl } from "@/lib/survey";
import SurveyEditor from "@/components/admin/SurveyEditor";
import { getBrand } from "@/lib/nav";
import { statusCounts } from "@/lib/surveyVerify";
import { localAsset } from "@/lib/assetFallback";

type Params = { params: Promise<{ id: string }> };

export default async function AdminSurveyEditPage({ params }: Params) {
  const user = await currentUser();
  if (!user) redirect("/login/");
  if (!canArea(user, "surveys")) redirect(ADMIN_HOME);

  const { id } = await params;
  const survey = await db.survey.findUnique({
    where: { id },
    include: { _count: { select: { responses: true } } },
  });
  if (!survey) notFound();
  const [brand, counts] = await Promise.all([getBrand(), statusCounts([survey.id])]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <SurveyEditor
        id={survey.id}
        code={survey.code}
        url={surveyUrl(survey.code, process.env.SURVEY_PUBLIC_URL)}
        logoUrl={brand.logoUrl ? localAsset(brand.logoUrl) : null}
        title={survey.title}
        description={survey.description}
        items={readItems(survey.questions)}
        opensAt={survey.opensAt?.toISOString() ?? null}
        closesAt={survey.closesAt?.toISOString() ?? null}
        closedAt={survey.closedAt?.toISOString() ?? null}
        status={surveyStatus(survey)}
        responses={survey._count.responses}
        counts={counts[survey.id]}
        updatedAt={survey.updatedAt.toISOString()}
      />
    </main>
  );
}
