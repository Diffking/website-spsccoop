import { NextResponse, type NextRequest } from "next/server";
import { createSession, currentView, purgeExpiredSessions } from "@/lib/auth";
import { db } from "@/lib/db";
import { hashToken, identityFromCode, lineConfig, redirectWithin, sameToken } from "@/lib/line";
import { LINE_FLOW_COOKIE, unpackFlow } from "@/lib/lineFlow";

/**
 * ขากลับจาก LINE — จุดที่ตัดสินว่าให้เข้าระบบหรือไม่
 *
 * ด่านที่ต้องผ่านให้ครบก่อนจะได้ session ใหม่
 *   1. คุกกี้ของรอบนี้ต้องมี และใช้ได้ครั้งเดียว (ลบทิ้งทันทีที่อ่าน)
 *   2. state ต้องตรงกับที่เราออกไป — กันคนหลอกให้เบราว์เซอร์ยิง code ของคนอื่นเข้ามา
 *   3. code ต้องแลกเป็น id_token ได้ และ id_token ต้องผ่านการตรวจของ LINE (ลายเซ็น ·
 *      วันหมดอายุ · ออกให้ช่องเรา · nonce ตรงรอบ)
 *   4. รหัสผู้ใช้ LINE นั้นต้องมีเจ้าหน้าที่ผูกไว้แล้ว และบัญชียังเปิดใช้งานอยู่
 *
 * ตกด่านไหนก็ไล่กลับไปหน้าเข้าสู่ระบบพร้อมรหัสเหตุผล **ไม่บอกว่าตกเพราะอะไรละเอียด**
 * — คนนอกไม่ควรรู้ว่าบัญชี LINE ไหนผูกกับระบบนี้อยู่บ้าง
 */

/*
 * กันคนยิงรัว — ปกติคนใช้จริงกดไม่กี่ครั้ง ที่ยิงรัวคือคนลองของ
 * นับตามไอพีพอ เพราะขั้นนี้ไม่มีชื่อผู้ใช้ให้เดา (ต่างจากหน้าเข้าสู่ระบบด้วยรหัสผ่าน
 * ที่ต้องนับตามชื่อผู้ใช้ด้วย เพราะหัวคำขอปลอมได้)
 */
const MAX_FAILS = 10;
const LOCK_MS = 15 * 60_000;
const fails = new Map<string, { count: number; firstAt: number }>();

function tooMany(ip: string): boolean {
  const record = fails.get(ip);
  if (!record) return false;
  if (Date.now() - record.firstAt > LOCK_MS) {
    fails.delete(ip);
    return false;
  }
  return record.count >= MAX_FAILS;
}

function noteFail(ip: string): void {
  const now = Date.now();
  for (const [key, record] of fails) {
    if (now - record.firstAt > LOCK_MS) fails.delete(key);
  }
  const record = fails.get(ip);
  if (record && now - record.firstAt <= LOCK_MS) record.count += 1;
  else fails.set(ip, { count: 1, firstAt: now });
}

/** ไล่กลับไปหน้าที่ควรอยู่ พร้อมรหัสเหตุผลให้หน้าจอเอาไปแปลเป็นข้อความไทย */
function back(where: "login" | "account", reason: string) {
  const path = where === "login" ? "/login/" : "/admin/account/";
  const res = redirectWithin(`${path}?line=${reason}`);
  res.cookies.delete(LINE_FLOW_COOKIE);
  return res;
}

export async function GET(request: NextRequest) {
  const cfg = lineConfig();
  if (!cfg) return NextResponse.json({ error: "ยังไม่ได้ตั้งค่า LINE Login" }, { status: 404 });

  const ip =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    "unknown";
  if (tooMany(ip)) return back("login", "toomany");

  const flow = unpackFlow(request.cookies.get(LINE_FLOW_COOKIE)?.value);
  if (!flow) return back("login", "expired");

  const where = flow.m === "link" ? "account" : "login";
  const params = request.nextUrl.searchParams;

  // เจ้าหน้าที่กดยกเลิกที่หน้า LINE — ไม่ใช่ความผิดพลาด ไม่ต้องนับเป็นการยิงรัว
  if (params.get("error")) return back(where, "denied");

  const state = params.get("state") ?? "";
  const code = params.get("code") ?? "";
  if (!state || !code || !sameToken(hashToken(state), flow.s)) {
    noteFail(ip);
    return back(where, "state");
  }

  const identity = await identityFromCode(cfg, code, flow.n);
  if (!identity) {
    noteFail(ip);
    return back(where, "verify");
  }

  if (flow.m === "link") return linkAccount(identity.sub);
  return loginWithLine(identity.sub, ip);
}

/** เข้าสู่ระบบ — บัญชี LINE ต้องเคยถูกผูกไว้แล้วเท่านั้น ไม่มีการสร้างผู้ใช้ใหม่ */
async function loginWithLine(sub: string, ip: string) {
  const user = await db.user.findUnique({ where: { lineUserId: sub } });
  if (!user || !user.active) {
    noteFail(ip);
    return back("login", "nolink");
  }

  await createSession(user.id);
  await purgeExpiredSessions();
  const res = redirectWithin("/admin/");
  res.cookies.delete(LINE_FLOW_COOKIE);
  return res;
}

/** ผูกบัญชี LINE เข้ากับผู้ใช้ที่ล็อกอินอยู่ */
async function linkAccount(sub: string) {
  const view = await currentView();
  if (!view) return back("login", "expired");
  if (view.viewing) return back("account", "viewonly");

  const me = await db.user.findUnique({ where: { id: view.user.id } });
  if (!me) return back("login", "expired");

  // ผูกไว้แล้วต้องยกเลิกก่อน — กันคนที่ยืมเครื่องตอนเจ้าตัวลุกไป
  // แล้วสลับให้เป็น LINE ของตัวเองเงียบ ๆ (เจ้าตัวจะเข้าไม่ได้และไม่รู้ว่าเพราะอะไร)
  if (me.lineUserId && me.lineUserId !== sub) {
    return back("account", "already");
  }

  // บัญชี LINE เดียวผูกได้กับเจ้าหน้าที่คนเดียว ไม่งั้นดูไม่ออกว่าใครทำอะไร
  const taken = await db.user.findUnique({ where: { lineUserId: sub } });
  if (taken && taken.id !== me.id) return back("account", "taken");

  await db.user.update({
    where: { id: me.id },
    data: { lineUserId: sub, lineLinkedAt: new Date() },
  });
  return back("account", "ok");
}
