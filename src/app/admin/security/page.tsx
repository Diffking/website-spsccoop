import { redirect } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  HardDrive,
  KeyRound,
  Link2,
  ListChecks,
  ScrollText,
  ShieldAlert,
  Users,
} from "lucide-react";
import { currentUser } from "@/lib/auth";
import { ADMIN_HOME } from "@/lib/permissions";
import { KIND_LABEL, type SecurityKind } from "@/lib/securityLog";
import {
  MACHINE_ITEMS,
  accountSummary,
  checklistState,
  eventSummary,
  integrationSummary,
  runtimeVersions,
} from "@/lib/securityReport";
import SecurityChecklist from "@/components/admin/SecurityChecklist";

/**
 * Dashboard ความปลอดภัย — ADMIN เท่านั้น (เจ้าของเว็บขอ 27 ต.ค. 2569)
 * อ่านอย่างเดียว ยกเว้นติ๊กรายการค้างบนเครื่อง · ไม่แตะโฮสต์ spsccoop.com
 */

export const dynamic = "force-dynamic";

const dt = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Bangkok",
});
const dShort = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" });

const BAD: SecurityKind[] = ["login_fail", "login_locked", "line_fail", "survey_blocked", "eval_bad_sig", "eval_rejected"];

function Card({ icon: Icon, title, hint, children }: { icon: typeof Cpu; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="font-semibold text-gray-800">{title}</h2>
          {hint && <p className="mt-0.5 text-xs text-gray-500">{hint}</p>}
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Pill({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${
        ok ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-amber-50 text-amber-700 ring-amber-200"
      }`}
    >
      {ok ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
      {children}
    </span>
  );
}

export default async function SecurityPage() {
  const user = await currentUser();
  if (!user) redirect("/login/");
  if (user.role !== "ADMIN") redirect(ADMIN_HOME);

  const [versions, events, accounts, links, checklist] = await Promise.all([
    runtimeVersions(),
    eventSummary(),
    accountSummary(),
    integrationSummary(),
    checklistState(),
  ]);

  const c = events.counts;
  const tiles: { label: string; kind: SecurityKind; warn?: boolean }[] = [
    { label: "เข้าสู่ระบบสำเร็จ", kind: "login_ok" },
    { label: "เข้าด้วย LINE สำเร็จ", kind: "line_ok" },
    { label: "รหัสผ่านผิด", kind: "login_fail", warn: true },
    { label: "ถูกล็อก 15 นาที", kind: "login_locked", warn: true },
    { label: "LINE ไม่สำเร็จ", kind: "line_fail", warn: true },
    { label: "แบบประเมิน: ถูกกันไล่สุ่ม", kind: "survey_blocked", warn: true },
  ];
  const openItems = MACHINE_ITEMS.filter((i) => !checklist[i.id]?.done).length;
  const weakAccounts = accounts.filter((a) => a.active && !a.ownPassword && !a.line).length;

  return (
    <main className="mx-auto max-w-5xl space-y-5 px-4 py-6">
      <div>
        <h1 className="text-xl font-bold text-gray-800">ความปลอดภัย</h1>
        <p className="mt-1 text-sm text-gray-500">
          ภาพรวมการเข้าสู่ระบบ บัญชีผู้ใช้ เวอร์ชันที่รันจริง และระบบเชื่อมต่อ · เห็นเฉพาะผู้ดูแลระบบ
        </p>
      </div>

      {/* สรุปบนสุด — มีอะไรต้องดูไหม */}
      <div className="flex flex-wrap gap-2">
        <Pill ok={c.login_locked.d7 === 0 && c.line_fail.d7 < 5}>
          7 วัน: ผิด {c.login_fail.d7} · ล็อก {c.login_locked.d7}
        </Pill>
        <Pill ok={weakAccounts === 0}>บัญชีที่ยังใช้รหัสตั้งต้น {weakAccounts} คน</Pill>
        <Pill ok={!links.backup.stale}>สำรองข้อมูล {links.backup.stale ? "เก่าเกิน 2 วัน" : "ปกติ"}</Pill>
        <Pill ok={openItems === 0}>รายการค้างบนเครื่อง {openItems} เรื่อง</Pill>
      </div>

      <Card
        icon={ScrollText}
        title="การเข้าสู่ระบบและการถูกกัน"
        hint={
          events.since
            ? `เริ่มเก็บตั้งแต่ ${dShort.format(events.since)} · เก็บย้อนหลัง 90 วัน · ไม่เก็บรหัสผ่าน`
            : "ยังไม่มีเหตุการณ์ — เริ่มเก็บตั้งแต่ขึ้นหน้านี้ · ไม่เก็บรหัสผ่าน"
        }
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {tiles.map((t) => (
            <div
              key={t.kind}
              className={`rounded-xl p-3 ${t.warn && c[t.kind].d7 > 0 ? "bg-amber-50 ring-1 ring-amber-100" : "bg-gray-50"}`}
            >
              <p className="text-xs text-gray-500">{t.label}</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-gray-800">
                {c[t.kind].d7}
                <span className="ml-1 text-xs font-normal text-gray-400">7 วัน · {c[t.kind].d30} ใน 30 วัน</span>
              </p>
            </div>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          {[
            { title: "ไอพีที่พลาดบ่อย (30 วัน)", rows: events.topIp },
            { title: "ชื่อผู้ใช้ที่ถูกลองบ่อย (30 วัน)", rows: events.topUser },
          ].map((box) => (
            <div key={box.title} className="min-w-0">
              <p className="text-xs font-medium text-gray-500">{box.title}</p>
              {box.rows.length === 0 ? (
                <p className="mt-2 text-sm text-gray-400">ไม่มี</p>
              ) : (
                <ul className="mt-1 grid grid-cols-1 divide-y divide-gray-50 text-sm">
                  {box.rows.map((r) => (
                    <li key={r.key} className="flex min-w-0 justify-between gap-3 py-1.5">
                      <span className="truncate font-mono text-gray-700">{r.key}</span>
                      <span className="shrink-0 tabular-nums text-gray-500">{r.count} ครั้ง</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>

        <p className="mt-5 text-xs font-medium text-gray-500">20 รายการล่าสุด</p>
        {events.recent.length === 0 ? (
          <p className="mt-2 text-sm text-gray-400">ยังไม่มี</p>
        ) : (
          <div className="mt-1 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400">
                  <th className="py-1.5 pr-3 font-normal">เวลา</th>
                  <th className="py-1.5 pr-3 font-normal">เหตุการณ์</th>
                  <th className="py-1.5 pr-3 font-normal">ผู้ใช้ / เลข</th>
                  <th className="py-1.5 pr-3 font-normal">ไอพี</th>
                  <th className="py-1.5 font-normal">หมายเหตุ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {events.recent.map((e) => (
                  <tr key={e.id}>
                    <td className="whitespace-nowrap py-1.5 pr-3 text-gray-500">{dt.format(e.at)}</td>
                    <td className={`whitespace-nowrap py-1.5 pr-3 ${BAD.includes(e.kind as SecurityKind) ? "text-amber-700" : "text-gray-700"}`}>
                      {KIND_LABEL[e.kind as SecurityKind] ?? e.kind}
                    </td>
                    <td className="py-1.5 pr-3 font-mono text-xs text-gray-600">{e.username ?? "—"}</td>
                    <td className="py-1.5 pr-3 font-mono text-xs text-gray-600">{e.ip ?? "—"}</td>
                    <td className="py-1.5 text-xs text-gray-500">{e.note ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card icon={Users} title="บัญชีผู้ใช้" hint="รหัสตั้งต้น = 4 ตัวท้ายเบอร์โทร เดาได้แค่หมื่นแบบ · ผูก LINE แล้วรหัสผ่านใช้บนโดเมนสาธารณะไม่ได้">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400">
                <th className="py-1.5 pr-3 font-normal">ผู้ใช้</th>
                <th className="py-1.5 pr-3 font-normal">สิทธิ์</th>
                <th className="py-1.5 pr-3 font-normal">รหัสผ่าน</th>
                <th className="py-1.5 pr-3 font-normal">LINE</th>
                <th className="py-1.5 font-normal">กำลังเข้าระบบ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {accounts.map((a) => (
                <tr key={a.username} className={a.active ? "" : "opacity-50"}>
                  <td className="py-2 pr-3">
                    <span className="font-medium text-gray-800">{a.name}</span>{" "}
                    <span className="font-mono text-xs text-gray-400">{a.username}</span>
                    {!a.active && <span className="ml-1 text-xs text-gray-400">(ปิดใช้งาน)</span>}
                  </td>
                  <td className="py-2 pr-3 text-xs text-gray-600">{a.role === "ADMIN" ? "ผู้ดูแลระบบ" : "เจ้าหน้าที่"}</td>
                  <td className="py-2 pr-3">
                    <Pill ok={a.ownPassword}>{a.ownPassword ? "ตั้งเองแล้ว" : "รหัสตั้งต้น"}</Pill>
                  </td>
                  <td className="py-2 pr-3">
                    <Pill ok={a.line}>{a.line ? "ผูกแล้ว" : "ยังไม่ผูก"}</Pill>
                  </td>
                  <td className="py-2 text-xs tabular-nums text-gray-600">{a.sessions} เครื่อง</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card icon={Cpu} title="เวอร์ชันที่รันจริง" hint="อ่านจากระบบที่กำลังทำงานอยู่ · แพตช์ล่าสุด 27 ต.ค. 2569 (npm audit 0)">
          <ul className="grid grid-cols-1 divide-y divide-gray-50">
            {versions.map((v) => (
              <li key={v.name} className="flex min-w-0 items-center justify-between gap-3 py-2">
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-gray-800">{v.name}</span>
                  <span className="block truncate text-xs text-gray-400">{v.note}</span>
                </span>
                <span className="shrink-0 font-mono text-sm text-gray-700">{v.version}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card icon={Link2} title="ระบบเชื่อมต่อ" hint="ไม่ถามโฮสต์ spsccoop.com (ไอพีสำนักงานโดนแบนได้)">
          <ul className="grid grid-cols-1 divide-y divide-gray-50 text-sm">
            <li className="flex items-center justify-between gap-3 py-2">
              <span className="flex items-center gap-2 text-gray-700">
                <HardDrive className="h-4 w-4 text-gray-400" /> สำรองฐานข้อมูล
              </span>
              <Pill ok={!links.backup.stale}>
                {links.backup.latestAt ? dt.format(new Date(links.backup.latestAt)) : "ยังไม่มีไฟล์"}
              </Pill>
            </li>
            <li className="flex items-center justify-between gap-3 py-2">
              <span className="flex items-center gap-2 text-gray-700">
                <KeyRound className="h-4 w-4 text-gray-400" /> ทะเบียนสมาชิก (sync-agent)
              </span>
              <Pill ok={links.sync.configured && links.sync.count > 0 && !links.sync.stale}>
                {!links.sync.configured
                  ? "ยังไม่ตั้งคีย์"
                  : links.sync.state
                    ? `${links.sync.count.toLocaleString("th-TH")} คน · ${dt.format(new Date(links.sync.state.receivedAt))}`
                    : "ยังไม่เคยได้รับ"}
              </Pill>
            </li>
            <li className="flex items-center justify-between gap-3 py-2">
              <span className="flex items-center gap-2 text-gray-700">
                <ShieldAlert className="h-4 w-4 text-gray-400" /> แบบประเมิน (Cloudflare Worker)
              </span>
              <Pill ok={links.worker === true}>{links.worker ? "ตอบปกติ" : "ไม่ตอบ"}</Pill>
            </li>
            <li className="flex items-center justify-between gap-3 py-2">
              <span className="text-gray-700">ทะเบียนถูกปฏิเสธ / ลายเซ็นผิด (30 วัน)</span>
              <span className="tabular-nums text-gray-600">
                {c.eval_rejected.d30} / {c.eval_bad_sig.d30}
              </span>
            </li>
          </ul>
        </Card>
      </div>

      <Card
        icon={ListChecks}
        title="รายการค้างบนเครื่องเซิร์ฟเวอร์ (Windows)"
        hint="เว็บตรวจเครื่องเองไม่ได้ — จัดการแล้วกดติ๊กเพื่อบันทึก · จากการตรวจช่องโหว่ 27 ต.ค. 2569"
      >
        <SecurityChecklist items={MACHINE_ITEMS} initial={checklist} />
      </Card>
    </main>
  );
}
