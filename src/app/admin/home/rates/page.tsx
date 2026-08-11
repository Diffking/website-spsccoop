import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getRates } from "@/lib/settings";
import { AI_READY } from "@/lib/ai";
import RatesForm from "@/components/admin/RatesForm";

export default async function AdminRatesPage() {
  const user = await currentUser();
  if (!user) redirect("/admin/");

  const rates = await getRates();

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-1 text-xl font-bold text-gray-800">อัตราดอกเบี้ย</h1>
      <p className="mb-5 text-sm text-gray-500">ตารางเงินฝากและเงินกู้บนหน้าแรก</p>

      <RatesForm initial={rates} aiReady={AI_READY} />
    </main>
  );
}
