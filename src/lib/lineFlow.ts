/**
 * ค่าที่ต้องจำไว้ระหว่างที่เจ้าหน้าที่ไปกดยินยอมอยู่ที่ฝั่ง LINE
 *
 * เก็บในคุกกี้ httpOnly ตัวเดียว อายุ 10 นาที — ไม่ได้เก็บใน DB เพราะเป็นของชั่วคราว
 * ที่ใช้ครั้งเดียวทิ้ง ถ้าเก็บใน DB ต้องมานั่งเก็บกวาดแถวที่ค้างอีก
 *
 *   s = ค่าแฮชของ state (ของจริงอยู่ในที่อยู่เว็บที่ LINE ส่งกลับมา)
 *   n = nonce ตัวเต็ม (ต้องส่งให้ LINE ตอนตรวจ id_token)
 *   m = ทำอะไรอยู่ — เข้าสู่ระบบ หรือ ผูกบัญชี
 */

export const LINE_FLOW_COOKIE = "spsc_line_flow";

export type LineFlow = { s: string; n: string; m: "login" | "link" };

export function packFlow(flow: LineFlow): string {
  return Buffer.from(JSON.stringify(flow), "utf8").toString("base64url");
}

/** คืน null ถ้าคุกกี้เพี้ยนหรือไม่มี — ให้ปลายทางไล่ออกไปเริ่มใหม่ ไม่ใช่พังทั้งหน้า */
export function unpackFlow(raw: string | undefined): LineFlow | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Partial<LineFlow>;
    if (typeof data.s !== "string" || typeof data.n !== "string") return null;
    if (data.m !== "login" && data.m !== "link") return null;
    return { s: data.s, n: data.n, m: data.m };
  } catch {
    return null;
  }
}
