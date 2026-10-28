import { db } from "@/lib/db";

/**
 * บันทึกเหตุการณ์ด้านความปลอดภัย — หน้า "ความปลอดภัย" ในหลังบ้าน (/admin/security) อ่านจากตารางนี้
 * (เจ้าของเว็บขอ 27 ต.ค. 2569 · เดิมตัวนับการลองผิดอยู่ในหน่วยความจำอย่างเดียว รีสตาร์ตแล้วหายหมด)
 *
 * ⚠️ ห้ามบันทึกรหัสผ่าน · body ที่ส่งมา · เบอร์โทร — เก็บแค่ชนิด ชื่อที่พิมพ์ ไอพี และหมายเหตุสั้น ๆ
 * ⚠️ บันทึกพลาดต้องไม่ทำให้การล็อกอินพัง — ทุกทางกลืน error เงียบ ๆ (await ได้ แต่ไม่ throw)
 */

export type SecurityKind =
  | "login_ok"
  | "login_fail"
  | "login_locked"
  | "line_ok"
  | "line_fail"
  | "survey_blocked"
  | "eval_bad_sig"
  | "eval_rejected"
  | "eval_ok";

export const KIND_LABEL: Record<SecurityKind, string> = {
  login_ok: "เข้าสู่ระบบสำเร็จ",
  login_fail: "รหัสผ่านผิด",
  login_locked: "ถูกล็อก 15 นาที",
  line_ok: "เข้าด้วย LINE สำเร็จ",
  line_fail: "เข้าด้วย LINE ไม่สำเร็จ",
  survey_blocked: "แบบประเมิน: ถูกกันไล่สุ่ม",
  eval_bad_sig: "ทะเบียนสมาชิก: ลายเซ็นผิด",
  eval_rejected: "ทะเบียนสมาชิก: ข้อมูลถูกปฏิเสธ",
  eval_ok: "ทะเบียนสมาชิก: รับแล้ว",
};

const KEEP_DAYS = 90;
let lastPrune = 0;

/** ไอพีจากหัวคำขอ — ลำดับเดียวกับตัวกันเดารหัสของหน้าล็อกอิน */
export function requestIp(request: Request): string {
  return (
    request.headers.get("x-visitor-ip") ??
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    "unknown"
  );
}

export async function logSecurity(
  kind: SecurityKind,
  info: { username?: string | null; ip?: string | null; note?: string | null } = {},
): Promise<void> {
  try {
    await db.securityEvent.create({
      data: {
        kind,
        username: info.username?.slice(0, 80) || null,
        ip: info.ip?.slice(0, 64) || null,
        note: info.note?.slice(0, 200) || null,
      },
    });
    // เก็บกวาดของเก่าวันละครั้งพอ — ไม่ต้องตั้งงานแยก
    if (Date.now() - lastPrune > 86_400_000) {
      lastPrune = Date.now();
      await db.securityEvent.deleteMany({ where: { at: { lt: new Date(Date.now() - KEEP_DAYS * 86_400_000) } } });
    }
  } catch (e) {
    console.error("บันทึกเหตุการณ์ความปลอดภัยไม่สำเร็จ:", e instanceof Error ? e.message : "unknown");
  }
}
