import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getCalendarEventsForAdmin } from "@/lib/homeItems";
import CalendarEventsManager from "@/components/admin/CalendarEventsManager";

export default async function Page() {
  const user = await currentUser();
  if (!user) redirect("/admin/");

  const items = await getCalendarEventsForAdmin();

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-1 text-xl font-bold text-gray-800">ปฏิทินสหกรณ์</h1>
      <p className="mb-5 text-sm text-gray-500">กิจกรรมที่ขึ้นบนปฏิทินหน้าแรก</p>

      <CalendarEventsManager items={items} />
    </main>
  );
}
