import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { requireWrite } from "@/lib/apiAuth";
import { saveSetting } from "@/lib/settings";
import { BRIDGE_CONFIG_KEY, getBridgeConfig, type BridgeConfig } from "@/lib/coopBridge";

/**
 * ตั้งค่า CoopBridge จากหลังบ้าน — เปิด/ปิด · โทเคน · กลุ่มที่แบ่งปัน · ชื่อที่พิมพ์ทับ
 *
 * ⚠️ ทุกคำสั่งอ่านค่าเดิมจากฐานก่อนแล้วค่อยเขียนทับเฉพาะช่องที่ส่งมา
 * ถ้าเขียนทั้งก้อนตรง ๆ การกดบันทึกจากหน้าจอที่เปิดค้างไว้จะลบโทเคนทิ้งโดยไม่ได้ตั้งใจ
 * (เคยเจอกับคลาส no-caption มาแล้ว 25 ส.ค. 2026 — แท็บเก่าเขียนทับของใหม่)
 */

/** โทเคนใหม่ — ยาวพอที่จะเดาไม่ได้ และไม่มีอักขระที่ทำให้ใส่ใน URL แล้วเพี้ยน */
const newToken = () => randomBytes(24).toString("base64url");

function cleanList(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const kept = input
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter(Boolean);
  return [...new Set(kept)];
}

/** เก็บเฉพาะที่พิมพ์ไว้จริง — ช่องที่เว้นว่างไม่ต้องเก็บ จะได้กลับไปใช้ชื่อจากหน้าเว็บเอง */
function cleanOverrides(input: unknown): BridgeConfig["overrides"] {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const out: BridgeConfig["overrides"] = {};

  for (const [id, raw] of Object.entries(input as Record<string, unknown>)) {
    if (!id.trim() || !raw || typeof raw !== "object") continue;
    const value = raw as { name?: unknown; role?: unknown };
    const name = typeof value.name === "string" ? value.name.trim() : "";
    const role = typeof value.role === "string" ? value.role.trim() : "";
    if (!name && !role) continue;
    out[id.trim()] = { ...(name ? { name } : {}), ...(role ? { role } : {}) };
  }
  return out;
}

export async function PUT(request: Request) {
  const auth = await requireWrite("bridge");
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json().catch(() => null)) as Partial<BridgeConfig> | null;
  if (!body) {
    return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
  }

  const current = await getBridgeConfig();
  const next: BridgeConfig = {
    ...current,
    enabled: body.enabled !== false,
    hiddenGroups: cleanList(body.hiddenGroups),
    allowIps: cleanList(body.allowIps),
    overrides: cleanOverrides(body.overrides),
  };

  await saveSetting(BRIDGE_CONFIG_KEY, next);
  return NextResponse.json({ ok: true, hasToken: next.token !== "" });
}

/**
 * สร้างโทเคนใหม่ — ใช้ทั้งตอนเปิดใช้ครั้งแรกและตอนสงสัยว่าโทเคนหลุด
 *
 * ⚠️ ของเดิมใช้ไม่ได้ทันทีที่กด ระบบปลายทางต้องเอาโทเคนใหม่ไปใส่ ไม่งั้นดึงข้อมูลไม่ได้
 * หน้าจอจึงต้องถามยืนยันก่อนเสมอ
 */
export async function POST(request: Request) {
  const auth = await requireWrite("bridge");
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json().catch(() => ({}))) as { action?: string };
  if (body.action !== "newToken") {
    return NextResponse.json({ error: "ไม่รู้จักคำสั่งนี้" }, { status: 400 });
  }

  const current = await getBridgeConfig();
  const token = newToken();
  await saveSetting(BRIDGE_CONFIG_KEY, { ...current, enabled: true, token });

  return NextResponse.json({ ok: true, token });
}
