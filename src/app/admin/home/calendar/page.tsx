import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { ADMIN_HOME, canArea } from "@/lib/permissions";
import { getCalendarEventsForAdmin } from "@/lib/homeItems";
import CalendarEventsManager from "@/components/admin/CalendarEventsManager";
import CalendarImport from "@/components/admin/CalendarImport";
import { officerSourceLabel, officerSourceUrl } from "@/lib/officerEvents";

export default async function Page() {
  const user = await currentUser();
  if (!user) redirect("/login/");
  // ไม่ได้ดูแลส่วนนี้ก็ไม่ต้องเห็น — เมนูซ่อนให้แล้ว ตรงนี้กันคนพิมพ์ที่อยู่เข้ามาเอง
  if (!canArea(user, "home.calendar")) redirect(ADMIN_HOME);

  const items = await getCalendarEventsForAdmin();

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-1 text-xl font-bold text-gray-800">ปฏิทินสหกรณ์</h1>
      <p className="mb-5 text-sm text-gray-500">กิจกรรมที่ขึ้นบนปฏิทินหน้าแรก</p>

      {/* ไม่ได้ตั้ง OFFICER_EVENT_SOURCE_URL ก็ไม่ต้องโชว์ปุ่มที่กดแล้วพังแน่ ๆ */}
      {officerSourceUrl() && <CalendarImport from={officerSourceLabel()} />}

      <CalendarEventsManager items={items} />
    </main>
  );
}
