/**
 * จัดกลุ่มหน้าเนื้อหาในรายการหลังบ้าน — ไว้หาหน้าที่ต้องการเจอเร็ว ๆ
 *
 * ไม่เกี่ยวกับลำดับหรือการแสดงผลบนหน้าเว็บจริงเลย เป็นแค่การจัดชั้นวางในหลังบ้าน
 * เจ้าหน้าที่ตั้งหมวดเองได้ที่หน้าแก้ไข ไม่ได้ตั้งก็จัดให้ตามที่อยู่หน้า
 * (about/directory/staff → กลุ่ม "about/directory") — มีหน้าเดียวก็ยังหาเจอ
 * โดยไม่ต้องไปนั่งกรอกหมวดให้ครบทุกหน้าก่อน
 *
 * ไฟล์นี้ไม่แตะฐานข้อมูล ใช้ได้ทั้งฝั่ง client และ server
 */

export type GroupedPage = {
  id: string;
  slug: string;
  title: string;
  published: boolean;
  category?: string | null;
};

/** ชื่อกลุ่มของหน้าหนึ่ง — ตั้งเองมาก่อน ไม่มีก็ใช้ที่อยู่หน้าชั้นบน */
export function groupKeyOf(page: { slug: string; category?: string | null }): string {
  const set = page.category?.trim();
  if (set) return set;

  const parts = page.slug.split("/").filter(Boolean);
  return parts.length > 1 ? parts.slice(0, -1).join("/") : "ทั่วไป";
}

export type PageGroup<T> = { key: string; pages: T[] };

/**
 * แบ่งหน้าเป็นกลุ่ม เรียงชื่อกลุ่มตามตัวอักษร และเรียงหน้าในกลุ่มตามที่อยู่
 * กลุ่ม "ทั่วไป" (หน้าที่ไม่มีชั้นบนและไม่ได้ตั้งหมวด) ไปอยู่ท้ายสุดเสมอ
 */
export function groupPages<T extends { slug: string; category?: string | null }>(
  pages: T[],
): PageGroup<T>[] {
  const map = new Map<string, T[]>();

  for (const page of pages) {
    const key = groupKeyOf(page);
    const list = map.get(key);
    if (list) list.push(page);
    else map.set(key, [page]);
  }

  return [...map]
    .map(([key, list]) => ({
      key,
      pages: [...list].sort((a, b) => a.slug.localeCompare(b.slug, "th")),
    }))
    .sort((a, b) => {
      if (a.key === "ทั่วไป") return 1;
      if (b.key === "ทั่วไป") return -1;
      return a.key.localeCompare(b.key, "th");
    });
}

/** หมวดที่เคยใช้แล้วทั้งหมด — เอาไปทำรายการให้เลือกตอนตั้งหมวดของหน้า */
export function usedCategories(pages: { slug: string; category?: string | null }[]): string[] {
  return [...new Set(pages.map(groupKeyOf))].sort((a, b) => a.localeCompare(b, "th"));
}
