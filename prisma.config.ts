import { existsSync } from "node:fs";
import { defineConfig } from "prisma/config";

// Prisma 7 ไม่อ่าน .env ให้เองแล้ว และย้าย datasource.url ออกจาก schema.prisma มาไว้ที่นี่
if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL,
  },
  migrations: {
    seed: "npx tsx prisma/seed.ts",
  },
});
