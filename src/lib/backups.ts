import { readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

/**
 * สถานะการสำรองฐานข้อมูล — service db-backup ดัมป์ให้วันละครั้ง เก็บย้อนหลัง 14 วัน
 * ในคอนเทนเนอร์ไฟล์อยู่ที่ /backups (mount แบบอ่านอย่างเดียว) ตอน dev อยู่ที่ ./backups
 */

const DAY = 86_400_000;

export type BackupFile = { name: string; size: number; at: string };
export type BackupStatus = {
  files: BackupFile[];
  total: number;
  totalSize: number;
  /** ไฟล์ล่าสุดเก่ากว่า 2 วัน = น่าจะมีอะไรผิดปกติกับ db-backup */
  stale: boolean;
  latestAt: string | null;
};

function backupDir(): string {
  return existsSync("/backups") ? "/backups" : path.join(process.cwd(), "backups");
}

export async function getBackupStatus(): Promise<BackupStatus> {
  const empty: BackupStatus = { files: [], total: 0, totalSize: 0, stale: true, latestAt: null };

  try {
    const dir = backupDir();
    const names = (await readdir(dir)).filter((n) => n.startsWith("coopsmile-") && n.endsWith(".sql"));

    const files = await Promise.all(
      names.map(async (name) => {
        const info = await stat(path.join(dir, name));
        return { name, size: info.size, at: info.mtime.toISOString() };
      }),
    );
    files.sort((a, b) => b.at.localeCompare(a.at));

    if (files.length === 0) return empty;

    const latest = files[0];
    return {
      files: files.slice(0, 5),
      total: files.length,
      totalSize: files.reduce((sum, f) => sum + f.size, 0),
      stale: Date.now() - new Date(latest.at).getTime() > 2 * DAY,
      latestAt: latest.at,
    };
  } catch (error) {
    console.error("อ่านโฟลเดอร์สำรองข้อมูลไม่ได้:", error);
    return empty;
  }
}
