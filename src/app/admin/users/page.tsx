import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import UsersManager from "@/components/admin/UsersManager";

export default async function AdminUsersPage() {
  const me = await currentUser();
  if (!me) redirect("/admin/");
  if (me.role !== "ADMIN") redirect("/admin/");

  const users = await db.user.findMany({
    orderBy: { username: "asc" },
    select: {
      id: true,
      username: true,
      name: true,
      phone: true,
      role: true,
      active: true,
      lastLoginAt: true,
    },
  });

  return (
    <>
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3">
          <Link href="/admin/" className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <p className="font-semibold text-gray-800">ผู้ใช้งาน</p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-5">
        <UsersManager
          meId={me.id}
          users={users.map((u) => ({
            ...u,
            lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
          }))}
        />
      </main>
    </>
  );
}
