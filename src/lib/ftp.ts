import { Readable } from "node:stream";
import { Client } from "basic-ftp";

/**
 * ส่งรูปที่อัปจากหลังบ้านขึ้นพื้นที่ FTP ของโดเมน แล้วให้หน้าเว็บใช้ URL ตรงจากที่นั่น
 *
 * ตั้งค่าไม่ครบ = ระบบทำงานเหมือนเดิมทุกอย่าง (เก็บใน uploads/ ของเครื่องนี้)
 * ตั้งครบเมื่อไหร่ค่อยเริ่มส่งขึ้น FTP เอง — ไม่ต้องแก้โค้ด
 *
 * ไฟล์จะถูกเก็บไว้ทั้งสองที่เสมอ: uploads/ ของเราไว้กันโฮสต์เปลี่ยน/หมดอายุ
 * ส่วน URL ที่บันทึกลงฐานจะชี้ไปที่ FTP เมื่อส่งขึ้นสำเร็จ
 */

const HOST = process.env.FTP_HOST?.trim() ?? "";
const USER = process.env.FTP_USER?.trim() ?? "";
const PASSWORD = process.env.FTP_PASSWORD ?? "";
const BASE_DIR = process.env.FTP_BASE_DIR?.trim() ?? "";
const BASE_URL = process.env.ASSETS_BASE_URL?.trim() ?? "";
const PORT = Number(process.env.FTP_PORT ?? 21);
// ค่าเริ่มต้นเป็น FTP ธรรมดาตามที่โฮสต์รองรับ — ตั้ง FTP_SECURE=true ถ้าวันหนึ่งเปิด TLS ได้
const SECURE = process.env.FTP_SECURE?.trim().toLowerCase() === "true";

export const FTP_READY = Boolean(HOST && USER && PASSWORD && BASE_DIR && BASE_URL);

/** ที่เก็บรูปตอนนี้ — ใช้บอกสถานะในหลังบ้าน */
export const storageTarget = (): { kind: "ftp" | "local"; label: string } =>
  FTP_READY
    ? { kind: "ftp", label: BASE_URL }
    : { kind: "local", label: "เก็บในเครื่องนี้ (/uploads)" };

/**
 * อัปไฟล์ขึ้น FTP — คืน URL สาธารณะถ้าสำเร็จ, คืน null ถ้ายังไม่ได้ตั้งค่าหรือส่งไม่สำเร็จ
 * จงใจไม่ throw เพราะการอัปรูปในหลังบ้านต้องไม่พังตามแค่เพราะ FTP ล่ม
 */
export async function uploadToFtp(data: Buffer, filename: string): Promise<string | null> {
  if (!FTP_READY) return null;

  const client = new Client(20_000);
  try {
    await client.access({
      host: HOST,
      port: PORT,
      user: USER,
      password: PASSWORD,
      secure: SECURE,
    });

    // สร้างโฟลเดอร์ปลายทางให้เองถ้ายังไม่มี แล้วเข้าไปอยู่ในนั้น
    await client.ensureDir(BASE_DIR);
    await client.uploadFrom(Readable.from(data), filename);

    return `${BASE_URL.replace(/\/$/, "")}/${filename}`;
  } catch (error) {
    console.error("ส่งไฟล์ขึ้น FTP ไม่สำเร็จ ใช้ไฟล์ในเครื่องแทน:", error);
    return null;
  } finally {
    client.close();
  }
}

/** ทดสอบการเชื่อมต่อจากหลังบ้าน — บอกได้ว่าตั้งค่าถูกไหมโดยไม่ต้องลองอัปจริง */
export async function testFtp(): Promise<{ ok: boolean; message: string }> {
  if (!FTP_READY) {
    return { ok: false, message: "ยังไม่ได้ตั้งค่า FTP ครบใน .env" };
  }

  const client = new Client(15_000);
  try {
    await client.access({ host: HOST, port: PORT, user: USER, password: PASSWORD, secure: SECURE });
    await client.ensureDir(BASE_DIR);
    const list = await client.list();
    return { ok: true, message: `เชื่อมต่อได้ — มีไฟล์ในโฟลเดอร์นี้ ${list.length} รายการ` };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "เชื่อมต่อไม่สำเร็จ" };
  } finally {
    client.close();
  }
}
