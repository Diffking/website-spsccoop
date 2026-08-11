import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { currentUser } from "@/lib/auth";
import { getSplash } from "@/lib/settings";
import SplashManager from "@/components/admin/SplashManager";

export default async function AdminSplashPage() {
  const user = await currentUser();
  if (!user) redirect("/admin/");

  const content = await getSplash();

  return (
    <>
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3">
          <Link href="/admin/" className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <p className="font-semibold text-gray-800">หน้าวันสำคัญ</p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-5">
        <SplashManager initial={content} />
      </main>
    </>
  );
}
