"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, CloudDownload, Loader2, RefreshCw, Trash2 } from "lucide-react";

/**
 * ดึงกิจกรรมจากระบบสำนักงาน — เห็นก่อนว่ามีอะไร แล้ว **ติ๊กเลือกเป็นรายรายการ**
 *
 * เจ้าของเว็บสั่งไว้ 12 ก.ย. 2569 ว่าต้องเลือกได้เองว่าจะเอาอันไหนเข้า อันไหนให้ทับ
 * และอันไหนลบทิ้ง — ไม่ใช่กดทีเดียวเหมาทั้งชุด · ขั้นตอนกด "ดูรายการ" ก่อน
 * เหมือนปุ่มดึงวันหยุด (src/components/admin/HolidayImport.tsx) จะได้ไม่ต้องเรียนรู้สองแบบ
 */

type Item = {
  /** รหัสรายการที่เซิร์ฟเวอร์คำนวณมาให้ — หน้าจอไม่คำนวณเอง (ดู PreviewEvent) */
  key: string;
  date: string;
  type: "mobile" | "project" | "seminar";
  title: string;
  place: string;
  time: string;
  status: "new" | "same" | "changed";
  /** ของที่มีอยู่ในเว็บตอนนี้ — มีเฉพาะตอน status = same หรือ changed */
  current?: { id: string; title: string; place: string; time: string };
};

/** แถวในเว็บที่ต้นทางไม่มี — อาจเป็นของที่เจ้าหน้าที่พิมพ์เอง จึงต้องติ๊กลบทีละอัน */
type Extra = {
  id: string;
  date: string;
  type: string;
  title: string;
  place: string;
  time: string;
};

const TYPE_LABEL: Record<string, string> = {
  mobile: "รถโมบาย",
  project: "โครงการ",
  seminar: "สัมมนา",
};

const thaiDate = new Intl.DateTimeFormat("th-TH", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Bangkok",
});

const readable = (date: string) => {
  const d = new Date(`${date}T00:00:00+07:00`);
  return Number.isNaN(d.getTime()) ? date : thaiDate.format(d);
};

const describe = (row: { title: string; place: string; time: string }) =>
  [row.title, row.place, row.time].filter(Boolean).join(" · ");

/** ช่องติ๊กหนึ่งช่อง — ใช้ซ้ำทั้งสามกลุ่ม จะได้หน้าตาเหมือนกันหมด */
function Row({
  checked,
  onToggle,
  accent,
  children,
}: {
  checked: boolean;
  onToggle: () => void;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <li>
      <label className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-sm text-gray-700 transition hover:bg-white/70">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className={`mt-0.5 h-4 w-4 shrink-0 ${accent}`}
        />
        <span className="min-w-0 flex-1">{children}</span>
      </label>
    </li>
  );
}

export default function CalendarImport({ from }: { from: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "load" | "save">(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [items, setItems] = useState<Item[] | null>(null);
  const [extra, setExtra] = useState<Extra[]>([]);
  const [missing, setMissing] = useState<string[]>([]);

  /* ที่ติ๊กไว้ — เพิ่ม (รหัสจากต้นทาง) · ทับ (id ในเว็บ) · ลบ (id ในเว็บ) */
  const [addKeys, setAddKeys] = useState<Set<string>>(new Set());
  const [updateIds, setUpdateIds] = useState<Set<string>>(new Set());
  const [removeIds, setRemoveIds] = useState<Set<string>>(new Set());

  const toggle = (
    set: Set<string>,
    apply: (next: Set<string>) => void,
    value: string,
  ) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    apply(next);
  };

  async function load() {
    setBusy("load");
    setError("");
    setDone("");
    const response = await fetch("/api/admin/home/calendar/source/");
    const data = await response.json().catch(() => ({}));
    setBusy(null);

    if (!response.ok) {
      setItems(null);
      setError(data.error ?? "ดึงข้อมูลไม่สำเร็จ");
      return;
    }

    const list = (data.items ?? []) as Item[];
    setItems(list);
    setExtra((data.extra ?? []) as Extra[]);
    setMissing(data.missing ?? []);
    // ของใหม่ติ๊กไว้ให้เลย (ปกติก็อยากได้อยู่แล้ว) ส่วนทับกับลบต้องติ๊กเอง
    setAddKeys(new Set(list.filter((i) => i.status === "new").map((i) => i.key)));
    setUpdateIds(new Set());
    setRemoveIds(new Set());
  }

  async function apply() {
    if (removeIds.size > 0) {
      const ok = window.confirm(`ลบกิจกรรม ${removeIds.size} รายการออกจากเว็บถาวร — ยืนยันไหม`);
      if (!ok) return;
    }

    setBusy("save");
    setError("");
    const response = await fetch("/api/admin/home/calendar/source/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        addKeys: [...addKeys],
        updateIds: [...updateIds],
        removeIds: [...removeIds],
      }),
    });
    const data = await response.json().catch(() => ({}));
    setBusy(null);

    if (!response.ok) {
      setError(data.error ?? "บันทึกไม่สำเร็จ");
      return;
    }

    setItems(null);
    setExtra([]);
    const parts = [
      data.added ? `เพิ่ม ${data.added} รายการ` : "",
      data.changed ? `แก้ ${data.changed} รายการ` : "",
      data.removed ? `ลบ ${data.removed} รายการ` : "",
    ].filter(Boolean);
    setDone(parts.length > 0 ? parts.join(" · ") : (data.message ?? "ไม่ได้เลือกรายการไหนไว้"));
    router.refresh();
  }

  const added = items?.filter((i) => i.status === "new") ?? [];
  const changed = items?.filter((i) => i.status === "changed") ?? [];
  const same = items?.filter((i) => i.status === "same") ?? [];
  const picked = addKeys.size + updateIds.size + removeIds.size;

  return (
    <section className="mb-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <div className="flex flex-wrap items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
          <CloudDownload className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-gray-800">ดึงกิจกรรมจากระบบสำนักงาน</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            เอาตารางรถตู้ โครงการ และสัมมนาที่ลงไว้ในระบบสำนักงาน ({from}) มาลงปฏิทินหน้าแรก
            — กดดูรายการก่อน แล้ว<strong>ติ๊กเลือกเองว่าจะเอาอันไหน</strong>
            · เอาเฉพาะตั้งแต่ต้นเดือนนี้เป็นต้นไป
          </p>
        </div>
        <button
          onClick={load}
          disabled={busy !== null}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {busy === "load" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {items ? "ดูใหม่อีกครั้ง" : "ดูรายการ"}
        </button>
      </div>

      {error && (
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      {done && (
        <p className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          <Check className="h-4 w-4 shrink-0" /> {done}
        </p>
      )}

      {items && missing.length > 0 && (
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          ต้นทางส่งข้อมูล {missing.join(" กับ ")} มาไม่ได้ — รายการที่เห็นยังไม่ครบ
        </p>
      )}

      {items && (
        <div className="mt-3 space-y-4">
          <p className="text-sm text-gray-600">
            ระบบสำนักงานมี {items.length} รายการ — ใหม่ {added.length} · ต่างกัน {changed.length} ·
            ตรงกันอยู่แล้ว {same.length}
            {extra.length > 0 && <> · มีในเว็บแต่ต้นทางไม่มี {extra.length}</>}
          </p>

          {added.length > 0 && (
            <div className="rounded-xl bg-emerald-50/60 p-2">
              <p className="px-2 pb-1 text-xs font-semibold text-emerald-800">
                เพิ่มเข้าเว็บ — ติ๊กไว้ให้แล้ว เอาออกได้ถ้าไม่ต้องการ
              </p>
              <ul className="max-h-64 space-y-0.5 overflow-y-auto">
                {added.map((item) => (
                  <Row
                    key={item.key}
                    checked={addKeys.has(item.key)}
                    onToggle={() => toggle(addKeys, setAddKeys, item.key)}
                    accent="accent-emerald-600"
                  >
                    <span className="text-xs text-gray-500">{readable(item.date)}</span>{" "}
                    <span className="text-xs text-brand-600">{TYPE_LABEL[item.type]}</span>{" "}
                    {describe(item)}
                  </Row>
                ))}
              </ul>
            </div>
          )}

          {changed.length > 0 && (
            <div className="rounded-xl bg-amber-50/70 p-2">
              <p className="px-2 pb-1 text-xs font-semibold text-amber-900">
                รายละเอียดไม่ตรงกัน — ติ๊กเฉพาะอันที่ยอมให้ข้อมูลจากระบบสำนักงานทับ
              </p>
              <ul className="max-h-56 space-y-0.5 overflow-y-auto">
                {changed.map((item) => (
                  <Row
                    key={item.key}
                    checked={item.current ? updateIds.has(item.current.id) : false}
                    onToggle={() =>
                      item.current && toggle(updateIds, setUpdateIds, item.current.id)
                    }
                    accent="accent-amber-600"
                  >
                    <span className="text-xs text-gray-500">{readable(item.date)}</span>{" "}
                    <span className="text-gray-400 line-through">
                      {item.current ? describe(item.current) : ""}
                    </span>{" "}
                    → {describe(item)}
                  </Row>
                ))}
              </ul>
            </div>
          )}

          {extra.length > 0 && (
            <div className="rounded-xl bg-red-50/60 p-2">
              <p className="px-2 pb-1 text-xs font-semibold text-red-800">
                มีในเว็บ แต่ระบบสำนักงานไม่มี — ติ๊กอันที่จะลบทิ้ง
              </p>
              <p className="px-2 pb-1.5 text-[11px] text-red-700/80">
                ⚠️ กิจกรรมที่เจ้าหน้าที่พิมพ์เองในเว็บก็มาอยู่ตรงนี้ด้วย ดูให้แน่ก่อนติ๊ก · ลบแล้วเอาคืนไม่ได้
              </p>
              <ul className="max-h-56 space-y-0.5 overflow-y-auto">
                {extra.map((row) => (
                  <Row
                    key={row.id}
                    checked={removeIds.has(row.id)}
                    onToggle={() => toggle(removeIds, setRemoveIds, row.id)}
                    accent="accent-red-600"
                  >
                    <span className="text-xs text-gray-500">{readable(row.date)}</span>{" "}
                    <span className="text-xs text-brand-600">
                      {TYPE_LABEL[row.type] ?? row.type}
                    </span>{" "}
                    {describe(row)}
                  </Row>
                ))}
              </ul>
            </div>
          )}

          {added.length === 0 && changed.length === 0 && extra.length === 0 ? (
            <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-500">
              ตรงกับระบบสำนักงานอยู่แล้ว ไม่มีอะไรต้องทำ
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={apply}
                disabled={busy !== null || picked === 0}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
              >
                {busy === "save" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                ทำตามที่เลือก
              </button>
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                {addKeys.size > 0 && <span className="text-emerald-700">เพิ่ม {addKeys.size}</span>}
                {updateIds.size > 0 && <span className="text-amber-700">ทับ {updateIds.size}</span>}
                {removeIds.size > 0 && (
                  <span className="inline-flex items-center gap-1 text-red-700">
                    <Trash2 className="h-3.5 w-3.5" /> ลบ {removeIds.size}
                  </span>
                )}
                {picked === 0 && <span>ยังไม่ได้เลือกรายการไหน</span>}
              </span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
