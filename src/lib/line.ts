import { NextResponse } from "next/server";
import { createHash, randomBytes, timingSafeEqual } from "crypto";

/**
 * เข้าสู่ระบบหลังบ้านด้วย LINE Login
 *
 * ทำไมต้องมี — รหัสผ่านตั้งต้นของระบบนี้คือเลข 4 ตัวท้ายเบอร์โทร ซึ่งมีความเป็นไปได้
 * แค่หมื่นแบบ และคนในสำนักงานรู้เบอร์กันหมด · LINE Login ย้ายการพิสูจน์ตัวตนไปอยู่กับ
 * บัญชี LINE ของเจ้าตัว ซึ่งมีรหัสของตัวเอง มีการยืนยันสองชั้น และคนอื่นเดาไม่ได้
 *
 * ลำดับการใช้งานที่ตั้งใจไว้
 *   1. ครั้งแรกเข้าด้วยรหัสผ่านตามปกติ (ทางเข้าเดียวที่มีตอนยังไม่ได้ผูก)
 *   2. เข้าไปที่ บัญชีของฉัน → ผูกบัญชี LINE
 *   3. ครั้งต่อไปกดปุ่ม LINE อย่างเดียว — รหัสผ่านบนโดเมนสาธารณะถูกปิดไปเอง
 *
 * **ไม่เคยสร้างผู้ใช้ใหม่จาก LINE** — เข้าได้เฉพาะบัญชี LINE ที่มีเจ้าหน้าที่ผูกไว้แล้ว
 * ใครก็ตามที่กดเข้ามาโดยไม่เคยผูก จะโดนปฏิเสธเสมอ ไม่ใช่ได้บัญชีใหม่
 */

/**
 * พากลับไปหน้าอื่นในเว็บเดียวกัน — ส่งเป็นที่อยู่แบบสัมพัทธ์ ไม่ใส่ชื่อโดเมน
 *
 * ⚠️ **ห้ามใช้ `new URL(path, request.url)` ใน route handler** — บั๊กจริงที่เจอ 21 ส.ค. 2026
 * `request.url` ในนี้เป็นที่อยู่ที่ตัวเซิร์ฟเวอร์ฟังอยู่ ซึ่งใน Docker คือ `0.0.0.0:3000`
 * ไม่ใช่โดเมนที่เจ้าหน้าที่เปิด · ผลคือกดปุ่ม LINE แล้วเด้งไป `https://0.0.0.0:3000/login/`
 * ซึ่งเปิดไม่ขึ้นเลย (ต่างจาก `src/proxy.ts` ที่เป็น middleware — ตรงนั้น `request.url`
 * เป็นที่อยู่จริงที่คนเปิด ใช้ได้ตามปกติ)
 *
 * ที่อยู่สัมพัทธ์ใน `Location` ใช้ได้ตามมาตรฐาน (RFC 7231) เบราว์เซอร์เติมโดเมนปัจจุบันให้เอง
 * — ไม่ต้องเดาโดเมนจากหัวคำขอ ซึ่งปลอมได้ และไม่ต้องตั้งค่าเพิ่มอีกตัว
 */
export function redirectWithin(path: string): NextResponse {
  return new NextResponse(null, { status: 303, headers: { Location: path } });
}

const AUTHORIZE_URL = "https://access.line.me/oauth2/v2.1/authorize";
const TOKEN_URL = "https://api.line.me/oauth2/v2.1/token";
const VERIFY_URL = "https://api.line.me/oauth2/v2.1/verify";

/** ขอแค่ยืนยันตัวตนกับชื่อ ไม่ขออีเมล (ต้องยื่นขออนุมัติ และเราไม่ได้ใช้) */
const SCOPE = "openid profile";

export type LineConfig = {
  channelId: string;
  channelSecret: string;
  callbackUrl: string;
};

/**
 * ที่อยู่ที่ LINE จะส่งคนกลับมาหลังกดยินยอม
 *
 * ต้องตรงเป๊ะกับที่ใส่ไว้ใน LINE Developers → Channel → LINE Login → Callback URL
 * ผิดแม้แต่ `/` ปิดท้ายก็ถูกปฏิเสธ · ตั้งเองได้ที่ LINE_CALLBACK_URL ไม่งั้นเดาจาก
 * ADMIN_ROOT_HOST (โดเมนหลังบ้าน) ให้ — ห้ามเดาจาก host ของคำขอเด็ดขาด เพราะคนยิง
 * ตั้งหัว Host เองได้ แล้วจะพา LINE ให้ส่ง code ไปเข้าเครื่องของคนอื่น
 *
 * ⚠️ **ปิดท้ายด้วย `/` เสมอ** เพราะ next.config ตั้ง `trailingSlash: true`
 * ที่อยู่ที่ไม่มี `/` จะโดน 308 เด้งไปตัวที่มี `/` อีกทอด — ทำงานได้เหมือนกันแต่เพิ่ม
 * ขั้นตอนเปล่า ๆ · ที่ใส่ใน LINE Developers ก็ต้องมี `/` ปิดท้ายให้ตรงกัน
 */
export function lineCallbackUrl(): string {
  const explicit = process.env.LINE_CALLBACK_URL?.trim();
  if (explicit) return `${explicit.replace(/\/+$/, "")}/`;

  const host = (process.env.ADMIN_ROOT_HOST ?? process.env.ADMIN_HOST ?? "")
    .split(",")[0]
    .trim();
  if (!host) return "";
  return `https://${host}/api/auth/line/callback/`;
}

/** ค่าตั้งครบไหม — ไม่ครบ = ซ่อนปุ่ม LINE ไปเลย ระบบเดิมยังใช้ได้ทุกอย่าง */
export function lineConfig(): LineConfig | null {
  const channelId = process.env.LINE_CHANNEL_ID?.trim();
  const channelSecret = process.env.LINE_CHANNEL_SECRET?.trim();
  const callbackUrl = lineCallbackUrl();
  if (!channelId || !channelSecret || !callbackUrl) return null;
  return { channelId, channelSecret, callbackUrl };
}

export function lineReady(): boolean {
  return lineConfig() !== null;
}

/**
 * ค่าสุ่มสำหรับกันคำขอปลอม
 *
 * `state` กัน CSRF — เก็บไว้ในคุกกี้ฝั่งเรา แล้วเทียบกับที่ LINE ส่งกลับมา
 * ไม่ตรง = มีคนหลอกให้เบราว์เซอร์ของเจ้าหน้าที่ยิง callback ด้วย code ของคนอื่น
 *
 * `nonce` กันเอา id_token เก่ามาใช้ซ้ำ — ฝังไปตอนขอ แล้วต้องโผล่กลับมาใน id_token
 */
export function randomToken(): string {
  return randomBytes(32).toString("base64url");
}

/** เก็บลงคุกกี้เป็นค่าที่แฮชแล้ว ของจริงอยู่ในที่อยู่เว็บ — คุกกี้หลุดก็ปลอม state ไม่ได้ */
export function hashToken(value: string): string {
  return createHash("sha256").update(value).digest("base64url");
}

/** เทียบแบบใช้เวลาคงที่ กันเดาทีละตัวอักษรจากเวลาที่ตอบ */
export function sameToken(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** ที่อยู่หน้ายินยอมของ LINE ที่จะพาเจ้าหน้าที่ไป */
export function lineAuthorizeUrl(cfg: LineConfig, state: string, nonce: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: cfg.channelId,
    redirect_uri: cfg.callbackUrl,
    state,
    scope: SCOPE,
    nonce,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

type TokenResponse = { id_token?: string; error_description?: string; error?: string };

/** เอา code ที่ LINE ส่งกลับมาแลกเป็น id_token */
async function exchangeCode(cfg: LineConfig, code: string): Promise<string | null> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: cfg.callbackUrl,
      client_id: cfg.channelId,
      client_secret: cfg.channelSecret,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  const data = (await res.json().catch(() => ({}))) as TokenResponse;
  if (!res.ok || !data.id_token) {
    console.warn(`[line] แลก code ไม่สำเร็จ: ${data.error ?? res.status} ${data.error_description ?? ""}`);
    return null;
  }
  return data.id_token;
}

type VerifyResponse = { sub?: string; name?: string; nonce?: string; aud?: string; error?: string };

/**
 * ตรวจ id_token ว่าของจริงและออกให้ช่องเราจริง
 *
 * ใช้ปลายทาง verify ของ LINE แทนการถอด JWT เอง — LINE ตรวจลายเซ็น วันหมดอายุ
 * ผู้ออก และ `aud` ให้ครบในคำขอเดียว เขียนเองพลาดง่ายกว่ามาก (ลืมเช็ค aud
 * = ใครเอา id_token จากช่อง LINE ของตัวเองมายิงก็เข้าระบบเราได้)
 *
 * ส่ง nonce ไปด้วยเพื่อให้ LINE ปฏิเสธ token ที่ไม่ได้เกิดจากคำขอรอบนี้
 */
export async function verifyIdToken(
  cfg: LineConfig,
  idToken: string,
  nonce: string,
): Promise<{ sub: string; name: string } | null> {
  const res = await fetch(VERIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id_token: idToken, client_id: cfg.channelId, nonce }),
    signal: AbortSignal.timeout(10_000),
  });

  const data = (await res.json().catch(() => ({}))) as VerifyResponse;
  if (!res.ok || !data.sub) {
    console.warn(`[line] id_token ไม่ผ่านการตรวจ: ${data.error ?? res.status}`);
    return null;
  }

  // กันเหนียวอีกชั้น เผื่อวันหลัง LINE เปลี่ยนพฤติกรรมของปลายทาง verify
  if (data.aud && data.aud !== cfg.channelId) {
    console.warn("[line] id_token ออกให้ช่องอื่น ไม่ใช่ของเรา");
    return null;
  }
  if (data.nonce && data.nonce !== nonce) {
    console.warn("[line] nonce ไม่ตรง — อาจเป็น token เก่าที่เอามาใช้ซ้ำ");
    return null;
  }

  return { sub: data.sub, name: typeof data.name === "string" ? data.name : "" };
}

/** ขั้นตอนทั้งชุด: code → id_token → ตัวตน · คืน null เมื่อไม่ผ่านขั้นไหนก็ตาม */
export async function identityFromCode(
  cfg: LineConfig,
  code: string,
  nonce: string,
): Promise<{ sub: string; name: string } | null> {
  const idToken = await exchangeCode(cfg, code);
  if (!idToken) return null;
  return verifyIdToken(cfg, idToken, nonce);
}
