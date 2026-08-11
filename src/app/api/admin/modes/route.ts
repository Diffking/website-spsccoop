import { NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { getComponentModes, saveSetting, type ComponentModes, type UpdateMode } from "@/lib/settings";

const MODES: UpdateMode[] = ["manual", "ai"];

/** บันทึกโหมดอัปเดตของ component — ส่งมาเฉพาะตัวที่เปลี่ยนก็ได้ */
export async function PUT(request: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json().catch(() => ({}))) as Partial<ComponentModes>;
  const current = await getComponentModes();
  const next: ComponentModes = { ...current };

  for (const key of ["slides", "rates"] as const) {
    const value = body[key];
    if (value === undefined) continue;
    if (!MODES.includes(value)) {
      return NextResponse.json({ error: `โหมด "${value}" ไม่ถูกต้อง` }, { status: 400 });
    }
    next[key] = value;
  }

  await saveSetting("componentModes", next);
  return NextResponse.json({ modes: next });
}
