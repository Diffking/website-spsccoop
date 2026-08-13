import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getItemsForAdmin } from "@/lib/homeItems";
import { getOfficeHours, getSiteInfo } from "@/lib/settings";
import SiteInfoForm from "@/components/admin/SiteInfoForm";
import OfficeHoursForm from "@/components/admin/OfficeHoursForm";
import HomeItemsManager from "@/components/admin/HomeItemsManager";

export default async function AdminFooterPage() {
  const user = await currentUser();
  if (!user) redirect("/admin/");

  const [siteInfo, links, hours] = await Promise.all([
    getSiteInfo(),
    getItemsForAdmin("footerLinks"),
    getOfficeHours(),
  ]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="mb-1 text-xl font-bold text-gray-800">ส่วนท้ายเว็บ</h1>
      <p className="mb-5 text-sm text-gray-500">
        ข้อมูลติดต่อ วันเวลาทำการ และลิงก์หน่วยงานที่ขึ้นท้ายทุกหน้า
      </p>

      <div className="space-y-6">
        {/* การ์ดนี้มีหัวข้อของตัวเองอยู่แล้ว ไม่ต้องใส่ซ้ำ */}
        <SiteInfoForm initial={siteInfo} />

        <OfficeHoursForm initial={hours} />

        <section>
          <h2 className="mb-2 text-sm font-semibold text-gray-700">ลิงก์หน่วยงานสนับสนุนกำกับดูแล</h2>
          <HomeItemsManager
            section="footerLinks"
            items={links}
            fields={["href"]}
            titleLabel="ชื่อหน่วยงาน"
          />
        </section>
      </div>
    </main>
  );
}
