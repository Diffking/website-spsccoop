import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getTickerEntries } from "@/lib/content";
import { getTickerSettings } from "@/lib/settings";
import TickerSettingsForm from "@/components/admin/TickerSettingsForm";
import TickerManager from "@/components/admin/TickerManager";

export default async function AdminTickerPage() {
  const user = await currentUser();
  if (!user) redirect("/admin/");

  const [settings, preview, tickers] = await Promise.all([
    getTickerSettings(),
    getTickerEntries(),
    db.newsTicker.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-1 text-xl font-bold text-gray-800">ข่าววิ่ง</h1>
      <p className="mb-5 text-sm text-gray-500">แถบข้อความที่วิ่งอยู่ใต้แบนเนอร์หน้าแรก</p>

      <div className="space-y-5">
        <TickerSettingsForm initial={settings} preview={preview} />

        {/* ไม่บังคับ — ใช้ตอนอยากประกาศอะไรที่ไม่ได้อยู่ในรายการประกาศ เช่น แจ้งปิดระบบชั่วคราว */}
        <TickerManager
          items={tickers.map((t) => ({ id: t.id, text: t.text, published: t.published }))}
        />
      </div>
    </main>
  );
}
