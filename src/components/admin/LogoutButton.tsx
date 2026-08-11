"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export default function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout/", { method: "POST" });
    router.refresh();
  }

  return (
    <button
      onClick={logout}
      className={
        className ??
        "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
      }
    >
      <LogOut className="h-4 w-4" /> ออกจากระบบ
    </button>
  );
}
