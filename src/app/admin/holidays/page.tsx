import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { ADMIN_HOME, canArea } from "@/lib/permissions";
import { db } from "@/lib/db";
import HolidaysManager from "@/components/admin/HolidaysManager";

export default async function AdminHolidaysPage() {
  const user = await currentUser();
  if (!user) redirect("/admin/");
  // ไม่ได้ดูแลส่วนนี้ก็ไม่ต้องเห็น — เมนูซ่อนให้แล้ว ตรงนี้กันคนพิมพ์ที่อยู่เข้ามาเอง
  if (!canArea(user, "holidays")) redirect(ADMIN_HOME);

  const holidays = await db.holiday.findMany({ orderBy: { date: "asc" } });

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-1 text-xl font-bold text-gray-800">วันหยุด</h1>
      <p className="mb-5 text-sm text-gray-500">วันหยุดทำการของสหกรณ์</p>

      <HolidaysManager
        items={holidays.map((h) => ({
          id: h.id,
          // ตัดเป็นวันที่ตามเวลาไทย ไม่ใช่ UTC ไม่งั้นวันจะเลื่อนไป 1 วัน
          date: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(h.date),
          title: h.title,
          note: h.note,
          published: h.published,
        }))}
      />
    </main>
  );
}
