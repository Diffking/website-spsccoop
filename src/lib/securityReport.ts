import { readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import { getBackupStatus } from "@/lib/backups";
import { syncStatus } from "@/lib/memberSync";
import { edgeBase } from "@/lib/surveyEdge";
import type { SecurityKind } from "@/lib/securityLog";

/**
 * ข้อมูลของหน้า "ความปลอดภัย" (/admin/security · ADMIN เท่านั้น) — อ่านอย่างเดียวทั้งหมด
 *
 * ⚠️ ห้ามแตะโฮสต์ spsccoop.com จากที่นี่ (ไอพีสำนักงานโดนแบนได้) — ถามได้แค่ Cloudflare Worker
 */

/* ------------------------------------------------------------ เวอร์ชัน */

async function pkgVersion(name: string): Promise<string> {
  try {
    const raw = await readFile(path.join(process.cwd(), "node_modules", name, "package.json"), "utf-8");
    return (JSON.parse(raw) as { version?: string }).version ?? "?";
  } catch {
    return "?";
  }
}

export type VersionRow = { name: string; version: string; note: string };

export async function runtimeVersions(): Promise<VersionRow[]> {
  const [next, react, sharp, prisma] = await Promise.all([
    pkgVersion("next"),
    pkgVersion("react"),
    pkgVersion("sharp"),
    pkgVersion("@prisma/client"),
  ]);
  let postgres = "?";
  try {
    const rows = await db.$queryRaw<{ v: string }[]>`select current_setting('server_version') as v`;
    postgres = rows[0]?.v ?? "?";
  } catch {
    // ฐานไม่ตอบ — หน้านี้ก็คงเปิดไม่ขึ้นอยู่แล้ว
  }
  return [
    { name: "Next.js", version: next, note: "เฟรมเวิร์กของเว็บ · ล็อกเลขตายตัวใน package.json" },
    { name: "React", version: react, note: "ล็อกเลขตายตัวคู่กับ Next" },
    { name: "Node.js", version: process.version.replace(/^v/, ""), note: "มาจาก image node:22-alpine · build ด้วย --pull" },
    { name: "PostgreSQL", version: postgres, note: "image postgres:16-alpine" },
    { name: "sharp", version: sharp, note: "ย่อรูปที่อัปจากหลังบ้าน" },
    { name: "Prisma", version: prisma, note: "ตัวต่อฐานข้อมูล" },
  ];
}

/* ------------------------------------------------------- การเข้าสู่ระบบ */

export type EventCounts = Record<SecurityKind, { d7: number; d30: number }>;

export async function eventSummary() {
  const now = Date.now();
  const d7 = new Date(now - 7 * 86_400_000);
  const d30 = new Date(now - 30 * 86_400_000);

  const [g7, g30, topIp, topUser, recent] = await Promise.all([
    db.securityEvent.groupBy({ by: ["kind"], where: { at: { gte: d7 } }, _count: { _all: true } }),
    db.securityEvent.groupBy({ by: ["kind"], where: { at: { gte: d30 } }, _count: { _all: true } }),
    db.securityEvent.groupBy({
      by: ["ip"],
      where: { at: { gte: d30 }, kind: { in: ["login_fail", "login_locked", "line_fail", "survey_blocked", "eval_bad_sig"] } },
      _count: { _all: true },
      orderBy: { _count: { ip: "desc" } },
      take: 5,
    }),
    db.securityEvent.groupBy({
      by: ["username"],
      where: { at: { gte: d30 }, kind: { in: ["login_fail", "login_locked"] } },
      _count: { _all: true },
      orderBy: { _count: { username: "desc" } },
      take: 5,
    }),
    db.securityEvent.findMany({ orderBy: { at: "desc" }, take: 20 }),
  ]);

  const counts = {} as EventCounts;
  const pick = (rows: typeof g7, kind: string) => rows.find((r) => r.kind === kind)?._count._all ?? 0;
  for (const kind of [
    "login_ok",
    "login_fail",
    "login_locked",
    "line_ok",
    "line_fail",
    "survey_blocked",
    "eval_bad_sig",
    "eval_rejected",
    "eval_ok",
  ] as SecurityKind[]) {
    counts[kind] = { d7: pick(g7, kind), d30: pick(g30, kind) };
  }
  const first = await db.securityEvent.findFirst({ orderBy: { at: "asc" }, select: { at: true } });

  return {
    counts,
    topIp: topIp.filter((r) => r.ip).map((r) => ({ key: r.ip!, count: r._count._all })),
    topUser: topUser.filter((r) => r.username).map((r) => ({ key: r.username!, count: r._count._all })),
    recent,
    /** เริ่มเก็บเมื่อไหร่ — ก่อนหน้านั้นไม่มีข้อมูล ไม่ใช่ว่าไม่มีเหตุการณ์ */
    since: first?.at ?? null,
  };
}

/** การเข้าสู่ระบบรายวันย้อนหลัง (วันตามเวลาไทย) — กราฟแท่งซ้อน สำเร็จ / ผิด / ถูกล็อก */
export type DayPoint = { day: string; ok: number; fail: number; locked: number };

export async function dailyLogins(days = 30): Promise<DayPoint[]> {
  const BKK = 7 * 3_600_000;
  const dayKey = (t: number) => new Date(t + BKK).toISOString().slice(0, 10);
  const today = dayKey(Date.now());
  const start = Date.parse(`${today}T00:00:00Z`) - BKK - (days - 1) * 86_400_000;

  const rows = await db.securityEvent.findMany({
    where: { at: { gte: new Date(start) }, kind: { in: ["login_ok", "line_ok", "login_fail", "line_fail", "login_locked"] } },
    select: { at: true, kind: true },
  });

  const out: DayPoint[] = [];
  const index = new Map<string, DayPoint>();
  for (let i = 0; i < days; i++) {
    const p = { day: dayKey(start + i * 86_400_000), ok: 0, fail: 0, locked: 0 };
    out.push(p);
    index.set(p.day, p);
  }
  for (const r of rows) {
    const p = index.get(dayKey(r.at.getTime()));
    if (!p) continue;
    if (r.kind === "login_ok" || r.kind === "line_ok") p.ok++;
    else if (r.kind === "login_locked") p.locked++;
    else p.fail++;
  }
  return out;
}

/* ------------------------------------------------------------ บัญชี */

export async function accountSummary() {
  const now = new Date();
  const users = await db.user.findMany({
    orderBy: { username: "asc" },
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      active: true,
      ownPassword: true,
      lineUserId: true,
      _count: { select: { sessions: { where: { expiresAt: { gt: now } } } } },
    },
  });
  return users.map((u) => ({
    username: u.username,
    name: u.name,
    role: u.role,
    active: u.active,
    ownPassword: u.ownPassword,
    line: Boolean(u.lineUserId),
    sessions: u._count.sessions,
  }));
}

/* ------------------------------------------------------- ระบบเชื่อมต่อ */

/** Worker บน Cloudflare ตอบไหม — ทิศ เครื่องนี้ → Cloudflare ไม่แตะโฮสต์ .com */
async function workerHealth(): Promise<boolean | null> {
  try {
    const res = await fetch(`${edgeBase()}/__health`, { signal: AbortSignal.timeout(5_000), cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}

export async function integrationSummary() {
  const [backup, sync, worker] = await Promise.all([getBackupStatus(), syncStatus(), workerHealth()]);
  return { backup, sync, worker };
}

/* ---------------------------------------------- รายการค้างบนเครื่อง Windows */

/**
 * เว็บตรวจเครื่อง Windows เองไม่ได้ (รันในคอนเทนเนอร์) — เป็นรายการที่ตรวจพบตอนตรวจช่องโหว่ 27 ต.ค. 2569
 * ให้ ADMIN ติ๊กว่าจัดการแล้ว · เก็บใน Setting["securityChecklist"] = { id: { done, by, at } }
 * เพิ่มรายการใหม่ = ต่อท้ายที่นี่ (รหัสห้ามเปลี่ยน ไม่งั้นสถานะที่ติ๊กไว้หลุด)
 */
export const MACHINE_ITEMS: { id: string; title: string; detail: string }[] = [
  {
    id: "pg18-lan",
    title: "PostgreSQL 18 บน Windows เปิดพอร์ต 5432 ให้ทั้งวงแลน",
    detail: "service postgresql-x64-18 · รุ่น 18.1 (ล่าสุด 18.6) · ไม่ใช่ของเว็บนี้ — อัปเดต แล้วตั้ง listen_addresses = 'localhost' หรือปิดถ้าไม่ใช้",
  },
  { id: "git-update", title: "Git for Windows 2.49.0 ตามหลังรุ่นล่าสุด", detail: "อัปเดตเป็น 2.56 ขึ้นไป (มีแพตช์ช่องโหว่หลายรอบ)" },
  { id: "anydesk", title: "AnyDesk เปิดพอร์ต 7070 ให้วงแลน", detail: "ตรวจว่าตั้งรหัสผ่านเข้าแบบไม่มีคนเฝ้า หรือปิดการเข้าแบบนั้น" },
  { id: "daemon-tools", title: "DAEMON Tools เปิดพอร์ต 45769 ให้วงแลน", detail: "ถ้าไม่ได้ใช้ ถอนการติดตั้ง" },
];

export type ChecklistState = Record<string, { done: boolean; by: string; at: string }>;

export async function checklistState(): Promise<ChecklistState> {
  const row = await db.setting.findUnique({ where: { key: "securityChecklist" } });
  return (row?.value as ChecklistState | undefined) ?? {};
}

/* ------------------------------------------------------------ คะแนน */

/**
 * คะแนนความปลอดภัย 0–100 (เกณฑ์ที่เจ้าของเว็บอนุมัติ 28 ต.ค. 2569) — ฟังก์ชันล้วน ไม่แตะฐาน
 * แก้น้ำหนัก/เกณฑ์ที่นี่ที่เดียว หน้าปัดกับมิเตอร์รายเกณฑ์อ่านจากผลนี้ทั้งคู่
 */
export type ScoreStatus = "good" | "warning" | "critical";

export type ScorePart = {
  key: string;
  label: string;
  got: number;
  max: number;
  /** ค่าจริงที่เอาไปวาดบนหลอด + ข้อความอ่านค่า */
  value: number;
  scaleMax: number;
  /** ขีดเกณฑ์บนหลอด · lowerIsBetter = ค่าต่ำกว่าขีดถึงผ่าน */
  target: number;
  lowerIsBetter?: boolean;
  reading: string;
  note: string;
};

export const SCORE_BANDS = { warning: 60, good: 80 } as const;

export function scoreStatus(score: number): ScoreStatus {
  return score >= SCORE_BANDS.good ? "good" : score >= SCORE_BANDS.warning ? "warning" : "critical";
}

export function securityScore(input: {
  accounts: { active: boolean; ownPassword: boolean; line: boolean }[];
  backupAt: string | null;
  fails7: number;
  locked7: number;
  worker: boolean | null;
  machineDone: number;
  machineTotal: number;
}) {
  const active = input.accounts.filter((a) => a.active);
  const n = Math.max(active.length, 1);
  const own = active.filter((a) => a.ownPassword).length;
  const line = active.filter((a) => a.line).length;

  const ageH = input.backupAt ? (Date.now() - new Date(input.backupAt).getTime()) / 3_600_000 : Infinity;
  const backupGot = ageH <= 26 ? 20 : ageH >= 48 ? 0 : (20 * (48 - ageH)) / 22;

  let loginGot = input.fails7 <= 10 ? 15 : input.fails7 >= 50 ? 0 : (15 * (50 - input.fails7)) / 40;
  if (input.locked7 > 0) loginGot = Math.min(loginGot, 5);

  const parts: ScorePart[] = [
    {
      key: "password",
      label: "บัญชีตั้งรหัสเองแล้ว",
      got: (20 * own) / n,
      max: 20,
      value: own,
      scaleMax: active.length,
      target: active.length,
      reading: `${own} จาก ${active.length} คน`,
      note: "เกณฑ์: ครบทุกคน",
    },
    {
      key: "line",
      label: "บัญชีผูก LINE แล้ว",
      got: (20 * line) / n,
      max: 20,
      value: line,
      scaleMax: active.length,
      target: active.length,
      reading: `${line} จาก ${active.length} คน`,
      note: "เกณฑ์: ครบทุกคน",
    },
    {
      key: "backup",
      label: "สำรองข้อมูลล่าสุด",
      got: backupGot,
      max: 20,
      value: Number.isFinite(ageH) ? Math.min(ageH, 72) : 72,
      scaleMax: 72,
      target: 26,
      lowerIsBetter: true,
      reading: Number.isFinite(ageH) ? `${Math.round(ageH)} ชม.ก่อน` : "ยังไม่มีไฟล์",
      note: "เกณฑ์: ไม่เกิน 26 ชม. · เกิน 48 ชม. = 0 คะแนน",
    },
    {
      key: "login",
      label: "ล็อกอินผิดใน 7 วัน",
      got: loginGot,
      max: 15,
      value: input.fails7,
      scaleMax: Math.max(50, input.fails7),
      target: 10,
      lowerIsBetter: true,
      reading: `${input.fails7} ครั้ง${input.locked7 > 0 ? ` · ถูกล็อก ${input.locked7}` : ""}`,
      note: "เกณฑ์: ไม่เกิน 10 ครั้ง และไม่มีบัญชีถูกล็อก",
    },
    {
      key: "worker",
      label: "Worker แบบประเมินตอบ",
      got: input.worker ? 10 : 0,
      max: 10,
      value: input.worker ? 1 : 0,
      scaleMax: 1,
      target: 1,
      reading: input.worker ? "ตอบปกติ" : "ไม่ตอบ",
      note: "เกณฑ์: ตอบปกติ",
    },
    {
      key: "machine",
      label: "รายการค้างบนเครื่อง Windows",
      got: (15 * input.machineDone) / Math.max(input.machineTotal, 1),
      max: 15,
      value: input.machineDone,
      scaleMax: input.machineTotal,
      target: input.machineTotal,
      reading: `จัดการแล้ว ${input.machineDone} จาก ${input.machineTotal}`,
      note: "เกณฑ์: ติ๊กครบทุกข้อ",
    },
  ];

  // ปัดลงเสมอ — 79.6 ห้ามขึ้นเป็นโซนเขียว
  const score = Math.floor(parts.reduce((s, p) => s + p.got, 0));
  return { score, status: scoreStatus(score), parts };
}
