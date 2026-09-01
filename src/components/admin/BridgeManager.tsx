"use client";

import { useState } from "react";
import {
  Save,
  Loader2,
  Share2,
  Link2Off,
  KeyRound,
  Copy,
  Check,
  Eye,
  EyeOff,
  RefreshCw,
  Users,
  CalendarDays,
  AlertTriangle,
} from "lucide-react";
import type { BridgeConfig, BridgeGroup, BridgeLog } from "@/lib/coopBridge";

/**
 * หน้าจัดการ CoopBridge
 *
 * แนวคิดของหน้านี้: เจ้าหน้าที่ไม่ต้องรู้เรื่อง API เลย — เห็นแค่ว่า
 *   1. ตอนนี้แบ่งปันอยู่ไหม · ใครมาอ่านล่าสุดเมื่อไร
 *   2. กลุ่มไหนถูกส่งออกไปบ้าง กดปิดรายกลุ่มได้
 *   3. **คนไหนที่ระบบยังไม่รู้ชื่อจริง** — พิมพ์ให้ตรงนี้ได้เลย
 *
 * ข้อ 3 คือหัวใจ เพราะรูปบุคลากรมีชื่อพิมพ์ติดมาในภาพ หน้าเว็บจึงไม่มีข้อความชื่อ
 * ระบบปลายทางเอาไปทำทะเบียนบุคลากรต่อไม่ได้ถ้าไม่มีชื่อเป็นตัวอักษร
 */

type Props = {
  initial: BridgeConfig;
  groups: BridgeGroup[];
  events: number;
  log: BridgeLog;
  base: string;
};

const KIND_LABEL: Record<BridgeGroup["kind"], string> = {
  board: "คณะกรรมการดำเนินการ",
  auditors: "ผู้ตรวจสอบกิจการ",
  nominations: "คณะกรรมการสรรหา",
  advisors: "ที่ปรึกษา",
  staff: "เจ้าหน้าที่",
  other: "อื่น ๆ",
};

const SOURCE_LABEL: Record<string, string> = {
  override: "พิมพ์ให้เอง",
  caption: "จากใต้รูปในหน้าเว็บ",
  alt: "เดาจากคำบรรยายรูป",
  none: "ไม่มีชื่อ",
};

/** เวลาแบบอ่านง่าย — ไม่ต้องมีไลบรารีวันที่ */
function thaiTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  }).format(d);
}

export default function BridgeManager({ initial, groups, events, log, base }: Props) {
  const [config, setConfig] = useState<BridgeConfig>(initial);
  const [ips, setIps] = useState(initial.allowIps.join("\n"));
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [copied, setCopied] = useState("");

  const set = (patch: Partial<BridgeConfig>) => setConfig((prev) => ({ ...prev, ...patch }));

  const shared = groups.filter((g) => !config.hiddenGroups.includes(g.key));
  const sharedPeople = shared.reduce((sum, g) => sum + g.count, 0);
  const needsReview = shared.reduce(
    (sum, g) =>
      sum +
      g.people.filter(
        (p) => !config.overrides[p.id]?.name && (p.nameSource === "alt" || p.nameSource === "none"),
      ).length,
    0,
  );

  function toggleGroup(key: string) {
    const hidden = config.hiddenGroups.includes(key)
      ? config.hiddenGroups.filter((k) => k !== key)
      : [...config.hiddenGroups, key];
    set({ hiddenGroups: hidden });
  }

  function setOverride(id: string, patch: { name?: string; role?: string }) {
    setConfig((prev) => ({
      ...prev,
      overrides: { ...prev.overrides, [id]: { ...prev.overrides[id], ...patch } },
    }));
  }

  async function copy(text: string, tag: string) {
    await navigator.clipboard.writeText(text).catch(() => {});
    setCopied(tag);
    window.setTimeout(() => setCopied(""), 1500);
  }

  async function save() {
    setBusy(true);
    setStatus(null);
    const response = await fetch("/api/admin/bridge/", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...config,
        allowIps: ips
          .split(/[\n,]/)
          .map((s) => s.trim())
          .filter(Boolean),
      }),
    });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    setStatus(
      response.ok
        ? { kind: "ok", text: "บันทึกแล้ว" }
        : { kind: "error", text: data.error ?? "บันทึกไม่สำเร็จ" },
    );
  }

  async function makeToken() {
    if (config.token && !window.confirm("สร้างโทเคนใหม่แล้วของเดิมจะใช้ไม่ได้ทันที ยืนยันไหม")) {
      return;
    }
    setBusy(true);
    setStatus(null);
    const response = await fetch("/api/admin/bridge/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "newToken" }),
    });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (response.ok) {
      set({ token: data.token as string, enabled: true });
      setShowToken(true);
      setStatus({ kind: "ok", text: "สร้างโทเคนใหม่แล้ว — เอาไปใส่ที่ระบบปลายทางด้วย" });
    } else {
      setStatus({ kind: "error", text: data.error ?? "สร้างโทเคนไม่สำเร็จ" });
    }
  }

  const endpoints = [
    { key: "manifest", label: "รายการชุดข้อมูลทั้งหมด", url: `${base}/api/bridge/` },
    { key: "people", label: "ทำเนียบบุคลากร", url: `${base}/api/bridge/people/` },
    { key: "calendar", label: "กิจกรรมบนปฏิทิน", url: `${base}/api/bridge/calendar/` },
  ];

  return (
    <div className="space-y-4">
      {/* ---------- สวิตช์ใหญ่ ---------- */}
      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <div className="flex items-start gap-3">
          <span
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
              config.enabled && config.token
                ? "bg-emerald-50 text-emerald-600"
                : "bg-gray-100 text-gray-400"
            }`}
          >
            {config.enabled && config.token ? (
              <Share2 className="h-5 w-5" />
            ) : (
              <Link2Off className="h-5 w-5" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-gray-800">เปิดให้ระบบอื่นดึงข้อมูลไปใช้</h2>
            <p className="mt-0.5 text-xs leading-relaxed text-gray-500">
              ปิดแล้วทุกเส้นทางจะตอบเหมือนไม่มีอยู่จริง ระบบปลายทางดึงข้อมูลไม่ได้ทันที
              — ข้อมูลบนหน้าเว็บไม่กระทบ
            </p>
          </div>
          <button
            type="button"
            onClick={() => set({ enabled: !config.enabled })}
            className={`relative h-6 w-11 shrink-0 rounded-full transition ${
              config.enabled ? "bg-emerald-500" : "bg-gray-300"
            }`}
            aria-label="เปิดปิดการแบ่งปันข้อมูล"
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
                config.enabled ? "left-[22px]" : "left-0.5"
              }`}
            />
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-gray-50 p-3">
            <p className="flex items-center gap-1.5 text-xs text-gray-500">
              <Users className="h-3.5 w-3.5" /> คนที่แบ่งปันอยู่
            </p>
            <p className="mt-1 text-xl font-bold text-gray-800">{sharedPeople}</p>
            <p className="text-xs text-gray-400">{shared.length} ทำเนียบ</p>
          </div>
          <div className="rounded-xl bg-gray-50 p-3">
            <p className="flex items-center gap-1.5 text-xs text-gray-500">
              <CalendarDays className="h-3.5 w-3.5" /> กิจกรรมบนปฏิทิน
            </p>
            <p className="mt-1 text-xl font-bold text-gray-800">{events}</p>
            <p className="text-xs text-gray-400">รวมที่ปักจากสไลด์แล้ว</p>
          </div>
          <div
            className={`rounded-xl p-3 ${needsReview > 0 ? "bg-amber-50" : "bg-gray-50"}`}
          >
            <p className="flex items-center gap-1.5 text-xs text-gray-500">
              <AlertTriangle className="h-3.5 w-3.5" /> ชื่อที่ยังไม่ได้ตรวจ
            </p>
            <p
              className={`mt-1 text-xl font-bold ${
                needsReview > 0 ? "text-amber-700" : "text-gray-800"
              }`}
            >
              {needsReview}
            </p>
            <p className="text-xs text-gray-400">ระบบเดาชื่อจากคำบรรยายรูปให้</p>
          </div>
        </div>
      </section>

      {/* ---------- โทเคน ---------- */}
      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <h2 className="flex items-center gap-2 font-semibold text-gray-800">
          <KeyRound className="h-4 w-4 text-gray-400" /> โทเคนสำหรับระบบปลายทาง
        </h2>
        <p className="mt-0.5 text-xs leading-relaxed text-gray-500">
          ระบบที่จะดึงข้อมูลต้องแนบโทเคนนี้มาทุกครั้ง ใครไม่มีก็ดึงไม่ได้
          — ให้เฉพาะผู้ดูแลระบบปลายทาง ไม่ต้องบอกใครอีก
        </p>

        {config.token ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg bg-gray-50 px-3 py-2 font-mono text-sm text-gray-700 ring-1 ring-gray-200">
              {showToken ? config.token : "•".repeat(24)}
            </code>
            <button
              type="button"
              onClick={() => setShowToken((v) => !v)}
              className="grid h-9 w-9 place-items-center rounded-lg text-gray-500 ring-1 ring-gray-200 transition hover:bg-gray-50"
              aria-label={showToken ? "ซ่อนโทเคน" : "แสดงโทเคน"}
            >
              {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => copy(config.token, "token")}
              className="grid h-9 w-9 place-items-center rounded-lg text-gray-500 ring-1 ring-gray-200 transition hover:bg-gray-50"
              aria-label="คัดลอกโทเคน"
            >
              {copied === "token" ? (
                <Check className="h-4 w-4 text-emerald-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
            <button
              type="button"
              onClick={makeToken}
              disabled={busy}
              className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm text-gray-600 ring-1 ring-gray-200 transition hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className="h-3.5 w-3.5" /> สร้างใหม่
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={makeToken}
            disabled={busy}
            className="mt-3 flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-50"
          >
            <KeyRound className="h-4 w-4" /> เปิดใช้งานและสร้างโทเคน
          </button>
        )}

        {config.token && (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-medium text-gray-600">ที่อยู่ที่ระบบปลายทางต้องเรียก</p>
            {endpoints.map((e) => (
              <div key={e.key} className="flex items-center gap-2">
                <span className="w-40 shrink-0 text-xs text-gray-500">{e.label}</span>
                <code className="min-w-0 flex-1 truncate rounded-lg bg-gray-50 px-2.5 py-1.5 font-mono text-xs text-gray-600 ring-1 ring-gray-200">
                  {e.url}
                </code>
                <button
                  type="button"
                  onClick={() => copy(e.url, e.key)}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-gray-400 ring-1 ring-gray-200 transition hover:bg-gray-50"
                  aria-label={`คัดลอกที่อยู่${e.label}`}
                >
                  {copied === e.key ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            ))}

            <details className="mt-2 rounded-xl bg-gray-50 p-3">
              <summary className="cursor-pointer text-xs font-medium text-gray-600">
                ตัวอย่างคำสั่งทดสอบ (ให้ผู้ดูแลระบบปลายทาง)
              </summary>
              <pre className="mt-2 overflow-x-auto text-[11px] leading-relaxed text-gray-600">
{`curl -H "x-bridge-token: ${showToken ? config.token : "<โทเคน>"}" \\
  ${base}/api/bridge/people/`}
              </pre>
            </details>
          </div>
        )}
      </section>

      {/* ---------- กลุ่มที่แบ่งปัน + แก้ชื่อ ---------- */}
      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <h2 className="font-semibold text-gray-800">ทำเนียบที่แบ่งปัน</h2>
        <p className="mt-0.5 mb-3 text-xs leading-relaxed text-gray-500">
          รายชื่อมาจากหน้าเนื้อหาใต้ <span className="font-mono">about/directory</span> โดยตรง
          — เพิ่มทำเนียบชุดใหม่ในเมนูหน้าเนื้อหาแล้วจะมาโผล่ที่นี่เอง
        </p>

        <div className="space-y-3">
          {groups.map((group) => {
            const off = config.hiddenGroups.includes(group.key);
            const unchecked = group.people.filter(
              (p) =>
                !config.overrides[p.id]?.name &&
                (p.nameSource === "alt" || p.nameSource === "none"),
            ).length;

            return (
              <div
                key={group.key}
                className={`rounded-xl ring-1 transition ${
                  off ? "bg-gray-50 ring-gray-200" : "bg-white ring-gray-200"
                }`}
              >
                <div className="flex items-center gap-3 p-3">
                  <input
                    type="checkbox"
                    checked={!off}
                    onChange={() => toggleGroup(group.key)}
                    className="h-4 w-4 shrink-0 accent-emerald-600"
                    aria-label={`แบ่งปัน ${group.title}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className={`truncate font-medium ${off ? "text-gray-400" : "text-gray-800"}`}>
                      {group.title}
                    </p>
                    <p className="truncate text-xs text-gray-400">
                      {KIND_LABEL[group.kind]} · {group.count} คน · คีย์{" "}
                      <span className="font-mono">{group.key}</span>
                    </p>
                  </div>
                  {unchecked > 0 && !off && (
                    <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                      ยังไม่ได้ตรวจ {unchecked}
                    </span>
                  )}
                </div>

                <details className="border-t border-gray-100">
                  <summary className="cursor-pointer px-3 py-2 text-xs text-gray-500 transition hover:bg-gray-50">
                    ดูและแก้ชื่อ-ตำแหน่งที่จะส่งออกไป ({group.count} คน)
                  </summary>
                  <div className="space-y-2 p-3 pt-1">
                    {group.people.map((person) => {
                      const fix = config.overrides[person.id] ?? {};
                      const guessed = person.nameSource === "alt" || person.nameSource === "none";
                      return (
                        <div
                          key={person.id}
                          className="flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 p-2"
                        >
                          <span className="w-6 shrink-0 text-center text-xs text-gray-400">
                            {person.order}
                          </span>
                          {/* รูปเล็กไว้เทียบว่าใครเป็นใคร — ชื่ออยู่ในภาพอยู่แล้วในหลายหน้า */}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={person.photoPath}
                            alt=""
                            className="h-12 w-12 shrink-0 rounded-lg object-cover ring-1 ring-gray-200"
                          />
                          <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row">
                            <input
                              value={fix.name ?? (guessed ? "" : person.name)}
                              onChange={(e) => setOverride(person.id, { name: e.target.value })}
                              placeholder={person.name || "ยังไม่มีชื่อ"}
                              className={`min-w-0 flex-1 rounded-lg border px-2.5 py-1.5 text-sm ${
                                guessed && !fix.name
                                  ? "border-amber-300 bg-amber-50"
                                  : "border-gray-200 bg-white"
                              }`}
                            />
                            <input
                              value={fix.role ?? person.role}
                              onChange={(e) => setOverride(person.id, { role: e.target.value })}
                              placeholder="ตำแหน่ง"
                              className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm"
                            />
                          </div>
                          <span className="w-full shrink-0 text-xs text-gray-400 sm:w-36">
                            {SOURCE_LABEL[fix.name ? "override" : person.nameSource]}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </details>
              </div>
            );
          })}
        </div>
      </section>

      {/* ---------- ไอพี + ประวัติการอ่าน ---------- */}
      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <h2 className="font-semibold text-gray-800">จำกัดเฉพาะเครื่องที่กำหนด</h2>
        <p className="mt-0.5 text-xs leading-relaxed text-gray-500">
          ใส่ไอพีของเครื่องที่ยอมให้ดึงข้อมูล บรรทัดละหนึ่งเลข — เว้นว่าง = เครื่องไหนก็ได้
          (ยังต้องมีโทเคนอยู่ดี) · เป็นชั้นเสริมเท่านั้น ด่านหลักคือโทเคน
        </p>
        <p className="mt-1 rounded-lg bg-amber-50 p-2 text-xs leading-relaxed text-amber-800">
          ⚠️ ต้องใส่ <b>ไอพีสาธารณะของสำนักงาน</b> ไม่ใช่เลขในวงแลนอย่าง 192.168.x.x
          — คำขอวิ่งออกไปทาง Cloudflare แล้ววนกลับเข้ามา เราจึงเห็นเป็นไอพีขาออกของสำนักงาน
          ใส่เลขวงแลนไว้จะกลายเป็นบล็อกระบบปลายทางเอง · ดูเลขที่ถูกได้จาก
          &ldquo;ใครมาอ่านล่าสุด&rdquo; ข้างล่างนี้ หลังให้ระบบปลายทางลองเรียกหนึ่งครั้ง
        </p>
        <textarea
          value={ips}
          onChange={(e) => setIps(e.target.value)}
          rows={2}
          placeholder="192.168.100.142"
          className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-sm"
        />

        <h3 className="mt-4 text-sm font-medium text-gray-700">ใครมาอ่านล่าสุด</h3>
        {Object.keys(log.reads).length === 0 ? (
          <p className="mt-1 text-xs text-gray-400">ยังไม่เคยมีระบบไหนมาดึงข้อมูล</p>
        ) : (
          <ul className="mt-1 space-y-1 text-xs text-gray-600">
            {Object.entries(log.reads).map(([key, read]) => (
              <li key={key} className="flex flex-wrap gap-x-2">
                <span className="font-mono text-gray-500">{key}</span>
                <span>{thaiTime(read.at)}</span>
                <span className="text-gray-400">
                  จาก {read.ip || "ไม่ทราบไอพี"} · รวม {read.count} ครั้ง
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---------- บันทึก ---------- */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          บันทึก
        </button>
        {status && (
          <span
            className={`text-sm ${status.kind === "ok" ? "text-emerald-600" : "text-rose-600"}`}
          >
            {status.text}
          </span>
        )}
      </div>
    </div>
  );
}
