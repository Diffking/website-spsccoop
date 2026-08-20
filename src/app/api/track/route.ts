import { NextResponse } from "next/server";
import { countedHost, record } from "@/lib/analytics";

/**
 * รับแจ้งการเข้าชมจากหน้าเว็บ (เรียกด้วย JavaScript หลังหน้าโหลดเสร็จ)
 *
 * ที่ไม่นับฝั่งเซิร์ฟเวอร์ตอน render เพราะบอทกับตัวไต่เว็บของ Google จะถูกนับไปด้วย
 * ทำให้ตัวเลขสูงเกินจริง — วิธีนี้นับเฉพาะเบราว์เซอร์ที่รัน JavaScript จริง
 */
/**
 * ชั่วคราว — ลบทิ้งได้เมื่ออัป index.php ตัวใหม่ขึ้นโฮสต์แล้ว
 *
 * index.php ตัวเก่าส่งต่อคำขอนับสถิติโดยไม่บอกอะไรเลยสักหัว ไม่มีแม้แต่ user-agent
 * (เบราว์เซอร์จริงมี user-agent เสมอ) ถ้าไม่ยกเว้นให้ ยอดจะหยุดนับสนิทตั้งแต่วินาทีที่
 * deploy จนถึงวันที่ไฟล์บนโฮสต์ถูกอัป — ระหว่างนั้นยังนับ "จำนวนครั้งที่เปิดหน้า" ได้ตามเดิม
 * ส่วน "จำนวนคน" ยังค้างที่ 1 คนต่อวันเหมือนก่อนแก้ เพราะตัวเก่าไม่ได้ส่งไอพีคนอ่านมา
 */
function fromOldMirror(request: Request): boolean {
  return !request.headers.get("x-public-host") && !request.headers.get("user-agent");
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { path?: string };
  const path = String(body.path ?? "");
  if (!path.startsWith("/")) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  /*
   * นับเฉพาะคนที่เปิดโดเมนสาธารณะ — ตัวมิเรอร์บอกมาทาง x-public-host
   * เปิด coopsmile.org ตรง ๆ (เจ้าหน้าที่ ตัวอุ่นแคช การทดสอบ) ไม่นับ
   * ตอบ 200 เหมือนเดิม หน้าเว็บจะได้ไม่เห็น error ในคอนโซล
   */
  const host = request.headers.get("x-public-host") ?? request.headers.get("host");
  if (!countedHost(host) && !fromOldMirror(request)) {
    return NextResponse.json({ ok: true, counted: false });
  }

  /*
   * ไอพีของคนอ่านจริง
   *
   * คำขอที่มาจากโดเมนสาธารณะเดินทางมาสองต่อ (เบราว์เซอร์ → โฮสต์ → เครื่องนี้)
   * cf-connecting-ip จึงเป็นไอพีของโฮสต์ ไม่ใช่ของคนอ่าน — ถ้าใช้ค่านั้น
   * คนทั้งเว็บจะได้ลายนิ้วมือเดียวกันหมด แล้วยอด "จำนวนคน" จะค้างที่ 1 คนต่อวัน
   * ตัวมิเรอร์จึงส่งไอพีของคนอ่านมาให้ทาง x-visitor-ip
   */
  const ip =
    request.headers.get("x-visitor-ip") ??
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    "unknown";

  await record(path, ip, request.headers.get("user-agent") ?? "unknown");
  return NextResponse.json({ ok: true, counted: true });
}
