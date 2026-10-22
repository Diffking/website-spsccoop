"use client";

import {
  ArrowDown,
  ArrowUp,
  Copy,
  EyeOff,
  Lock,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import {
  HAS_OPTIONS,
  KIND_HINT,
  KIND_LABEL,
  STANDARD_COLUMNS,
  newId,
  type GridColumn,
  type ItemKind,
  type Option,
  type SurveyItem,
} from "@/lib/survey";

/**
 * รหัสของที่ "มีคนตอบไปแล้ว" — ลบหรือเปลี่ยนชนิดไม่ได้ (กฎเดียวกับ lockViolations ฝั่ง API)
 * ปิดปุ่มไว้ตั้งแต่หน้าจอ จะได้ไม่ต้องกดบันทึกแล้วค่อยโดนปฏิเสธ
 */
export type Locks = { items: Set<string>; parts: Set<string> };

const KINDS = Object.keys(KIND_LABEL) as ItemKind[];

const input =
  "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition focus:border-brand-400";

/** ไอคอนวงกลม/สี่เหลี่ยมหน้าตัวเลือก ให้เห็นชัดว่าเลือกได้ข้อเดียวหรือหลายข้อ */
function Bullet({ kind, index }: { kind: ItemKind; index: number }) {
  if (kind === "dropdown") return <span className="w-5 shrink-0 text-right text-xs text-gray-400">{index + 1}.</span>;
  return (
    <span
      className={`h-4 w-4 shrink-0 border-2 border-gray-300 ${kind === "checkbox" ? "rounded" : "rounded-full"}`}
    />
  );
}

/** รายการที่แก้ได้ทีละบรรทัด — ใช้กับตัวเลือกและหัวข้อของตาราง */
function ListEditor({
  list,
  onChange,
  prefix,
  locks,
  bullet,
  addLabel,
  placeholder,
}: {
  list: Option[];
  onChange: (next: Option[]) => void;
  prefix: string;
  locks: Locks;
  bullet: (index: number) => React.ReactNode;
  addLabel: string;
  placeholder: (index: number) => string;
}) {
  const set = (i: number, label: string) => onChange(list.map((o, j) => (j === i ? { ...o, label } : o)));
  const move = (i: number, by: number) => {
    const j = i + by;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className="space-y-1.5">
      {list.map((o, i) => {
        const locked = locks.parts.has(o.id);
        return (
          <div key={o.id} className="group flex items-center gap-2">
            {bullet(i)}
            <input
              value={o.label}
              onChange={(e) => set(i, e.target.value)}
              placeholder={placeholder(i)}
              className="min-w-0 flex-1 border-b border-transparent bg-transparent py-1 text-sm outline-none transition hover:border-gray-200 focus:border-brand-400"
            />
            <span className="flex shrink-0 opacity-40 transition group-hover:opacity-100">
              <button type="button" onClick={() => move(i, -1)} title="เลื่อนขึ้น" className="rounded p-1 text-gray-400 hover:text-brand-600">
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={() => move(i, 1)} title="เลื่อนลง" className="rounded p-1 text-gray-400 hover:text-brand-600">
                <ArrowDown className="h-3.5 w-3.5" />
              </button>
              {locked ? (
                <span title="มีคนตอบแล้ว ลบไม่ได้ (แก้ถ้อยคำได้)" className="p-1 text-gray-300">
                  <Lock className="h-3.5 w-3.5" />
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => onChange(list.filter((_, j) => j !== i))}
                  title="ลบ"
                  className="rounded p-1 text-gray-400 hover:text-red-500"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </span>
          </div>
        );
      })}
      <button
        type="button"
        onClick={() => onChange([...list, { id: newId(prefix), label: "" }])}
        className="inline-flex items-center gap-1 rounded-lg px-1 py-1 text-sm text-brand-600 transition hover:text-brand-800"
      >
        <Plus className="h-4 w-4" /> {addLabel}
      </button>
    </div>
  );
}

/** ระดับคะแนนของตาราง — ชื่อ · คะแนน · ติ๊กว่าเป็นช่อง "ไม่ประเมิน" */
function ColumnsEditor({
  columns,
  onChange,
  locks,
}: {
  columns: GridColumn[];
  onChange: (next: GridColumn[]) => void;
  locks: Locks;
}) {
  const set = (i: number, patch: Partial<GridColumn>) =>
    onChange(columns.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  return (
    <div className="space-y-1.5">
      {columns.map((c, i) => {
        const locked = locks.parts.has(c.id);
        return (
          <div key={c.id} className="flex flex-wrap items-center gap-2">
            <input
              value={c.label}
              onChange={(e) => set(i, { label: e.target.value })}
              placeholder="ชื่อระดับ เช่น มากที่สุด"
              className={`${input} min-w-0 flex-1 py-1.5`}
            />
            <label className="flex items-center gap-1 text-xs text-gray-500" title={locked ? "มีคนตอบแล้ว เปลี่ยนคะแนนไม่ได้" : undefined}>
              คะแนน
              <input
                type="number"
                value={c.score}
                disabled={locked || c.na}
                onChange={(e) => set(i, { score: Math.round(Number(e.target.value) || 0) })}
                className="w-14 rounded-lg border border-gray-200 px-2 py-1.5 text-center text-sm outline-none focus:border-brand-400 disabled:bg-gray-50 disabled:text-gray-400"
              />
            </label>
            <label
              className="flex items-center gap-1 text-xs text-gray-500"
              title="ช่องนี้ไม่นำไปคิดค่าเฉลี่ย เช่น ไม่ได้ใช้บริการ / ไม่ทราบว่ามี"
            >
              <input
                type="checkbox"
                checked={c.na}
                disabled={locked}
                onChange={(e) => set(i, { na: e.target.checked })}
                className="h-4 w-4 accent-brand-600"
              />
              ไม่ประเมิน
            </label>
            {locked ? (
              <span title="มีคนตอบแล้ว ลบไม่ได้" className="p-1 text-gray-300">
                <Lock className="h-3.5 w-3.5" />
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onChange(columns.filter((_, j) => j !== i))}
                title="ลบระดับนี้"
                className="rounded p-1 text-gray-400 hover:text-red-500"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        );
      })}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            const scores = columns.filter((c) => !c.na).map((c) => c.score);
            const next = scores.length ? Math.min(...scores) - 1 : 5;
            onChange([...columns, { id: newId("c"), label: "", score: next, na: false }]);
          }}
          className="inline-flex items-center gap-1 rounded-lg px-1 py-1 text-sm text-brand-600 transition hover:text-brand-800"
        >
          <Plus className="h-4 w-4" /> เพิ่มระดับคะแนน
        </button>
        {!columns.some((c) => c.na) && (
          <button
            type="button"
            onClick={() => onChange([...columns, { id: newId("c"), label: "ไม่ได้ใช้บริการ", score: 0, na: true }])}
            className="inline-flex items-center gap-1 rounded-lg px-1 py-1 text-sm text-gray-500 transition hover:text-brand-700"
          >
            <Plus className="h-4 w-4" /> เพิ่มช่อง &quot;ไม่ประเมิน (0)&quot;
          </button>
        )}
      </div>
    </div>
  );
}

/** หน้าตาย่อของข้อที่ยังไม่ได้เลือก — คล้ายที่สมาชิกจะเห็น แต่กดไม่ได้ */
function Preview({ item }: { item: SurveyItem }) {
  if (HAS_OPTIONS.includes(item.kind)) {
    const shown = item.options.slice(0, 6);
    return (
      <ul className="mt-2 space-y-1 text-sm text-gray-600">
        {shown.map((o, i) => (
          <li key={o.id} className="flex items-center gap-2">
            <Bullet kind={item.kind} index={i} />
            <span className="min-w-0 truncate">{o.label || <i className="text-gray-300">ว่าง</i>}</span>
          </li>
        ))}
        {item.options.length > shown.length && (
          <li className="pl-6 text-xs text-gray-400">และอีก {item.options.length - shown.length} ตัวเลือก</li>
        )}
        {item.allowOther && (
          <li className="flex items-center gap-2 text-gray-400">
            <Bullet kind={item.kind} index={item.options.length} /> อื่น ๆ (โปรดระบุ)
          </li>
        )}
      </ul>
    );
  }
  if (item.kind === "grid") {
    return (
      <p className="mt-2 text-xs text-gray-500">
        {item.rows.length} หัวข้อ × {item.columns.length} ระดับ (
        {item.columns.map((c) => (c.na ? `${c.label} ไม่นับ` : `${c.label} ${c.score}`)).join(" · ")})
      </p>
    );
  }
  if (item.kind === "scale") {
    return (
      <p className="mt-2 text-xs text-gray-500">
        {item.scaleMin} {item.scaleMinLabel && `(${item.scaleMinLabel})`} ถึง {item.scaleMax}{" "}
        {item.scaleMaxLabel && `(${item.scaleMaxLabel})`}
      </p>
    );
  }
  if (item.kind === "section") return null;
  return <p className="mt-2 border-b border-dashed border-gray-200 pb-1 text-xs text-gray-400">{KIND_HINT[item.kind]}</p>;
}

export default function SurveyItemCard({
  item,
  number,
  active,
  locks,
  first,
  last,
  onActivate,
  onChange,
  onMove,
  onDuplicate,
  onRemove,
}: {
  item: SurveyItem;
  /** เลขข้อที่สมาชิกเห็น — หัวตอนกับข้อที่ซ่อนไม่มีเลข */
  number: number | null;
  active: boolean;
  locks: Locks;
  first: boolean;
  last: boolean;
  onActivate: () => void;
  onChange: (next: SurveyItem) => void;
  onMove: (by: number) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const locked = locks.items.has(item.id);
  const set = (patch: Partial<SurveyItem>) => onChange({ ...item, ...patch });
  const isSection = item.kind === "section";

  /** เปลี่ยนชนิด — เติมตัวเลือก/แถวตั้งต้นให้ถ้าชนิดใหม่ต้องใช้แต่ยังไม่มี */
  function changeKind(kind: ItemKind) {
    const next: SurveyItem = { ...item, kind, required: kind === "section" ? false : item.required };
    if (HAS_OPTIONS.includes(kind) && next.options.length === 0) {
      next.options = [
        { id: newId("o"), label: "ตัวเลือกที่ 1" },
        { id: newId("o"), label: "ตัวเลือกที่ 2" },
      ];
    }
    if (kind === "grid" && next.rows.length === 0) {
      next.rows = [{ id: newId("r"), label: "หัวข้อที่ 1" }];
    }
    if (kind === "grid" && next.columns.length === 0) {
      next.columns = STANDARD_COLUMNS.map((c) => ({ ...c, id: newId("c") }));
    }
    if (kind === "scale" && !next.scaleMinLabel && !next.scaleMaxLabel) {
      next.scaleMinLabel = "น้อยที่สุด";
      next.scaleMaxLabel = "มากที่สุด";
    }
    onChange(next);
  }

  return (
    <div
      onClick={active ? undefined : onActivate}
      className={`relative overflow-hidden rounded-2xl bg-white shadow-sm ring-1 transition ${
        active ? "ring-2 ring-brand-400" : "cursor-pointer ring-black/5 hover:ring-brand-200"
      } ${item.hidden ? "opacity-60" : ""}`}
    >
      {/* แถบสีซ้าย — หัวตอนใช้สีเข้ม ให้เห็นว่าเป็นตัวแบ่งตอน ไม่ใช่คำถาม */}
      <span
        className={`absolute inset-y-0 left-0 w-1.5 ${isSection ? "bg-brand-700" : active ? "bg-brand-400" : "bg-transparent"}`}
      />

      <div className="p-4 pl-5">
        {/* ---------- หัวการ์ด ---------- */}
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          {number !== null && (
            <span className="rounded-full bg-brand-50 px-2 py-0.5 font-semibold text-brand-700">ข้อ {number}</span>
          )}
          <span className="text-gray-400">{KIND_LABEL[item.kind]}</span>
          {item.required && !isSection && <span className="text-red-500">* บังคับตอบ</span>}
          {item.hidden && (
            <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-gray-500">
              <EyeOff className="h-3 w-3" /> ซ่อนอยู่
            </span>
          )}
          {item.noReport && (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">ไม่นำไปสรุปผล</span>
          )}
          {locked && (
            <span className="inline-flex items-center gap-1 text-gray-400" title="มีคนตอบแล้ว — แก้ถ้อยคำได้ ลบ/เปลี่ยนชนิดไม่ได้">
              <Lock className="h-3 w-3" /> มีคนตอบแล้ว
            </span>
          )}
        </div>

        {!active ? (
          <>
            <p className={`mt-1.5 ${isSection ? "text-base font-bold text-brand-800" : "text-sm font-medium text-gray-800"}`}>
              {item.title || <i className="font-normal text-gray-300">ยังไม่ได้พิมพ์{isSection ? "หัวตอน" : "คำถาม"}</i>}
            </p>
            {item.description && <p className="mt-0.5 text-xs text-gray-500">{item.description}</p>}
            <Preview item={item} />
          </>
        ) : (
          <div className="mt-2 space-y-3">
            {/* ---------- คำถาม + ชนิด ---------- */}
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_13rem]">
              <textarea
                value={item.title}
                onChange={(e) => set({ title: e.target.value })}
                rows={2}
                autoFocus
                placeholder={isSection ? "ชื่อหัวตอน เช่น ตอนที่ 2 ความพึงพอใจด้านต่าง ๆ" : "พิมพ์คำถาม"}
                className={`${input} resize-y bg-gray-50 ${isSection ? "font-bold" : "font-medium"}`}
              />
              <select
                value={item.kind}
                disabled={locked}
                onChange={(e) => changeKind(e.target.value as ItemKind)}
                title={locked ? "มีคนตอบแล้ว เปลี่ยนชนิดไม่ได้" : KIND_HINT[item.kind]}
                className={`${input} h-fit bg-white disabled:bg-gray-50 disabled:text-gray-500`}
              >
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABEL[k]}
                  </option>
                ))}
              </select>
            </div>
            <input
              value={item.description}
              onChange={(e) => set({ description: e.target.value })}
              placeholder="คำอธิบายเพิ่มเติม (เว้นว่างได้)"
              className={`${input} text-xs`}
            />

            {/* ---------- เนื้อในตามชนิด ---------- */}
            {HAS_OPTIONS.includes(item.kind) && (
              <div className="rounded-xl bg-gray-50/70 p-3">
                <ListEditor
                  list={item.options}
                  onChange={(options) => set({ options })}
                  prefix="o"
                  locks={locks}
                  bullet={(i) => <Bullet kind={item.kind} index={i} />}
                  addLabel="เพิ่มตัวเลือก"
                  placeholder={(i) => `ตัวเลือกที่ ${i + 1}`}
                />
                {item.kind !== "dropdown" && (
                  <label
                    className="mt-2 flex items-center gap-2 text-sm text-gray-600"
                    title={locks.parts.has(`${item.id}:other`) ? "มีคนตอบแล้ว ปิดไม่ได้" : undefined}
                  >
                    <input
                      type="checkbox"
                      checked={item.allowOther}
                      disabled={item.allowOther && locks.parts.has(`${item.id}:other`)}
                      onChange={(e) => set({ allowOther: e.target.checked })}
                      className="h-4 w-4 accent-brand-600"
                    />
                    มีตัวเลือก &quot;อื่น ๆ (โปรดระบุ)&quot; ให้พิมพ์เอง
                  </label>
                )}
              </div>
            )}

            {item.kind === "grid" && (
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl bg-gray-50/70 p-3">
                  <p className="mb-2 text-xs font-semibold text-gray-500">หัวข้อที่ให้คะแนน (แถว)</p>
                  <ListEditor
                    list={item.rows}
                    onChange={(rows) => set({ rows })}
                    prefix="r"
                    locks={locks}
                    bullet={(i) => <span className="w-5 shrink-0 text-right text-xs text-gray-400">{i + 1}.</span>}
                    addLabel="เพิ่มหัวข้อ"
                    placeholder={(i) => `หัวข้อที่ ${i + 1}`}
                  />
                </div>
                <div className="rounded-xl bg-gray-50/70 p-3">
                  <p className="mb-2 text-xs font-semibold text-gray-500">ระดับคะแนน (คอลัมน์)</p>
                  <ColumnsEditor columns={item.columns} onChange={(columns) => set({ columns })} locks={locks} />
                  <p className="mt-2 text-[11px] leading-relaxed text-gray-400">
                    ช่องที่ติ๊ก &quot;ไม่ประเมิน&quot; เช่น ไม่ได้ใช้บริการ / ไม่ทราบว่ามี จะไม่ถูกนำไปคิดค่าเฉลี่ย
                    แต่รายงานจะนับให้แยกว่ามีกี่คน
                  </p>
                </div>
              </div>
            )}

            {item.kind === "scale" && (
              <div className="grid gap-2 rounded-xl bg-gray-50/70 p-3 sm:grid-cols-2">
                <label className="block text-xs text-gray-500">
                  คะแนนต่ำสุด
                  <select
                    value={item.scaleMin}
                    disabled={locked}
                    onChange={(e) => set({ scaleMin: Number(e.target.value) })}
                    className={`${input} mt-1 bg-white`}
                  >
                    <option value={0}>0</option>
                    <option value={1}>1</option>
                  </select>
                </label>
                <label className="block text-xs text-gray-500">
                  คะแนนสูงสุด
                  <select
                    value={item.scaleMax}
                    disabled={locked}
                    onChange={(e) => set({ scaleMax: Number(e.target.value) })}
                    className={`${input} mt-1 bg-white`}
                  >
                    {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                <input
                  value={item.scaleMinLabel}
                  onChange={(e) => set({ scaleMinLabel: e.target.value })}
                  placeholder="ป้ายคะแนนต่ำสุด เช่น น้อยที่สุด"
                  className={`${input} bg-white`}
                />
                <input
                  value={item.scaleMaxLabel}
                  onChange={(e) => set({ scaleMaxLabel: e.target.value })}
                  placeholder="ป้ายคะแนนสูงสุด เช่น มากที่สุด"
                  className={`${input} bg-white`}
                />
              </div>
            )}

            {/* ---------- แถบท้ายการ์ด ---------- */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-gray-100 pt-3 text-sm">
              {!isSection && (
                <label className="flex items-center gap-2 text-gray-600">
                  <input
                    type="checkbox"
                    checked={item.required}
                    onChange={(e) => set({ required: e.target.checked })}
                    className="h-4 w-4 accent-brand-600"
                  />
                  บังคับตอบ
                </label>
              )}
              {!isSection && (
                <label className="flex items-center gap-2 text-gray-600" title="เก็บคำตอบไว้ดูได้ แต่ไม่ขึ้นกราฟใน Dashboard">
                  <input
                    type="checkbox"
                    checked={item.noReport}
                    onChange={(e) => set({ noReport: e.target.checked })}
                    className="h-4 w-4 accent-brand-600"
                  />
                  ไม่นำไปสรุปผล
                </label>
              )}
              <label className="flex items-center gap-2 text-gray-600" title="สมาชิกจะไม่เห็นข้อนี้ — คำตอบเดิมยังเก็บไว้ครบ">
                <input
                  type="checkbox"
                  checked={item.hidden}
                  onChange={(e) => set({ hidden: e.target.checked })}
                  className="h-4 w-4 accent-brand-600"
                />
                ซ่อนข้อนี้
              </label>

              <span className="ml-auto flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => onMove(-1)}
                  disabled={first}
                  title="เลื่อนขึ้น"
                  className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-brand-600 disabled:opacity-30"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onMove(1)}
                  disabled={last}
                  title="เลื่อนลง"
                  className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-brand-600 disabled:opacity-30"
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={onDuplicate}
                  title="ทำสำเนาข้อนี้"
                  className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-brand-600"
                >
                  <Copy className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={onRemove}
                  disabled={locked}
                  title={locked ? "มีคนตอบแล้ว ลบไม่ได้ — ใช้ \"ซ่อนข้อนี้\" แทน" : "ลบข้อนี้"}
                  className="rounded-lg p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-500 disabled:opacity-30"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
