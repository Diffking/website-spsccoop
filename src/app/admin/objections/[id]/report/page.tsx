import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { ADMIN_HOME, canArea } from "@/lib/permissions";
import { db } from "@/lib/db";
import { agendaLabel, readAgendas, readItems, thaiDate, thaiDateTime } from "@/lib/objection";
import PrintButton from "@/components/admin/PrintButton";

type Params = { params: Promise<{ id: string }> };

/** รายงานคำทักท้วงแยกตามระเบียบวาระ — กดพิมพ์ = PDF (กรอบหลังบ้านซ่อนตอนพิมพ์) */
export default async function Page({ params }: Params) {
  const user = await currentUser();
  if (!user) redirect("/login/");
  if (!canArea(user, "objections")) redirect(ADMIN_HOME);

  const { id } = await params;
  const round = await db.objectionRound.findUnique({ where: { id } });
  if (!round) notFound();
  const agendas = readAgendas(round.agendas);
  const rows = await db.objection.findMany({ where: { roundId: id }, orderBy: { createdAt: "asc" } });
  const all = rows.map((r) => ({ ...r, list: readItems(r.items) }));

  return (
    <main className="mx-auto max-w-4xl bg-white px-6 py-8 text-gray-900 print:max-w-none print:p-0">
      <div className="mb-4 flex justify-end print:hidden">
        <PrintButton />
      </div>
      <h1 className="text-center text-xl font-bold">{round.title}</h1>
      <p className="mt-1 text-center text-sm">
        รับคำทักท้วงตั้งแต่ {thaiDate(round.opensAt)} ถึง {thaiDate(round.closesAt)} · รวม {rows.length} ราย
      </p>
      <p className="text-center text-xs text-gray-500">พิมพ์เมื่อ {thaiDateTime(new Date())}</p>

      {agendas.map((a) => {
        const hit = all.filter((r) => r.list.some((i) => i.no === a.no));
        return (
          <section key={a.no} className="mt-6 break-inside-avoid-page">
            <h2 className="border-b-2 border-gray-800 pb-1 text-base font-bold">
              {agendaLabel(a)} <span className="font-normal">({hit.length} ราย)</span>
            </h2>
            {hit.length === 0 ? (
              <p className="mt-2 text-sm text-gray-500">ไม่มีคำทักท้วง</p>
            ) : (
              <table className="mt-2 w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="w-10 border border-gray-400 px-2 py-1">ที่</th>
                    <th className="w-24 border border-gray-400 px-2 py-1">เลขที่สมาชิก</th>
                    <th className="w-48 border border-gray-400 px-2 py-1">ชื่อ-นามสกุล</th>
                    <th className="border border-gray-400 px-2 py-1">รายละเอียดที่ต้องการแก้ไข</th>
                  </tr>
                </thead>
                <tbody>
                  {hit.map((r, i) => (
                    <tr key={r.id} className="break-inside-avoid align-top">
                      <td className="border border-gray-400 px-2 py-1 text-center">{i + 1}</td>
                      <td className="border border-gray-400 px-2 py-1 text-center">{r.membNo}</td>
                      <td className="border border-gray-400 px-2 py-1">{r.name}</td>
                      <td className="whitespace-pre-line break-words border border-gray-400 px-2 py-1">
                        {r.list.find((x) => x.no === a.no)?.detail}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        );
      })}
    </main>
  );
}
