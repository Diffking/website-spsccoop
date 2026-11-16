import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { ADMIN_HOME, canArea } from "@/lib/permissions";
import { db } from "@/lib/db";
import { roundStatus } from "@/lib/objection";
import { ObjectionRounds } from "@/components/admin/ObjectionAdmin";

export default async function Page() {
  const user = await currentUser();
  if (!user) redirect("/login/");
  if (!canArea(user, "objections")) redirect(ADMIN_HOME);

  const rounds = await db.objectionRound.findMany({
    orderBy: { year: "desc" },
    include: { _count: { select: { objections: true } } },
  });

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-1 text-xl font-bold text-gray-800">คำทักท้วงรายงานประชุมใหญ่</h1>
      <p className="mb-5 text-sm text-gray-500">
        สมาชิกส่งคำทักท้วงที่หน้า /point-order/ · แยกเป็นรอบตามปี · หน้าเว็บโชว์รอบที่เปิดรับอยู่
      </p>
      <ObjectionRounds
        rounds={rounds.map((r) => ({
          id: r.id,
          year: r.year,
          title: r.title,
          opensAt: r.opensAt.toISOString(),
          closesAt: r.closesAt.toISOString(),
          status: roundStatus(r),
          count: r._count.objections,
        }))}
      />
    </main>
  );
}
