/**
 * แถบนำทางหน้าทำเนียบ — อ่านหัวข้อ `<h2>` ในเนื้อหาแล้วทำเป็นรายการ "ชื่อฝ่าย" ให้กดกระโดดไปได้
 *
 * เจ้าของเว็บสั่ง 9 พ.ย. 2569: แถบมี **แค่ชื่อฝ่าย** (ไม่มีรูป ไม่มีชื่อคน ไม่มีตำแหน่ง)
 * mockup: https://claude.ai/artifact/9edSteNHJsREbibLnhEyT6
 *
 * ทำตอนแสดงผลเท่านั้น ไม่แตะเนื้อหาในฐาน — EditUI แก้หน้าได้เหมือนเดิม
 * เพิ่ม/ลบ/เปลี่ยนชื่อหัวข้อฝ่ายในหลังบ้านเมื่อไหร่ แถบเปลี่ยนตามเอง
 *
 * ขึ้นเฉพาะหน้าที่เป็นทำเนียบ (`class="people"`) และมีหัวข้อ `<h2>` ตั้งแต่ 2 หัวข้อขึ้นไป
 * หน้าทำเนียบที่ไม่แบ่งกลุ่มจึงไม่มีแถบ (ไม่มีอะไรให้นำทาง)
 */

export type DirSection = { id: string; label: string; count: number };

const H2 = /<h2(\s[^>]*)?>([\s\S]*?)<\/h2>/gi;

function plain(s: string): string {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export function directorySections(html: string): { html: string; sections: DirSection[] } | null {
  if (!/class="[^"]*\bpeople\b/.test(html)) return null;

  const hits = [...html.matchAll(H2)];
  if (hits.length < 2) return null;

  const sections: DirSection[] = [];
  let out = "";
  let last = 0;
  hits.forEach((m, i) => {
    const start = m.index ?? 0;
    const end = start + m[0].length;
    const next = hits[i + 1]?.index ?? html.length;
    const attrs = m[1] ?? "";
    const label = plain(m[2]);
    if (!label) return;

    // มี id อยู่แล้วใช้ของเดิม · ไม่มีก็ใส่ให้ (เฉพาะตอนแสดงผล)
    const own = /\sid="([^"]+)"/.exec(attrs)?.[1];
    const id = own ?? `dir-${i + 1}`;
    const count = (html.slice(end, next).match(/<figure\b/gi) ?? []).length;
    sections.push({ id, label, count });

    out += html.slice(last, start);
    out += own ? m[0] : `<h2 id="${id}"${attrs}>${m[2]}</h2>`;
    last = end;
  });
  out += html.slice(last);

  return sections.length >= 2 ? { html: out, sections } : null;
}
