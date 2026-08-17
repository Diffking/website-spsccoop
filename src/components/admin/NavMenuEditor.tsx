"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, FilePlus2, Loader2, Plus, RotateCcw, Save, SquareArrowOutUpRight, Trash2 } from "lucide-react";
import type { NavNode } from "@/lib/nav";
import { linkStatus, STATUS_STYLE, toSlug, type LinkStatus } from "@/lib/siteRoutes";

/** หน้าเนื้อหาที่มีอยู่ในฐาน — ใช้เช็คว่าเมนูชี้ไปหน้าที่มีจริงไหม */
export type PageRef = { id: string; slug: string; title: string; published: boolean };

/**
 * แก้เมนูนำทางบนหัวเว็บ — ลึกได้ 3 ชั้น (เมนู → เมนูย่อย → เมนูย่อยของย่อย)
 *
 * แก้ทั้งต้นไม้ในหน้าจอแล้วกดบันทึกทีเดียว ไม่บันทึกอัตโนมัติรายช่อง เพราะเมนูผิดพลาด
 * ทีเดียวกระทบทุกหน้าของเว็บ ให้ผู้ใช้ได้ตรวจก่อนกดบันทึก
 */

const MAX_DEPTH = 3;

/** แก้ค่าที่ path ที่ระบุ (เช่น [0,2] = เมนูที่ 1 → เมนูย่อยที่ 3) แล้วคืนต้นไม้ก้อนใหม่ */
function updateAt(nodes: NavNode[], path: number[], fn: (node: NavNode) => NavNode | null): NavNode[] {
  const [head, ...rest] = path;
  return nodes.flatMap((node, i) => {
    if (i !== head) return [node];
    if (rest.length === 0) {
      const next = fn(node);
      return next ? [next] : [];
    }
    const children = updateAt(node.children ?? [], rest, fn);
    return [{ ...node, children: children.length > 0 ? children : undefined }];
  });
}

/** สลับตำแหน่งรายการในระดับที่ path ชี้ไป */
function moveAt(nodes: NavNode[], path: number[], step: number): NavNode[] {
  const parent = path.slice(0, -1);
  const index = path[path.length - 1];

  const swap = (list: NavNode[]): NavNode[] => {
    const target = index + step;
    if (target < 0 || target >= list.length) return list;
    const copy = [...list];
    [copy[index], copy[target]] = [copy[target], copy[index]];
    return copy;
  };

  if (parent.length === 0) return swap(nodes);
  return updateAt(nodes, parent, (node) => ({ ...node, children: swap(node.children ?? []) }));
}

function Row({
  node,
  path,
  depth,
  siblings,
  pages,
  creating,
  onChange,
  onMove,
  onRemove,
  onAddChild,
  onCreatePage,
}: {
  node: NavNode;
  path: number[];
  depth: number;
  siblings: number;
  pages: PageRef[];
  creating: string | null;
  onChange: (path: number[], patch: Partial<NavNode>) => void;
  onMove: (path: number[], step: number) => void;
  onRemove: (path: number[]) => void;
  onAddChild: (path: number[]) => void;
  onCreatePage: (href: string, label: string) => void;
}) {
  const [open, setOpen] = useState(depth === 0);
  const index = path[path.length - 1];
  const children = node.children ?? [];

  const status: LinkStatus = linkStatus(node.href, pages);
  const style = STATUS_STYLE[status];
  const page = pages.find((p) => p.slug === toSlug(node.href));

  return (
    <li className="rounded-xl bg-white ring-1 ring-black/5">
      <div className="flex flex-wrap items-center gap-2 p-2.5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "ย่อเมนูย่อย" : "กางเมนูย่อย"}
          className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 ${
            children.length === 0 ? "invisible" : ""
          }`}
        >
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>

        <input
          value={node.label}
          onChange={(e) => onChange(path, { label: e.target.value })}
          placeholder="ชื่อเมนู"
          className="min-w-40 flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-brand-400"
        />
        <input
          value={node.href}
          onChange={(e) => onChange(path, { href: e.target.value })}
          list="nav-page-paths"
          placeholder={children.length > 0 ? "เว้นว่าง = เป็นหัวข้อเฉย ๆ" : "/downloads"}
          className="min-w-40 flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 outline-none focus:border-brand-400"
        />

        {/* บอกทันทีว่าลิงก์นี้กดแล้วไปถึงหน้าจริงไหม ไม่ต้องรอคนโทรมาบอกว่าเจอ 404 */}
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${style.className}`}
        >
          {style.label}
        </span>

        {status === "missing" && (
          <button
            type="button"
            onClick={() => onCreatePage(node.href, node.label)}
            disabled={creating === node.href}
            title="สร้างหน้าเนื้อหาว่าง ๆ ที่ที่อยู่นี้"
            className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-brand-600 px-2 py-1 text-[11px] font-medium text-white transition hover:bg-brand-700 disabled:opacity-50"
          >
            {creating === node.href ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <FilePlus2 className="h-3 w-3" />
            )}
            สร้างหน้านี้
          </button>
        )}

        {page && (
          <a
            href={`/admin/pages/${page.id}/`}
            title="เปิดหน้านี้ไปแก้เนื้อหา"
            className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-white px-2 py-1 text-[11px] font-medium text-brand-700 ring-1 ring-brand-100 transition hover:bg-brand-50"
          >
            <SquareArrowOutUpRight className="h-3 w-3" /> แก้เนื้อหา
          </a>
        )}

        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={() => onMove(path, -1)}
            disabled={index === 0}
            aria-label="เลื่อนขึ้น"
            className="grid h-7 w-7 place-items-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:opacity-25"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => onMove(path, 1)}
            disabled={index === siblings - 1}
            aria-label="เลื่อนลง"
            className="grid h-7 w-7 place-items-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:opacity-25"
          >
            ↓
          </button>
          {depth < MAX_DEPTH - 1 && (
            <button
              type="button"
              onClick={() => {
                onAddChild(path);
                setOpen(true);
              }}
              className="ml-1 inline-flex items-center gap-1 rounded-lg bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700 transition hover:bg-brand-100"
            >
              <Plus className="h-3 w-3" /> เมนูย่อย
            </button>
          )}
          <button
            type="button"
            onClick={() => onRemove(path)}
            aria-label="ลบเมนูนี้"
            className="grid h-7 w-7 place-items-center rounded-lg text-gray-400 transition hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {open && children.length > 0 && (
        <ul className="ml-6 space-y-2 border-l border-gray-200 py-2 pl-3 pr-2.5">
          {children.map((child, i) => (
            <Row
              key={`${path.join("-")}-${i}`}
              node={child}
              path={[...path, i]}
              depth={depth + 1}
              siblings={children.length}
              pages={pages}
              creating={creating}
              onChange={onChange}
              onMove={onMove}
              onRemove={onRemove}
              onAddChild={onAddChild}
              onCreatePage={onCreatePage}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function NavMenuEditor({
  initial,
  initialPages = [],
}: {
  initial: NavNode[];
  initialPages?: PageRef[];
}) {
  const [nav, setNav] = useState<NavNode[]>(initial);
  const [pages, setPages] = useState<PageRef[]>(initialPages);
  const [creating, setCreating] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  /** นับเมนูที่กดแล้วเจอ 404 — โชว์ไว้บนหัวจะได้รู้ว่ายังเหลือต้องทำอีกกี่หน้า */
  const countMissing = (nodes: NavNode[]): number =>
    nodes.reduce(
      (sum, node) =>
        sum +
        (linkStatus(node.href, pages) === "missing" ? 1 : 0) +
        countMissing(node.children ?? []),
      0,
    );
  const missing = countMissing(nav);

  /** สร้างหน้าเนื้อหาว่าง ๆ ให้เมนูที่ยังไม่มีหน้า — ใช้ชื่อเมนูเป็นชื่อหน้าไปก่อน */
  async function createPage(href: string, label: string) {
    setCreating(href);
    setStatus(null);

    const response = await fetch("/api/admin/pages/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: label.trim() || href, slug: toSlug(href) }),
    });
    const data = await response.json().catch(() => ({}));
    setCreating(null);

    if (!response.ok) {
      setStatus({ kind: "error", text: data.error ?? "สร้างหน้าไม่สำเร็จ" });
      return;
    }
    setPages((list) => [...list, data.page as PageRef]);
    setStatus({
      kind: "ok",
      text: `สร้างหน้า "${data.page.title}" แล้ว — กด "แก้เนื้อหา" เพื่อใส่ข้อความ (ยังเป็นฉบับร่าง คนนอกยังไม่เห็น)`,
    });
  }

  const dirty = JSON.stringify(nav) !== JSON.stringify(initial);

  const change = (path: number[], patch: Partial<NavNode>) =>
    setNav((n) => updateAt(n, path, (node) => ({ ...node, ...patch })));
  const move = (path: number[], step: number) => setNav((n) => moveAt(n, path, step));
  const remove = (path: number[]) => setNav((n) => updateAt(n, path, () => null));
  const addChild = (path: number[]) =>
    setNav((n) =>
      updateAt(n, path, (node) => ({
        ...node,
        children: [...(node.children ?? []), { label: "เมนูใหม่", href: "" }],
      })),
    );
  const addTop = () => setNav((n) => [...n, { label: "เมนูใหม่", href: "/" }]);

  async function save() {
    setBusy(true);
    setStatus(null);

    const response = await fetch("/api/admin/header/", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nav }),
    });
    const data = await response.json().catch(() => ({}));
    setBusy(false);

    if (!response.ok) {
      setStatus({ kind: "error", text: data.error ?? "บันทึกไม่สำเร็จ" });
      return;
    }
    setStatus({ kind: "ok", text: "บันทึกแล้ว — เมนูเปลี่ยนทุกหน้าทันที" });
  }

  return (
    <section className="rounded-2xl bg-gray-50 p-4 ring-1 ring-black/5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold text-gray-800">เมนูนำทาง</h2>
          <p className="text-xs text-gray-500">
            ลึกได้ 3 ชั้น · เมนูที่มีเมนูย่อยจะเว้นลิงก์ไว้ก็ได้ (เป็นหัวข้อกางเมนูย่อยเฉย ๆ)
          </p>
          {missing > 0 && (
            <p className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-600">
              ยังไม่มีหน้า {missing} เมนู — กดแล้วคนเข้าเว็บจะเจอหน้า 404
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {dirty && (
            <button
              type="button"
              onClick={() => {
                setNav(initial);
                setStatus(null);
              }}
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-2 text-sm text-gray-600 shadow-sm ring-1 ring-black/5 transition hover:text-gray-800"
            >
              <RotateCcw className="h-4 w-4" /> ย้อนกลับ
            </button>
          )}
          <button
            type="button"
            onClick={save}
            disabled={busy || !dirty}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow transition hover:bg-brand-700 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            บันทึกเมนู
          </button>
        </div>
      </div>

      <ul className="space-y-2">
        {nav.map((node, i) => (
          <Row
            key={i}
            node={node}
            path={[i]}
            depth={0}
            siblings={nav.length}
            pages={pages}
            creating={creating}
            onChange={change}
            onMove={move}
            onRemove={remove}
            onAddChild={addChild}
            onCreatePage={createPage}
          />
        ))}
      </ul>

      {/* พิมพ์ในช่องลิงก์แล้วมีรายการหน้าที่มีอยู่ให้เลือก ไม่ต้องจำที่อยู่เอง */}
      <datalist id="nav-page-paths">
        {pages.map((p) => (
          <option key={p.id} value={`/${p.slug}`}>
            {p.title}
          </option>
        ))}
      </datalist>

      <button
        type="button"
        onClick={addTop}
        className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-sm font-medium text-brand-700 shadow-sm ring-1 ring-black/5 transition hover:bg-brand-50"
      >
        <Plus className="h-4 w-4" /> เพิ่มเมนูหลัก
      </button>

      {status && (
        <p className={`mt-3 text-sm ${status.kind === "ok" ? "text-emerald-600" : "text-red-600"}`}>
          {status.text}
        </p>
      )}
    </section>
  );
}
