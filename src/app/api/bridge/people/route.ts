import { NextResponse } from "next/server";
import { BRIDGE_HEADERS, noteRead, requireBridge } from "@/lib/bridgeGuard";
import { BRIDGE_NAME, BRIDGE_VERSION, getDirectory, siteBase } from "@/lib/coopBridge";

/**
 * ทำเนียบบุคลากรทั้งหมด — คณะกรรมการดำเนินการ · ผู้ตรวจสอบกิจการ · คณะกรรมการสรรหา ·
 * ที่ปรึกษา · เจ้าหน้าที่ ตามที่เผยแพร่อยู่บนเว็บจริงตอนนี้
 *
 * เลือกเฉพาะบางกลุ่มได้ด้วย `?group=board45` (คั่นด้วยจุลภาคได้หลายกลุ่ม)
 * เอาเฉพาะประเภทได้ด้วย `?kind=board,staff`
 *
 * ⚠️ เรียงตามที่วางไว้บนหน้าเว็บจริงเสมอ — ทำเนียบเรียงตามลำดับตำแหน่ง
 * (ประธาน → รองประธาน → กรรมการ) ถ้าเอาไปเรียงใหม่ตามชื่อจะผิดความหมายทันที
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireBridge(request);
  if (auth instanceof NextResponse) return auth;

  const url = new URL(request.url);
  const wanted = (name: string) =>
    (url.searchParams.get(name) ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

  const keys = wanted("group");
  const kinds = wanted("kind");

  let groups = await getDirectory(auth.config);
  if (keys.length > 0) groups = groups.filter((g) => keys.includes(g.key));
  if (kinds.length > 0) groups = groups.filter((g) => kinds.includes(g.kind));

  await noteRead("people", auth.ip);

  return NextResponse.json(
    {
      service: BRIDGE_NAME,
      version: BRIDGE_VERSION,
      dataset: "people",
      site: siteBase(),
      generatedAt: new Date().toISOString(),
      count: groups.reduce((sum, g) => sum + g.count, 0),
      needsReview: groups.reduce((sum, g) => sum + g.needsReview, 0),
      groups,
    },
    { headers: BRIDGE_HEADERS },
  );
}
