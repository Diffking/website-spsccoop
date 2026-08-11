import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import TickerManager from "@/components/admin/TickerManager";

export default async function AdminTickerPage() {
  const user = await currentUser();
  if (!user) redirect("/admin/");

  const tickers = await db.newsTicker.findMany({ orderBy: { sortOrder: "asc" } });

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-1 text-xl font-bold text-gray-800">ข่าววิ่ง</h1>
      <p className="mb-5 text-sm text-gray-500">ข้อความที่วิ่งอยู่บนแถบใต้แบนเนอร์</p>

      <TickerManager
        items={tickers.map((t) => ({ id: t.id, text: t.text, published: t.published }))}
      />
    </main>
  );
}
