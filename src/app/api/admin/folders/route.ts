import { NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { db } from "@/lib/db";
import { FOLDERS } from "@/lib/assetFolders";

/**
 * รายชื่อโฟลเดอร์เก็บไฟล์ที่มีอยู่จริง — ใช้ให้เลือกตอนแนบไฟล์
 *
 * รวมสามที่: โฟลเดอร์ประจำระบบ (FOLDERS) · โฟลเดอร์ที่ตั้งไว้ให้แต่ละหน้าเนื้อหา ·
 * และโฟลเดอร์ที่เคยมีไฟล์ไปลงจริง (อ่านจากที่อยู่ไฟล์ในตาราง Media)
 * ที่ต้องดูจาก Media ด้วยเพราะโฟลเดอร์เก่าบางอันไม่ได้อยู่ในสองรายการแรกแล้ว
 */

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const found = new Map<string, string>();
  for (const [value, label] of Object.entries(FOLDERS)) found.set(value, label);

  const [pages, media] = await Promise.all([
    db.page.findMany({ select: { slug: true, assetFolder: true } }).catch(() => []),
    db.media.findMany({ select: { url: true }, take: 2000 }).catch(() => []),
  ]);

  for (const page of pages) {
    if (page.assetFolder) found.set(page.assetFolder, `หน้า ${page.slug}`);
  }

  // ที่อยู่ไฟล์หน้าตาแบบ https://โดเมน/assets/<โฟลเดอร์>/<ชื่อไฟล์> — เอาส่วนกลางมา
  for (const row of media) {
    const match = /\/assets\/(.+)\/[^/]+$/.exec(row.url);
    if (match && !found.has(match[1])) found.set(match[1], "เคยใช้เก็บไฟล์");
  }

  const folders = [...found].map(([value, label]) => ({ value, label })).sort((a, b) =>
    a.value.localeCompare(b.value),
  );
  return NextResponse.json({ folders });
}
