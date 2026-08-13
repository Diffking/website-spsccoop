import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getItemsForAdmin } from "@/lib/homeItems";
import HomeItemsManager from "@/components/admin/HomeItemsManager";

export default async function Page() {
  const user = await currentUser();
  if (!user) redirect("/admin/");

  const [cards, features, links] = await Promise.all([
    getItemsForAdmin("recommends"),
    getItemsForAdmin("memberFeatures"),
    getItemsForAdmin("memberLinks"),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-1 text-xl font-bold text-gray-800">สำหรับสมาชิก</h1>
      <p className="mb-5 text-sm text-gray-500">
        ทั้งบล็อกนี้บนหน้าแรก — การ์ดใหญ่ การ์ดคิวอาร์โค้ด/โซเชียล และปุ่มลิงก์
      </p>

      <h2 className="mb-2 text-sm font-semibold text-brand-700">การ์ดใหญ่ 3 ใบ</h2>
      <HomeItemsManager
        section="recommends"
        items={cards}
        fields={["subtitle", "href", "theme"]}
        titleLabel="หัวข้อการ์ด"
      />

      <h2 className="mb-2 mt-8 text-sm font-semibold text-brand-700">
        การ์ดบริการคิวอาร์โค้ดและลิงก์โซเชียลมีเดีย
      </h2>
      <p className="mb-2 text-xs text-gray-500">
        ใช้ทำปุ่มเพิ่มเพื่อนไลน์ หรือลิงก์แฟนเพจก็ได้ — แนบรูปคิวอาร์โค้ดไว้
        การ์ดใบนั้นจะโชว์คิวอาร์ขนาด 200×200 บนหน้าแรกให้สแกนจากจอได้เลย
      </p>
      <HomeItemsManager
        section="memberFeatures"
        items={features}
        fields={["subtitle", "icon", "href", "imageUrl", "theme"]}
        titleLabel="หัวข้อการ์ด"
        fieldLabels={{ imageUrl: "คิวอาร์โค้ด (ไม่ใส่ก็ได้)", theme: "สีการ์ด" }}
      />

      <h2 className="mb-2 mt-8 text-sm font-semibold text-brand-700">แนะนำสมาชิก</h2>
      <p className="mb-2 text-xs text-gray-500">
        ปุ่มในแถบสีฟ้า-เขียวท้ายบล็อก — ใส่ลิงก์เองก็ได้ หรืออัปไฟล์ PDF (เช่น คู่มือสมาชิก)
        แล้วระบบจะเอาที่อยู่ไฟล์ไปใส่ช่องลิงก์ให้เอง
      </p>
      <HomeItemsManager
        section="memberLinks"
        items={links}
        folder="member_docs"
        fields={["icon", "href", "hrefFile"]}
        titleLabel="ชื่อปุ่ม"
        listLabel="แนะนำสมาชิก"
      />
    </main>
  );
}
