/**
 * ด่านของ CoopBridge — ใครถึงจะขอข้อมูลผ่าน `/api/bridge/*` ได้
 *
 * เส้นทางชุดนี้อยู่ **นอก** `/api/admin` ตั้งใจ เพราะ `/api/admin` เปิดได้เฉพาะโดเมน
 * หลังบ้าน (`src/proxy.ts`) ซึ่งระบบอื่นในสำนักงานเรียกไม่ได้ — ด่านจึงเป็น **โทเคน**
 * แทน หลักเดียวกับ `/api/holidays/sync` ที่ตัวตั้งเวลาในวงแลนเรียกเข้ามา
 *
 * ต่างกันตรงที่โทเคนของ CoopBridge เก็บใน **ฐานข้อมูล** ไม่ใช่ `.env` เพราะ
 * `.env` เป็นของเจ้าของเว็บ (ดู AGENTS.md) การให้เจ้าหน้าที่กดสร้างโทเคนใหม่เอง
 * ที่หลังบ้านได้ ทำให้เปลี่ยนโทเคนตอนหลุดได้ทันทีโดยไม่ต้องแตะไฟล์บนเครื่อง
 *
 * ยังไม่ได้สร้างโทเคน = ตอบ 404 เหมือนไม่มีเส้นทางนี้อยู่ (เผลอเปิดทิ้งไว้ไม่ได้)
 */

import { NextResponse } from "next/server";
import { saveSetting } from "@/lib/settings";
import {
  BRIDGE_LOG_KEY,
  getBridgeConfig,
  getBridgeLog,
  type BridgeConfig,
} from "@/lib/coopBridge";

/** ไอพีของผู้เรียกเท่าที่รู้ได้ — ใช้บันทึกว่าใครมาอ่าน ไม่ได้ใช้เป็นด่านหลัก */
export function callerIp(request: Request): string {
  const headers = request.headers;
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return headers.get("cf-connecting-ip") ?? forwarded ?? headers.get("x-real-ip") ?? "";
}

export type Allowed = { config: BridgeConfig; ip: string };

/**
 * ผ่านด่านไหม — ผ่านแล้วคืนค่าที่ตั้งไว้ ไม่ผ่านคืนคำตอบที่ส่งกลับได้เลย
 *
 * ลำดับการตรวจตั้งใจให้ "ไม่บอกความลับ": ปิดอยู่หรือยังไม่มีโทเคน = 404 เหมือนไม่มี
 * เส้นทางนี้ · มีเส้นทางแต่โทเคนผิด = 401 · ไอพีไม่อยู่ในรายการ = 403
 */
export async function requireBridge(request: Request): Promise<Allowed | NextResponse> {
  const config = await getBridgeConfig();

  if (!config.enabled || !config.token) {
    return NextResponse.json({ error: "ไม่พบเส้นทางนี้" }, { status: 404 });
  }

  const url = new URL(request.url);
  const given =
    request.headers.get("x-bridge-token") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    url.searchParams.get("token") ??
    "";

  if (given !== config.token) {
    return NextResponse.json({ error: "โทเคนไม่ถูกต้อง" }, { status: 401 });
  }

  const ip = callerIp(request);
  if (config.allowIps.length > 0 && !config.allowIps.includes(ip)) {
    return NextResponse.json({ error: `ไอพี ${ip || "(ไม่ทราบ)"} ไม่อยู่ในรายการที่อนุญาต` }, { status: 403 });
  }

  return { config, ip };
}

/**
 * จดว่าใครมาอ่านชุดไหนล่าสุด — ให้หน้าภาพรวมในหลังบ้านบอกได้ว่าระบบปลายทางยังคุยอยู่ไหม
 *
 * พลาดก็ช่างมัน ไม่ให้ล้มทั้งคำขอเพราะเรื่องบันทึกสถิติ
 */
export async function noteRead(dataset: string, ip: string): Promise<void> {
  try {
    const log = await getBridgeLog();
    const before = log.reads[dataset];
    log.reads[dataset] = {
      at: new Date().toISOString(),
      ip,
      count: (before?.count ?? 0) + 1,
    };
    await saveSetting(BRIDGE_LOG_KEY, log);
  } catch (error) {
    console.error("จดสถิติการอ่านของ CoopBridge ไม่ได้:", error);
  }
}

/**
 * หัวคำขอที่ติดไปกับทุกคำตอบ
 *
 * `no-store` เพราะข้อมูลนี้เป็นของสด ระบบปลายทางต้องได้ของล่าสุดเสมอ
 * และตัวมิเรอร์ฝั่งโฮสต์จะได้ไม่เก็บสำเนาคำตอบที่ต้องใช้โทเคนไว้
 */
export const BRIDGE_HEADERS = {
  "Cache-Control": "no-store",
  "X-Bridge-Name": "CoopBridge",
};
