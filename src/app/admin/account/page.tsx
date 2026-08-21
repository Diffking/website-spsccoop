import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { lineReady } from "@/lib/line";
import LineLinkCard from "@/components/admin/LineLinkCard";
import PasswordForm from "@/components/admin/PasswordForm";

/**
 * บัญชีของฉัน — ผูกบัญชี LINE และตั้งรหัสผ่านของตัวเอง
 *
 * ทุกคนที่เข้าระบบได้เปิดหน้านี้ได้ ไม่ต้องมีพื้นที่รับผิดชอบอะไรเป็นพิเศษ
 * (คนละเรื่องกับเมนู "ผู้ใช้งาน" ที่ ADMIN ใช้จัดการบัญชีคนอื่น)
 *
 * เรียง LINE ไว้ก่อนรหัสผ่านตั้งใจ — LINE คือทางเข้าหลักแล้ว ส่วนรหัสผ่านเหลือไว้
 * เป็นทางเข้าครั้งแรกกับตัวยืนยันตอนจะปลดการผูก
 */
export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ line?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login/");

  const { line } = await searchParams;

  const row = await db.user.findUnique({
    where: { id: user.id },
    select: { ownPassword: true, lineUserId: true, lineLinkedAt: true },
  });

  // จัดรูปแบบวันที่ฝั่งเซิร์ฟเวอร์ ไม่งั้นเครื่องคนอ่านกับเซิร์ฟเวอร์คนละเขตเวลาแล้ววันไม่ตรงกัน
  const linkedAt = row?.lineLinkedAt
    ? new Intl.DateTimeFormat("th-TH", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Bangkok",
      }).format(row.lineLinkedAt)
    : null;

  return (
    <>
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-3">
          <Link href="/admin/" className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <p className="font-semibold text-gray-800">บัญชีของฉัน</p>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 px-4 py-5">
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
          <p className="text-sm text-gray-500">เข้าระบบอยู่ในชื่อ</p>
          <p className="mt-0.5 font-semibold text-gray-800">
            {user.name} <span className="font-mono text-sm text-gray-400">({user.username})</span>
          </p>
        </div>

        <LineLinkCard
          userId={user.id}
          linked={Boolean(row?.lineUserId)}
          linkedAt={linkedAt}
          ready={lineReady()}
          notice={line}
        />

        <PasswordForm userId={user.id} ownPassword={row?.ownPassword ?? false} />
      </main>
    </>
  );
}
