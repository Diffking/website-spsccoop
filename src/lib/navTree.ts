/**
 * ย้ายเมนูในต้นไม้เมนูนำทาง — ใช้ตอนลากวางในหน้าแก้เมนู
 *
 * เดิมย้ายได้แค่ขึ้น-ลงในระดับเดียวกัน อยากเอาเมนูบนสุดไปเป็นเมนูย่อยของอีกอัน
 * ต้องลบทิ้งแล้วพิมพ์ใหม่ทั้งชื่อทั้งลิงก์ ไฟล์นี้ทำให้ลากไปวางตรงไหนก็ได้
 *
 * ตำแหน่งอ้างด้วย path เป็นอาร์เรย์ตัวเลข เช่น [0,2] = เมนูที่ 1 → เมนูย่อยที่ 3
 * ไม่แตะฐานข้อมูลและไม่ใช้ DOM ใช้ได้ทั้งฝั่ง client และ server
 */

import type { NavNode } from "@/lib/nav";

/** วางไว้ตรงไหนเทียบกับเมนูที่ลากไปทับ */
export type DropMode = "before" | "after" | "inside";

const same = (a: number[], b: number[]) =>
  a.length === b.length && a.every((v, i) => v === b[i]);

const startsWith = (path: number[], prefix: number[]) =>
  path.length >= prefix.length && prefix.every((v, i) => path[i] === v);

/** เมนูที่ path ชี้ไป — ไม่มีคืน null */
export function nodeAt(nodes: NavNode[], path: number[]): NavNode | null {
  let list = nodes;
  let node: NavNode | null = null;
  for (const index of path) {
    node = list[index] ?? null;
    if (!node) return null;
    list = node.children ?? [];
  }
  return node;
}

/** ความสูงของกิ่ง — 1 คือไม่มีเมนูย่อย ใช้เช็คว่าย้ายแล้วจะลึกเกินที่ระบบรองรับไหม */
export function branchHeight(node: NavNode): number {
  const children = node.children ?? [];
  return children.length === 0 ? 1 : 1 + Math.max(...children.map(branchHeight));
}

/** ตัดเมนูที่ path ออกจากต้นไม้ */
function removeAt(nodes: NavNode[], path: number[]): NavNode[] {
  const [head, ...rest] = path;
  return nodes.flatMap((node, i) => {
    if (i !== head) return [node];
    if (rest.length === 0) return [];
    const children = removeAt(node.children ?? [], rest);
    return [{ ...node, children: children.length > 0 ? children : undefined }];
  });
}

/** แทรกเมนูเข้าไปเป็นลูกลำดับที่ index ของ parentPath (parentPath ว่าง = ระดับบนสุด) */
function insertAt(
  nodes: NavNode[],
  parentPath: number[],
  index: number,
  node: NavNode,
): NavNode[] {
  if (parentPath.length === 0) {
    const copy = [...nodes];
    copy.splice(index, 0, node);
    return copy;
  }

  const [head, ...rest] = parentPath;
  return nodes.map((child, i) => {
    if (i !== head) return child;
    const children = insertAt(child.children ?? [], rest, index, node);
    return { ...child, children };
  });
}

/**
 * ย้ายเมนูจาก from ไปวางที่ to ตามโหมดที่เลือก — ย้ายไม่ได้คืน null (คนเรียกไม่ต้องทำอะไรต่อ)
 *
 * ย้ายไม่ได้เมื่อ: วางที่เดิม · ลากไปวางในตัวเองหรือในลูกของตัวเอง · ย้ายแล้วลึกเกิน maxDepth
 */
export function moveNode(
  nodes: NavNode[],
  from: number[],
  to: number[],
  mode: DropMode,
  maxDepth: number,
): NavNode[] | null {
  if (from.length === 0 || to.length === 0) return null;
  if (same(from, to) && mode !== "inside") return null;

  // ลากพ่อไปทิ้งในลูกตัวเอง = กิ่งนั้นหลุดออกจากต้นไม้ทั้งกิ่ง ต้องกันไว้
  if (startsWith(to, from)) return null;

  const moving = nodeAt(nodes, from);
  if (!moving) return null;

  const parentPath = mode === "inside" ? [...to] : to.slice(0, -1);
  let index =
    mode === "inside"
      ? (nodeAt(nodes, to)?.children ?? []).length
      : to[to.length - 1] + (mode === "after" ? 1 : 0);

  // ระดับของที่วาง + ความสูงของกิ่งที่ลาก ต้องไม่เกินชั้นที่ระบบรองรับ
  if (parentPath.length + branchHeight(moving) > maxDepth) return null;

  const pruned = removeAt(nodes, from);

  /*
   * ตัดของเก่าออกแล้วลำดับหลังจุดที่ตัดจะเลื่อนขึ้นหนึ่งช่อง
   * ถ้าจุดที่จะวางอยู่หลังจุดที่ตัด "ในระดับเดียวกัน" ต้องลดลำดับตาม ไม่งั้นวางเกินไปหนึ่งช่อง
   */
  const fromParent = from.slice(0, -1);
  const fromIndex = from[from.length - 1];

  if (parentPath.length > fromParent.length && startsWith(parentPath, fromParent)) {
    if (parentPath[fromParent.length] > fromIndex) parentPath[fromParent.length] -= 1;
  } else if (same(parentPath, fromParent) && index > fromIndex) {
    index -= 1;
  }

  return insertAt(pruned, parentPath, index, moving);
}
