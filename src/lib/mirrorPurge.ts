/**
 * บอกตัวมิเรอร์ฝั่งโฮสต์ให้ทิ้งสำเนาเก่า หลังเจ้าหน้าที่กดบันทึก
 *
 * หน้าเว็บที่สมาชิกเห็นคือ "สำเนา" ที่ PHP บนโฮสต์เก็บไว้ ไม่ใช่ของสดจากเครื่องนี้
 * ถ้าไม่บอกอะไรเลย ของใหม่จะขึ้นก็ต่อเมื่อสำเนาหมดอายุ (ราว 5 นาที) — เจ้าหน้าที่กดบันทึก
 * แล้วเปิดดูจะยังเห็นของเก่า แล้วเข้าใจว่าบันทึกไม่ติด
 *
 * ตั้ง MIRROR_PURGE_URL กับ MIRROR_PURGE_TOKEN ใน .env ถึงจะทำงาน ไม่ตั้ง = ข้ามไปเงียบ ๆ
 * (ตอนพัฒนาในเครื่องไม่มีตัวมิเรอร์ ไม่ควรมีอะไรพังเพราะเรื่องนี้)
 *
 * **ห้ามทำให้การบันทึกพัง** — ยิงแล้วไม่รอผล โฮสต์ล่มหรือรหัสผิดก็แค่สำเนาเก่าค้างอยู่
 * จนหมดอายุเอง ซึ่งแย่กว่าเดิมนิดเดียว แต่ถ้าไปทำให้ปุ่มบันทึกพังคือแย่กว่ามาก
 */

type PurgeBody = { token: string; paths?: string[]; all?: true };

async function tell(body: PurgeBody): Promise<void> {
  const url = process.env.MIRROR_PURGE_URL;
  const token = process.env.MIRROR_PURGE_TOKEN;
  if (!url || !token) return;

  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, token }),
      signal: AbortSignal.timeout(4000),
    });
  } catch {
    // เงียบไว้ตั้งใจ — ดูสาเหตุได้จาก log ของโฮสต์ ไม่ใช่เรื่องที่เจ้าหน้าที่ต้องมารับรู้
  }
}

/** ล้างสำเนาเฉพาะหน้าที่ระบุ — ใช้ตอนแก้เนื้อหาหน้าเดียว */
export function purgePaths(paths: string[]): void {
  const clean = paths.filter((p) => p.startsWith("/"));
  if (clean.length === 0) return;
  void tell({ token: "", paths: clean });
}

/**
 * ล้างสำเนาหน้าเว็บทั้งเว็บ — ใช้ตอนแก้ของที่โผล่ทุกหน้า (เมนู หัวเว็บ ท้ายเว็บ ค่าตั้ง)
 * รูปกับไฟล์แนบไม่ถูกลบ ตัวมิเรอร์เก็บไว้เหมือนเดิม
 */
export function purgeEverySite(): void {
  void tell({ token: "", all: true });
}
