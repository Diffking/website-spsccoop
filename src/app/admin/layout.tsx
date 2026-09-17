import type { Metadata } from "next";
import { currentView } from "@/lib/auth";
import Sidebar from "@/components/admin/Sidebar";
import ViewAsBar from "@/components/admin/ViewAsBar";
import LineNudge from "@/components/admin/LineNudge";
import { publicSiteUrl } from "@/lib/siteUrl";
import { lineReady } from "@/lib/line";
import { db } from "@/lib/db";

export const metadata: Metadata = {
  title: "หลังบ้าน",
  robots: { index: false, follow: false },
};

// หลังบ้านต้องอ่านสถานะล็อกอินสดทุกครั้ง ห้าม cache
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const view = await currentView();

  // ยังไม่ล็อกอิน = มีแต่หน้าเข้าสู่ระบบ ไม่ต้องมีเมนู
  if (!view) {
    return <div className="min-h-screen bg-gray-50">{children}</div>;
  }

  const { user, real, viewing } = view;

  /*
   * ทวงให้ผูก LINE — ดูจาก **คนที่ล็อกอินจริง** (real) ไม่ใช่คนที่ถูกสวมมุมมอง
   * ไม่งั้น ADMIN ที่เปิดมุมมองผู้ใช้อื่นอยู่จะโดนทวงแทนเขา ทั้งที่กดผูกให้ไม่ได้
   * (มุมมองผู้ใช้เขียนอะไรไม่ได้เลย) จึงไม่ขึ้นตอน viewing
   *
   * ไม่ได้ตั้งค่า LINE ไว้ = ไม่ขึ้นเลย หลักเดียวกับที่ปุ่ม LINE ถูกซ่อนไปทั้งระบบ
   */
  const askLine =
    !viewing &&
    lineReady() &&
    !(
      await db.user
        .findUnique({ where: { id: real.id }, select: { lineUserId: true } })
        .catch(() => null)
    )?.lineUserId;

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar
        role={user.role}
        areas={user.areas}
        userName={user.name}
        userCode={user.username}
        siteUrl={publicSiteUrl()}
      />
      <div className="md:pl-64">
        {viewing && <ViewAsBar name={user.name} code={user.username} realName={real.name} />}
        {/* อยู่นอก .view-only ข้างล่าง — ไม่งั้นปุ่มผูกจะถูกปิดไปด้วยตอนเปิดมุมมองผู้ใช้ */}
        {askLine && <LineNudge />}
        {/*
         * มุมมองผู้ใช้ = ดูอย่างเดียว — คลาสนี้ปิดปุ่มและช่องกรอกทั้งหน้าไว้ (ดู globals.css)
         * แต่ลิงก์ยังกดได้ จะได้เดินดูได้ทั่วว่าเจ้าหน้าที่คนนั้นเห็นอะไรบ้าง
         *
         * ตัวกันจริงอยู่ที่ requireWrite() ฝั่ง API — ตรงนี้แค่ทำให้เห็นชัดว่าแตะไม่ได้
         */}
        <div className={viewing ? "view-only" : undefined}>{children}</div>
      </div>
    </div>
  );
}
