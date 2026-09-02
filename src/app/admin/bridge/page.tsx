import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { ADMIN_HOME, canArea } from "@/lib/permissions";
import { getBridgeConfig, getBridgeLog, getDirectory, getCalendar, siteBase } from "@/lib/coopBridge";
import { AI_READY } from "@/lib/ai";
import BridgeManager from "@/components/admin/BridgeManager";

/**
 * หลังบ้าน → เชื่อมต่อระบบ — ที่เดียวที่คุมว่าระบบอื่นในสำนักงานเห็นอะไรของเราบ้าง
 *
 * ⚠️ รายชื่อกลุ่มที่โชว์ตรงนี้ต้อง **ไม่กรองตามค่าที่ซ่อนไว้** ไม่งั้นกลุ่มที่ปิดแบ่งปัน
 * จะหายไปจากหน้าจอ แล้วเจ้าหน้าที่จะเปิดกลับไม่ได้เลย — จึงส่ง config ที่ไม่มีรายการซ่อน
 * เข้าไปอ่านทำเนียบ แล้วให้หน้าจอเป็นคนบอกเองว่ากลุ่มไหนกำลังปิดอยู่
 */
export default async function AdminBridgePage() {
  const user = await currentUser();
  if (!user) redirect("/login/");
  if (!canArea(user, "bridge")) redirect(ADMIN_HOME);

  const config = await getBridgeConfig();
  const [groups, events, log] = await Promise.all([
    getDirectory({ ...config, hiddenGroups: [] }),
    getCalendar(),
    getBridgeLog(),
  ]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="mb-1 text-xl font-bold text-gray-800">เชื่อมต่อระบบ</h1>
      <p className="mb-5 text-sm leading-relaxed text-gray-500">
        เปิดให้ระบบอื่นในสำนักงานอ่านข้อมูลทำเนียบบุคลากรและกิจกรรมบนปฏิทินไปใช้ได้
        โดยไม่ต้องพิมพ์ซ้ำสองที่ — แก้ที่เว็บนี้ที่เดียว ระบบปลายทางดึงของใหม่ไปเอง
      </p>

      <BridgeManager
        initial={config}
        groups={groups}
        events={events.length}
        log={log}
        base={siteBase()}
        aiReady={AI_READY}
      />
    </main>
  );
}
