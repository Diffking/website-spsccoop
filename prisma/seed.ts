/**
 * ข้อมูลตั้งต้น — รันซ้ำได้ ไม่สร้างซ้ำ
 *   npx prisma db seed
 *
 * สร้างผู้ใช้หลังบ้านคนแรก (รหัส 07337) ถ้ายังไม่มี
 * ตั้งรหัสผ่านเองได้ด้วย SEED_ADMIN_PASSWORD ถ้าไม่ตั้งจะสุ่มให้แล้วพิมพ์ออกมา
 */

import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

const db = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL!) });

async function main() {
  const username = "07337";
  const existing = await db.user.findUnique({ where: { username } });

  if (existing) {
    console.log(`ผู้ใช้ ${username} มีอยู่แล้ว — ข้าม`);
  } else {
    const password = process.env.SEED_ADMIN_PASSWORD || randomBytes(6).toString("base64url");
    await db.user.create({
      data: {
        username,
        name: "ผู้ดูแลระบบ",
        passwordHash: await bcrypt.hash(password, 12),
        role: "ADMIN",
      },
    });
    console.log("─".repeat(48));
    console.log(`สร้างผู้ใช้หลังบ้านแล้ว`);
    console.log(`  ชื่อผู้ใช้ : ${username}`);
    console.log(`  รหัสผ่าน  : ${password}`);
    console.log("  ⚠️ เปลี่ยนรหัสผ่านทันทีหลังเข้าใช้ครั้งแรก");
    console.log("─".repeat(48));
  }

  // ข่าววิ่ง + ประกาศตั้งต้น — ถอดจากเนื้อหาที่อยู่บนหน้าเว็บตอนนี้ ให้หลังบ้านมีของให้แก้
  if ((await db.newsTicker.count()) === 0) {
    await db.newsTicker.createMany({
      data: [
        { text: "ปรับหลักเกณฑ์การสงเคราะห์สมาชิกผู้เสียชีวิต", sortOrder: 1 },
        { text: "ประกาศที่ 18/2569 อัตราดอกเบี้ยเงินฝากออมทรัพย์พิเศษฉบับใหม่", sortOrder: 2 },
        { text: "ประกาศที่ 17/2569 กำหนดการประชุมใหญ่สามัญประจำปี 2569", sortOrder: 3 },
      ],
    });
    console.log("เพิ่มข่าววิ่งตั้งต้น 3 รายการ");
  }

  if ((await db.announcement.count()) === 0) {
    await db.announcement.createMany({
      data: [
        { number: "19/2569", title: "จ่ายเงินสวัสดิการสงเคราะห์สมาชิกผู้เสียชีวิต", publishedAt: new Date("2026-06-30") },
        { number: "18/2569", title: "อัตราดอกเบี้ยเงินฝากออมทรัพย์พิเศษฉบับใหม่", publishedAt: new Date("2026-06-25") },
        { number: "17/2569", title: "กำหนดการประชุมใหญ่สามัญประจำปี 2569", publishedAt: new Date("2026-06-22") },
        { number: "16/2569", title: "หลักเกณฑ์การให้เงินกู้สามัญเพื่อการศึกษาบุตร", publishedAt: new Date("2026-06-19") },
        { number: "15/2569", title: "วันหยุดทำการของสหกรณ์ประจำเดือนกรกฎาคม", publishedAt: new Date("2026-06-15") },
      ],
    });
    console.log("เพิ่มประกาศตั้งต้น 5 รายการ");
  }
}

main()
  .then(() => db.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await db.$disconnect();
    process.exit(1);
  });
