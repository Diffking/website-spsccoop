import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { currentUser } from "@/lib/auth";
import { ADMIN_HOME, canArea } from "@/lib/permissions";
import { getSetting } from "@/lib/settings";
import { publicSiteUrl } from "@/lib/siteUrl";
import {
  CHECKUP_IMAGES_KEY,
  CHECKUP_INTRO_KEY,
  CHECKUP_LOGO_KEY,
  CHECKUP_QUESTIONS_KEY,
  fillIntro,
  type CheckupImages,
} from "@/lib/programPages";
import { fillQuestions } from "@/lib/financialCheckup";
import ProgramsManager from "@/components/admin/ProgramsManager";

/**
 * หน้าโปรแกรม — ทะเบียนเครื่องมือที่เขียนเป็นโปรแกรมไว้ให้สมาชิกกดใช้
 *
 * หน้านี้ไม่ได้ให้แก้ตัวโปรแกรม (ตัวโปรแกรมเป็นโค้ด) แต่ให้
 *   1. คัดลอกที่อยู่ของโปรแกรมไปวางที่ไหนก็ได้ที่ต้องการ
 *   2. ตั้งค่าของโปรแกรมนั้น — ตอนนี้คือภาพประกอบคำถามของโปรแกรมตรวจสุขภาพการเงิน
 */
export default async function AdminProgramsPage() {
  const user = await currentUser();
  if (!user) redirect("/login/");
  // ไม่ได้ดูแลส่วนนี้ก็ไม่ต้องเห็น — เมนูซ่อนให้แล้ว ตรงนี้กันคนพิมพ์ที่อยู่เข้ามาเอง
  if (!canArea(user, "programs")) redirect(ADMIN_HOME);

  const [images, saved, logo, intro] = await Promise.all([
    getSetting<CheckupImages>(CHECKUP_IMAGES_KEY, {}),
    getSetting<unknown>(CHECKUP_QUESTIONS_KEY, null),
    getSetting<string>(CHECKUP_LOGO_KEY, ""),
    getSetting<unknown>(CHECKUP_INTRO_KEY, null),
  ]);

  return (
    <>
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3">
          <Link href="/admin/" className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <p className="font-semibold text-gray-800">หน้าโปรแกรม</p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-5">
        <ProgramsManager
          initialQuestions={fillQuestions(saved)}
          initialImages={images}
          initialLogo={logo}
          initialIntro={fillIntro(intro)}
          publicBase={publicSiteUrl()}
        />
      </main>
    </>
  );
}
