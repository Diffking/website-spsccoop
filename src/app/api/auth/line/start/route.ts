import { NextResponse, type NextRequest } from "next/server";
import { currentView } from "@/lib/auth";
import { hashToken, lineAuthorizeUrl, lineConfig, randomToken } from "@/lib/line";
import { LINE_FLOW_COOKIE, packFlow } from "@/lib/lineFlow";

/**
 * เริ่มขั้นตอน LINE Login — พาเจ้าหน้าที่ไปหน้ายินยอมของ LINE
 *
 * ใช้สองงานในเส้นทางเดียว แยกด้วย ?mode=
 *   login = เข้าสู่ระบบ (ยังไม่ได้ล็อกอิน)
 *   link  = ผูกบัญชี LINE เข้ากับผู้ใช้ที่ล็อกอินอยู่ (ต้องล็อกอินอยู่แล้วเท่านั้น)
 *
 * ที่ต้องล็อกอินก่อนถึงจะผูกได้ เพราะการผูกคือการ "เพิ่มกุญแจใบใหม่ให้บัญชี"
 * ถ้าปล่อยให้ผูกได้โดยไม่ต้องพิสูจน์ตัวตนก่อน ใครก็เอา LINE ตัวเองมาผูกกับบัญชีคนอื่นได้
 */
export async function GET(request: NextRequest) {
  const cfg = lineConfig();
  if (!cfg) {
    return NextResponse.json({ error: "ยังไม่ได้ตั้งค่า LINE Login" }, { status: 404 });
  }

  const mode = request.nextUrl.searchParams.get("mode") === "link" ? "link" : "login";

  if (mode === "link") {
    const view = await currentView();
    if (!view) {
      return NextResponse.redirect(new URL("/login/", request.url), 303);
    }
    // อยู่ในมุมมองผู้ใช้อื่นอยู่ = ดูได้อย่างเดียว ห้ามผูกบัญชีให้คนที่ถูกสวมมุมมอง
    if (view.viewing) {
      return NextResponse.redirect(new URL("/admin/account/?line=viewonly", request.url), 303);
    }
  }

  const state = randomToken();
  const nonce = randomToken();

  const res = NextResponse.redirect(lineAuthorizeUrl(cfg, state, nonce), 303);
  res.cookies.set(LINE_FLOW_COOKIE, packFlow({ s: hashToken(state), n: nonce, m: mode }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // ต้องเป็น lax ไม่ใช่ strict — ขากลับจาก LINE เป็นการข้ามเว็บมา
    // strict จะไม่ส่งคุกกี้มาด้วย แล้วเทียบ state ไม่ได้เลยสักครั้ง
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
