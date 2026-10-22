import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { ADMIN_HOME, canArea } from "@/lib/permissions";
import { db } from "@/lib/db";
import { readItems, surveyStatus, surveyUrl } from "@/lib/survey";
import SurveyEditor from "@/components/admin/SurveyEditor";

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

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <SurveyEditor
        id={survey.id}
        url={surveyUrl(survey.code, process.env.SURVEY_PUBLIC_URL)}
        title={survey.title}
        description={survey.description}
        items={readItems(survey.questions)}
        opensAt={survey.opensAt?.toISOString() ?? null}
        closesAt={survey.closesAt?.toISOString() ?? null}
        closedAt={survey.closedAt?.toISOString() ?? null}
        status={surveyStatus(survey)}
        responses={survey._count.responses}
        updatedAt={survey.updatedAt.toISOString()}
      />
    </main>
  );
}
