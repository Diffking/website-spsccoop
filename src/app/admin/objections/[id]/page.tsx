import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { currentUser } from "@/lib/auth";
import { ADMIN_HOME, canArea } from "@/lib/permissions";
import { db } from "@/lib/db";
import { readItems } from "@/lib/objection";
import { toRoundView } from "@/lib/objectionData";
import { ObjectionRoundEditor } from "@/components/admin/ObjectionAdmin";

type Params = { params: Promise<{ id: string }> };

export default async function Page({ params }: Params) {
  const user = await currentUser();
  if (!user) redirect("/login/");
  if (!canArea(user, "objections")) redirect(ADMIN_HOME);

  const { id } = await params;
  const round = await db.objectionRound.findUnique({ where: { id } });
  if (!round) notFound();
  const rows = await db.objection.findMany({ where: { roundId: id }, orderBy: { createdAt: "desc" } });

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <Link href="/admin/objections/" className="mb-2 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-600">
        <ChevronLeft className="h-4 w-4" /> ทุกปี
      </Link>
      <h1 className="mb-5 text-xl font-bold text-gray-800">{round.title}</h1>
      <ObjectionRoundEditor
        round={toRoundView(round)}
        rows={rows.map((r) => ({
          id: r.id,
          membNo: r.membNo,
          name: r.name,
          items: readItems(r.items),
          createdAt: r.createdAt.toISOString(),
        }))}
      />
    </main>
  );
}
