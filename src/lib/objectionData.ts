/** อ่านรอบคำทักท้วงจากฐาน — ฝั่งเซิร์ฟเวอร์เท่านั้น (ตรรกะอยู่ที่ src/lib/objection.ts) */

import { db } from "@/lib/db";
import { readAgendas, roundStatus, type Agenda, type RoundStatus } from "@/lib/objection";

export type RoundView = {
  id: string;
  year: number;
  title: string;
  opensAt: string;
  closesAt: string;
  agendas: Agenda[];
  published: boolean;
  status: RoundStatus;
};

type Row = {
  id: string;
  year: number;
  title: string;
  opensAt: Date;
  closesAt: Date;
  agendas: unknown;
  published: boolean;
};

export const toRoundView = (r: Row): RoundView => ({
  id: r.id,
  year: r.year,
  title: r.title,
  opensAt: r.opensAt.toISOString(),
  closesAt: r.closesAt.toISOString(),
  agendas: readAgendas(r.agendas),
  published: r.published,
  status: roundStatus(r),
});

/**
 * รอบที่หน้า /point-order/ ควรโชว์ — เปิดรับอยู่ก่อน · ไม่มีก็รอบที่กำลังจะเปิด · ไม่มีอีกก็รอบล่าสุดที่ปิดไปแล้ว
 * ไม่มีรอบที่เผยแพร่เลย = null (หน้าเว็บขึ้น "ยังไม่เปิดรับ")
 */
export async function currentRound(): Promise<RoundView | null> {
  const rows = await db.objectionRound
    .findMany({ where: { published: true }, orderBy: { opensAt: "desc" } })
    .catch(() => []);
  const views = rows.map(toRoundView);
  return (
    views.find((r) => r.status === "open") ??
    [...views].reverse().find((r) => r.status === "scheduled") ??
    views.find((r) => r.status === "closed") ??
    null
  );
}
