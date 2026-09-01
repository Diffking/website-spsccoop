import { NextResponse } from "next/server";
import { BRIDGE_HEADERS, noteRead, requireBridge } from "@/lib/bridgeGuard";
import {
  BRIDGE_NAME,
  BRIDGE_VERSION,
  getCalendar,
  getDirectory,
  siteBase,
} from "@/lib/coopBridge";

/**
 * หน้าปกของ CoopBridge — เรียกอันนี้ก่อนเพื่อดูว่ามีชุดข้อมูลอะไรให้บ้าง
 *
 * ระบบปลายทางไม่ต้องจำที่อยู่ของทุกชุดไว้ในโค้ดตัวเอง อ่านจากที่นี่แล้วเดินตามลิงก์
 * วันหลังเพิ่มชุดใหม่ก็เห็นเองโดยไม่ต้องแก้อะไรฝั่งโน้น
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireBridge(request);
  if (auth instanceof NextResponse) return auth;

  const [groups, events] = await Promise.all([getDirectory(auth.config), getCalendar()]);
  await noteRead("manifest", auth.ip);

  const base = siteBase();

  return NextResponse.json(
    {
      service: BRIDGE_NAME,
      version: BRIDGE_VERSION,
      site: base,
      generatedAt: new Date().toISOString(),
      datasets: [
        {
          key: "people",
          title: "ทำเนียบบุคลากร",
          url: `${base}/api/bridge/people/`,
          groups: groups.map((g) => ({
            key: g.key,
            kind: g.kind,
            title: g.title,
            count: g.count,
            needsReview: g.needsReview,
            updatedAt: g.updatedAt,
          })),
          count: groups.reduce((sum, g) => sum + g.count, 0),
        },
        {
          key: "calendar",
          title: "กิจกรรมบนปฏิทินสหกรณ์",
          url: `${base}/api/bridge/calendar/`,
          count: events.length,
        },
      ],
      /*
        บอกกติกาไว้ในคำตอบเลย คนที่มาต่อระบบจะได้ไม่ต้องเปิดเอกสารอีกที
        (ยิงมาถึงตรงนี้ได้ = ถือโทเคนถูกอยู่แล้ว ไม่ใช่ความลับกับผู้เรียก)
      */
      notes: {
        auth: "แนบโทเคนมาที่หัวคำขอ x-bridge-token (หรือ Authorization: Bearer …)",
        nameSource:
          "ชื่อคนที่ nameSource = alt คือชื่อที่เดาจากคำบรรยายรูป ยังไม่มีเจ้าหน้าที่ตรวจ",
        readOnly: "ชุดนี้อ่านอย่างเดียว ไม่มีเส้นทางสำหรับเขียนกลับ",
      },
    },
    { headers: BRIDGE_HEADERS },
  );
}
