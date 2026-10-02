"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FilePlus2,
  FileText,
  Loader2,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import RichText from "@/components/admin/RichText";
import { uploadWithProgress } from "@/lib/uploadClient";
import type { Block } from "@/lib/pageBlocks";
import {
  escHtml,
  fileOf,
  guessName,
  iconFor,
  nameExamples,
  nameFromFile,
  nameFromIsoDate,
  plainText,
  putIcon,
  readShape,
  renumber,
  sortFiles,
  swapDate,
} from "@/lib/tableFiles";

/**
 * จัดการไฟล์ในตารางดาวน์โหลดของ EditUI — ทำงานแบบเดียวกับหน้าอัปเดตประกาศ
 * (เจ้าของเว็บขอ 2 ต.ค. 2569 เพราะแก้ไฟล์ทีละแถวในตารางยากมาก)
 *
 * อัปไฟล์ → AI อ่านวันที่จากหน้าแรกของเอกสาร → เขียนชื่อรายการตามแบบแถวเดิมให้
 * → เจ้าหน้าที่ตรวจในกรอบฟ้า → กดบันทึกของหน้าเหมือนเดิม
 *
 * ⚠️ เนื้อหายังเก็บเป็นตาราง HTML ในหน้าเดิม ไม่มีตารางในฐานแยกออกไป หน้าเว็บจริงหน้าตาเหมือนเดิม
 * ⚠️ AI เติมให้เฉย ๆ ไม่บันทึกเอง · AI พลาด/ไม่มีคีย์ = ถอยไปใช้วิธีเดา (วันในชื่อไฟล์ → สิ้นเดือนถัดไป)
 */

type TableBlock = Extract<Block, { kind: "table" }>;

/** ลากไฟล์จากเครื่องเข้ามา (ไม่ใช่ลากตัวหนังสือในหน้า) */
export const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer.types).includes("Files");

const isPdf = (f: File) => /\.pdf$/i.test(f.name);

/** ให้ AI อ่านไฟล์ที่เพิ่งอัป — พลาดคืน null เงียบ ๆ แล้วไปใช้วิธีเดาแทน */
async function aiRead(url: string, examples: string[]) {
  const form = new FormData();
  form.append("url", url);
  form.append("target", "docRow");
  form.append("examples", JSON.stringify(examples));
  const res = await fetch("/api/admin/ai/read-image/", { method: "POST", body: form }).catch(() => null);
  if (!res?.ok) return null;
  const json = (await res.json().catch(() => null)) as { data?: { date?: string; title?: string } } | null;
  return json?.data ?? null;
}

/**
 * ตัวกลางของการแก้ตาราง — ใช้ร่วมกันทั้งตาราง (ลากมาวาง) และหน้าต่างจัดการแบบรายการ
 *
 * ⚠️ งานอัปเป็น async — ระหว่างรออาจมีคนพิมพ์แก้ช่องอื่นไปแล้ว จึงอ่านตาราง/ฟังก์ชันบันทึก
 * ตัวล่าสุดจาก ref ทุกครั้งที่จะเขียน ไม่ใช้ค่าที่จับไว้ตอนเริ่มอัป (ไม่งั้นทับของที่พิมพ์ไปหาย)
 */
export function useTableFiles(block: TableBlock, folder: string, onChange: (next: Block) => void) {
  const live = useRef({ block, onChange });
  useEffect(() => {
    live.current = { block, onChange };
  }, [block, onChange]);

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  /** ชื่อรายการที่ระบบเติมให้ — ยังตรงกับที่เติมไว้ = ยังไม่มีใครตรวจ ติดกรอบฟ้าไว้ */
  const [guessed, setGuessed] = useState<Set<string>>(() => new Set());

  const colsOf = (b: TableBlock) => Math.max(b.head.length, ...b.rows.map((r) => r.length), 1);
  const padded = (b: TableBlock) => {
    const cols = colsOf(b);
    return b.rows.map((r) => Array.from({ length: cols }, (_, i) => r[i] ?? ""));
  };

  /** แก้แถวของตารางตัวล่าสุด แล้วเรียงเลขลำดับใหม่ */
  const apply = (edit: (rows: string[][], cols: number) => string[][], renum = true) => {
    const b = live.current.block;
    const rows = edit(padded(b), colsOf(b));
    const next = { ...b, rows: renum ? renumber(rows, readShape(b.head, rows).numCol) : rows };
    live.current.block = next; // งานถัดไปในลูปเดียวกันต้องเห็นแถวที่เพิ่งเพิ่ม ก่อน React วาดใหม่
    live.current.onChange(next);
  };

  const mark = (html: string) => setGuessed((s) => new Set(s).add(plainText(html)));

  async function uploadOne(file: File, label: string) {
    setBusy(`${label} · 0%`);
    const form = new FormData();
    form.append("file", file);
    form.append("folder", folder);
    const result = await uploadWithProgress<{ url: string }>("/api/admin/upload/", form, (p) =>
      setBusy(`${label} · ${p}%`),
    );
    return result.ok ? result.data.url : null;
  }

  /** เพิ่มไฟล์เป็นแถวใหม่ — เรียงตามวันในชื่อไฟล์ เก่า→ใหม่ อัปและให้ AI อ่านทีละไฟล์ */
  async function addFiles(files: File[]) {
    const pdfs = files.filter(isPdf);
    setError(pdfs.length < files.length ? "รับเฉพาะไฟล์ PDF — ไฟล์อื่นถูกข้ามไป" : "");
    setNotice("");
    if (pdfs.length === 0 || busy) return;

    const queue = sortFiles(pdfs);
    const failed: string[] = [];
    let byAi = 0;
    for (const [i, file] of queue.entries()) {
      const label = queue.length > 1 ? `ไฟล์ ${i + 1}/${queue.length}` : "กำลังอัป";
      const url = await uploadOne(file, label);
      if (!url) {
        failed.push(file.name);
        continue;
      }

      const b = live.current.block;
      const shape = readShape(b.head, padded(b));
      setBusy(`${label} · AI กำลังอ่านวันที่…`);
      const ai = await aiRead(url, nameExamples(padded(b), shape));

      // ลำดับความเชื่อ: วันที่ที่ AI อ่านจากเอกสาร → ชื่อเรื่องที่ AI อ่าน (ตารางที่ไม่มีวันที่) → เดาเอง
      const fromAi = ai?.date ? nameFromIsoDate(shape.latest, ai.date) : null;
      const name = fromAi
        ? fromAi.name
        : !shape.latest && ai?.title?.trim()
          ? escHtml(ai.title.trim())
          : guessName(shape.latest, file.name).name;
      if (fromAi || (!shape.latest && ai?.title)) byAi += 1;

      const icon = iconFor(shape.icon, url, file.name);
      apply((rows, cols) => {
        const s = readShape(b.head, rows);
        const fresh = Array.from({ length: cols }, (_, k) =>
          k === s.fileCol ? icon : k === s.nameCol ? name : k === s.numCol ? "0." : "",
        );
        return s.atTop ? [fresh, ...rows] : [...rows, fresh];
      });
      mark(name);
    }

    setBusy(null);
    if (failed.length > 0) setError(`อัปไม่สำเร็จ: ${failed.join(", ")}`);
    const added = queue.length - failed.length;
    if (added > 0) {
      setNotice(
        `เพิ่ม ${added} ไฟล์แล้ว · ` +
          (byAi === added
            ? "AI อ่านวันที่จากเอกสารให้ครบทุกไฟล์"
            : byAi > 0
              ? `AI อ่านได้ ${byAi} ไฟล์ ที่เหลือเดาจากชื่อไฟล์/เดือนถัดไป`
              : "AI อ่านไม่ได้ ชื่อเดาจากชื่อไฟล์/เดือนถัดไป") +
          " — ตรวจชื่อในกรอบฟ้า แล้วกดบันทึกของหน้า",
      );
    }
  }

  /** เปลี่ยนไฟล์ของแถวเดิม — AI อ่านวันที่ได้และต่างจากเดิม ก็เปลี่ยนวันที่ในชื่อให้ด้วย */
  async function replaceFile(row: number, file: File) {
    setNotice("");
    if (!isPdf(file)) {
      setError("รับเฉพาะไฟล์ PDF");
      return;
    }
    if (busy) return;
    setError("");
    const url = await uploadOne(file, `เปลี่ยนไฟล์แถวที่ ${row + 1}`);
    if (!url) {
      setBusy(null);
      setError(`อัป ${file.name} ไม่สำเร็จ`);
      return;
    }
    const b = live.current.block;
    const shape = readShape(b.head, padded(b));
    setBusy("AI กำลังอ่านวันที่…");
    const ai = await aiRead(url, nameExamples(padded(b), shape));
    setBusy(null);

    let renamed: string | null = null;
    apply((rows) => {
      const s = readShape(b.head, rows);
      return rows.map((r, n) => {
        if (n !== row) return r;
        renamed = ai?.date ? swapDate(r[s.nameCol] ?? "", ai.date) : null;
        return r.map((c, k) =>
          k === s.fileCol ? putIcon(c, iconFor(s.icon, url, file.name)) : k === s.nameCol && renamed ? renamed : c,
        );
      });
    }, false);
    if (renamed) mark(renamed);
    setNotice(
      renamed
        ? `เปลี่ยนไฟล์แถวที่ ${row + 1} แล้ว · AI เปลี่ยนวันที่ในชื่อตามเอกสารให้ ตรวจในกรอบฟ้า`
        : `เปลี่ยนไฟล์แถวที่ ${row + 1} แล้ว — กดบันทึกของหน้าด้วย`,
    );
  }

  const moveRow = (from: number, to: number) =>
    apply((rows) => {
      if (to < 0 || to >= rows.length) return rows;
      const next = [...rows];
      [next[from], next[to]] = [next[to], next[from]];
      return next;
    });

  const removeRow = (at: number) => {
    const b = live.current.block;
    const name = plainText(b.rows[at]?.[readShape(b.head, b.rows).nameCol] ?? "") || `แถวที่ ${at + 1}`;
    if (!confirm(`ลบแถว “${name}” ?`)) return;
    apply((rows, cols) => {
      const next = rows.filter((_, n) => n !== at);
      return next.length ? next : [Array(cols).fill("")];
    });
  };

  const setCell = (row: number, col: number, html: string) =>
    apply((rows) => rows.map((r, n) => (n === row ? r.map((c, k) => (k === col ? html : c)) : r)), false);

  return { busy, error, notice, guessed, addFiles, replaceFile, moveRow, removeRow, setCell };
}

export type TableFiles = ReturnType<typeof useTableFiles>;

/* ------------------------------------------------------------------ *
 * หน้าต่างจัดการแบบรายการ — หน้าตาแบบหน้าอัปเดตประกาศ
 * ------------------------------------------------------------------ */

export default function TableFilesManager({
  block,
  api,
  onClose,
}: {
  block: TableBlock;
  api: TableFiles;
  onClose: () => void;
}) {
  const [over, setOver] = useState<number | null>(null);
  const cols = Math.max(block.head.length, ...block.rows.map((r) => r.length), 1);
  const rows = block.rows.map((r) => Array.from({ length: cols }, (_, i) => r[i] ?? ""));
  const shape = readShape(block.head, rows);
  const { busy } = api;

  // Esc ปิดหน้าต่าง — แต่ไม่ปิดระหว่างอัป จะได้ไม่นึกว่าไฟล์หาย
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [busy, onClose]);

  /** กันเหตุการณ์ลากไหลขึ้นไปถึงตารางข้างหลัง (portal ยังส่งต่อเหตุการณ์ตามโครงของ React) */
  const dropHandlers = (target: number) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      e.stopPropagation();
      setOver(target);
    },
    onDragLeave: (e: React.DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null);
    },
    onDrop: (e: React.DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      e.stopPropagation();
      setOver(null);
      const files = Array.from(e.dataTransfer.files);
      if (target === -1) void api.addFiles(files);
      else if (files[0]) void api.replaceFile(target, files[0]);
    },
  });

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-xl" role="dialog" aria-label="จัดการไฟล์ในตาราง">
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-gray-800">จัดการไฟล์ในตาราง</h2>
            <p className="text-sm text-gray-500">
              เพิ่ม เปลี่ยน หรือลบไฟล์ได้ที่นี่ · ทุกอย่างยังไม่ขึ้นเว็บจนกว่าจะกด
              <strong className="text-gray-700"> บันทึก </strong>ของหน้า
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={!!busy}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-40"
            title="ปิด"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {/* ช่องเพิ่มไฟล์ — แบบเดียวกับช่องอัปไฟล์ของหน้าประกาศ */}
          <label
            {...dropHandlers(-1)}
            className={`flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-6 text-center transition ${
              over === -1 ? "border-brand-500 bg-brand-50" : "border-gray-300 bg-gray-50 hover:border-brand-400"
            } ${busy ? "pointer-events-none opacity-70" : ""}`}
          >
            {busy ? (
              <Loader2 className="h-7 w-7 animate-spin text-brand-600" />
            ) : (
              <FilePlus2 className="h-7 w-7 text-brand-600" />
            )}
            <span className="font-semibold text-gray-700">
              {busy ?? "ลากไฟล์ PDF มาวางที่นี่ หรือกดเพื่อเลือกไฟล์"}
            </span>
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <Sparkles className="h-3.5 w-3.5" /> AI อ่านวันที่จากเอกสาร แล้วเขียนชื่อรายการตามแบบแถวเดิมให้ ·
              เพิ่มหลายไฟล์พร้อมกันได้ · {shape.atTop ? "แถวใหม่ขึ้นบนสุด" : "แถวใหม่ต่อท้าย"}
            </span>
            <input
              type="file"
              accept=".pdf,application/pdf"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                e.target.value = "";
                if (files.length > 0) void api.addFiles(files);
              }}
            />
          </label>

          {api.error && <p className="text-sm text-red-700">{api.error}</p>}
          {api.notice && <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">{api.notice}</p>}

          <ul className="grid grid-cols-1 gap-2">
            {rows.map((row, r) => {
              const file = fileOf(row[shape.fileCol] ?? "");
              const name = row[shape.nameCol] ?? "";
              const guess = api.guessed.has(plainText(name));
              return (
                <li
                  key={r}
                  {...dropHandlers(r)}
                  className={`min-w-0 rounded-xl border p-3 transition ${
                    over === r ? "border-brand-500 bg-brand-50" : "border-gray-200 bg-white"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-1 w-8 shrink-0 text-center text-sm font-semibold text-gray-400">
                      {shape.numCol >= 0 ? plainText(row[shape.numCol] ?? "") : r + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <RichText
                        as="div"
                        singleLine
                        value={name}
                        onChange={(html) => api.setCell(r, shape.nameCol, html)}
                        placeholder="ชื่อรายการ"
                        className={`rounded-md px-2 py-1 text-[15px] text-gray-800 outline-none ring-1 focus:ring-2 focus:ring-brand-500 ${
                          guess ? "bg-brand-50 ring-brand-300" : "ring-gray-200"
                        }`}
                      />
                      {guess && (
                        <p className="mt-1 text-xs text-brand-700">ระบบเติมให้ — ตรวจวันที่ให้ถูก แก้ได้โดยคลิกพิมพ์ทับ</p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                        <span className="flex min-w-0 items-center gap-1 text-gray-500">
                          <FileText className="h-3.5 w-3.5 shrink-0 text-purple-600" />
                          <span className="truncate" title={file?.name}>
                            {file ? nameFromFile(file.name) + ".pdf" : "ยังไม่มีไฟล์"}
                          </span>
                        </span>
                        {file && (
                          <a
                            href={file.href}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-1 text-gray-700 hover:bg-gray-200"
                          >
                            <ExternalLink className="h-3.5 w-3.5" /> เปิดดู
                          </a>
                        )}
                        <label
                          className={`inline-flex cursor-pointer items-center gap-1 rounded-md bg-brand-600 px-2 py-1 text-white hover:bg-brand-700 ${
                            busy ? "pointer-events-none opacity-50" : ""
                          }`}
                        >
                          <RefreshCw className="h-3.5 w-3.5" /> {file ? "เปลี่ยนไฟล์" : "ใส่ไฟล์"}
                          <input
                            type="file"
                            accept=".pdf,application/pdf"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              e.target.value = "";
                              if (f) void api.replaceFile(r, f);
                            }}
                          />
                        </label>
                        <span className="text-gray-400">หรือลากไฟล์มาวางที่การ์ดนี้</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col gap-1">
                      <button
                        type="button"
                        title="เลื่อนขึ้น"
                        disabled={r === 0 || !!busy}
                        onClick={() => api.moveRow(r, r - 1)}
                        className="rounded-md p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        title="เลื่อนลง"
                        disabled={r === rows.length - 1 || !!busy}
                        onClick={() => api.moveRow(r, r + 1)}
                        className="rounded-md p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        title="ลบแถวนี้"
                        disabled={!!busy}
                        onClick={() => api.removeRow(r)}
                        className="rounded-md p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-3">
          <span className="mr-auto text-xs text-gray-500">แก้แล้วต้องกดบันทึกของหน้าด้วย ถึงจะขึ้นเว็บจริง</span>
          <button
            type="button"
            onClick={onClose}
            disabled={!!busy}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            เสร็จ
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
