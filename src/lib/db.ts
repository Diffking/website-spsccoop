import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * ตัวเชื่อมฐานข้อมูล — Prisma 7 ต้องส่ง adapter เข้าไปเอง (เดิมอ่าน url จาก schema)
 *
 * สร้าง client ตอนถูกเรียกใช้ครั้งแรกเท่านั้น ไม่ใช่ตอนโหลดไฟล์ —
 * เพราะตอน `next build` จะ import ไฟล์นี้เพื่อวิเคราะห์ route ทั้งที่ยังไม่มี
 * DATABASE_URL (ตอน build ใน Docker ไม่มี .env) ถ้าเช็คตอนโหลดไฟล์ build จะพัง
 *
 * ตอน dev ไฟล์นี้ถูกโหลดใหม่ทุกครั้งที่แก้โค้ด ถ้าสร้าง client ใหม่ทุกรอบ
 * connection จะค้างจนเต็ม เลยเก็บไว้ใน globalThis
 */

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function getClient(): PrismaClient {
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("ไม่ได้ตั้งค่า DATABASE_URL");
  }

  const client = new PrismaClient({ adapter: new PrismaPg(connectionString) });
  globalForPrisma.prisma = client;
  return client;
}

export const db = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getClient() as unknown as Record<string | symbol, unknown>;
    const value = client[property];
    return typeof value === "function" ? value.bind(client) : value;
  },
});
