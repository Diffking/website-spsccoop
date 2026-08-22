/**
 * ตรวจและซ่อมโครงสร้าง <div> ในเนื้อหาหน้าเว็บ
 *
 * เนื้อหาพิมพ์เป็น HTML ตรง ๆ พอแก้ไปมา (ก๊อปวาง ลบไม่หมด แทรกทับ) มักเหลือ </div>
 * เกินมา ผลคือกล่องแม่ถูกปิดก่อนเวลา — เกิดกับหน้าข้อบังคับ/ระเบียบมาแล้ว:
 * มี 3 แท็บ แต่ </div> เกิน 3 ตัวไปปิด <div class="tabs"> ตั้งแต่แท็บแรก
 * แท็บที่ 2-3 เลยหลุดออกมากองใต้หน้า ปุ่มสลับแท็บขึ้นแค่อันเดียว
 *
 * ไฟล์นี้ทำงานกับข้อความล้วน ไม่ใช้ DOM — เรียกได้ทั้งฝั่ง client และ server
 */

const DIV_TAG = /<div\b[^>]*>|<\/div\s*>/gi;

export type DivBalance = {
  /** </div> ที่เกินมา (ไม่มีตัวเปิดคู่กัน) */
  extraClose: number;
  /** <div> ที่ยังไม่ได้ปิด */
  missingClose: number;
};

/** นับว่าโครงสร้างเพี้ยนตรงไหนบ้าง — ทั้งคู่เป็น 0 คือสมดุลดี */
export function divBalance(html: string): DivBalance {
  let depth = 0;
  let extraClose = 0;

  for (const match of html.matchAll(DIV_TAG)) {
    if (match[0].startsWith("</")) {
      if (depth === 0) extraClose += 1;
      else depth -= 1;
    } else {
      depth += 1;
    }
  }
  return { extraClose, missingClose: depth };
}

/**
 * ซ่อมให้สมดุล — ตัด </div> ที่เกินทิ้ง และเติมตัวปิดให้ <div> ที่ค้าง
 *
 * จงใจไม่เดาว่าตัวที่เกินควรอยู่ตรงไหน แค่ตัดตัวที่ปิดโดยไม่มีตัวเปิดออก
 * เนื้อหาส่วนอื่นจึงไม่ถูกขยับ และผลลัพธ์ตรวจซ้ำได้ว่าเหมือนเดิมทุกตัวอักษรยกเว้นแท็กที่เกิน
 */
export function fixDivBalance(html: string): string {
  let depth = 0;
  let out = "";
  let last = 0;

  for (const match of html.matchAll(DIV_TAG)) {
    const tag = match[0];
    const at = match.index ?? 0;

    if (tag.startsWith("</")) {
      if (depth === 0) {
        // ตัวปิดที่ไม่มีตัวเปิดคู่กัน — ข้ามไป พร้อมกลืนช่องว่าง/บรรทัดว่างที่ตามมา
        out += html.slice(last, at);
        last = at + tag.length;
        const after = /^[ \t]*\r?\n/.exec(html.slice(last));
        if (after) last += after[0].length;
        continue;
      }
      depth -= 1;
    } else {
      depth += 1;
    }
  }

  out += html.slice(last);
  // <div> ที่ยังค้างอยู่ ปิดให้ครบท้ายเนื้อหา
  return depth > 0 ? `${out.replace(/\s+$/, "")}\n${"</div>\n".repeat(depth).trim()}` : out;
}

/**
 * จัดกล่องแท็บให้เข้าที่ — เอา <div class="tab"> ทุกอันกลับเข้าไปอยู่ใน <div class="tabs"> เดียวกัน
 *
 * แก้อาการ "แท็บหลุด": </div> เกินไปปิด .tabs ตั้งแต่แท็บแรก แท็บที่เหลือเลยหลุดออกมา
 * กองใต้หน้าเป็นเนื้อหาธรรมดา ปุ่มสลับแท็บขึ้นแค่อันเดียว (ดูหน้าข้อบังคับ/ระเบียบ)
 *
 * วิธีทำ: หั่นเนื้อหาที่หัว <div class="tab"> แต่ละอัน ปรับ </div> ในแต่ละท่อนให้สมดุล
 * แล้วประกอบกลับเป็นกล่องเดียว — ข้อความข้างในไม่ถูกแตะเลย ย้ายแค่ขอบเขตของกล่อง
 */
/**
 * หาตำแหน่ง `</div>` ที่ปิดตรงกับ `<div>` ที่เปิดไว้ โดยนับชั้นจริง
 * คืน -1 ถ้าหาไม่เจอ (HTML ไม่สมบูรณ์ — ปล่อยให้ตัวปรับสมดุลจัดการต่อ)
 */
function closingDiv(html: string, openEnd: number): number {
  const tag = /<div\b|<\/div>/gi;
  tag.lastIndex = openEnd;
  let depth = 1;
  let m: RegExpExecArray | null;
  while ((m = tag.exec(html)) !== null) {
    depth += m[0].toLowerCase() === "</div>" ? -1 : 1;
    if (depth === 0) return m.index;
  }
  return -1;
}

export function fixTabsStructure(html: string): string {
  const tabsOpen = /<div\b[^>]*\bclass="[^"]*\btabs\b[^"]*"[^>]*>/i.exec(html);
  if (!tabsOpen || tabsOpen.index === undefined) return html;

  /*
    ⚠️ ต้องรู้ว่ากล่องแท็บจบตรงไหน แล้วซ่อมเฉพาะข้างในกล่อง

    ของเดิมไล่จากแท็บสุดท้ายไปจนจบหน้า (`html.length`) โดยคิดว่ากล่องแท็บเป็น
    ของท้ายสุดเสมอ — พอมีหัวข้ออื่นต่อท้าย (เช่นหน้าสวัสดิการที่มีระเบียบกับ
    เอกสารต่อจากแท็บ) เนื้อหาพวกนั้นจะถูกดูดเข้าไปอยู่ในแท็บสุดท้ายทั้งก้อน
    ทำให้หัวข้อหายและรายการในแท็บบวมผิดปกติ (เจอ 22 ส.ค. 2026 · 7 กลายเป็น 31)
  */
  const innerFrom = tabsOpen.index + tabsOpen[0].length;
  const closeAt = closingDiv(html, innerFrom);
  const boxEnd = closeAt === -1 ? html.length : closeAt + "</div>".length;
  const box = html.slice(0, boxEnd);
  const tail = html.slice(boxEnd);

  const tabOpen = /<div\b[^>]*\bclass="[^"]*\btab\b[^"]*"[^>]*>/gi;
  const starts: { at: number; tag: string }[] = [];
  for (const match of box.matchAll(tabOpen)) {
    // class="tabs" ก็เข้าเงื่อนไข \btab\b ไม่ได้ ต้องกันตัวกล่องนอกไว้เอง
    if (/\btabs\b/i.test(match[0])) continue;
    starts.push({ at: match.index ?? 0, tag: match[0] });
  }
  if (starts.length === 0) return html;

  const head = box.slice(0, tabsOpen.index);
  const pieces = starts.map((start, i) => {
    const from = start.at + start.tag.length;
    const to = i + 1 < starts.length ? starts[i + 1].at : box.length;
    // ท่อนสุดท้ายจะมี </div> ปิด .tabs ติดมาด้วย — ปรับสมดุลจะตัดตัวเกินออกให้เอง
    const inner = fixDivBalance(box.slice(from, to)).trim();
    return `  ${start.tag}\n    ${inner.split("\n").join("\n    ")}\n  </div>`;
  });

  return `${head}${tabsOpen[0]}\n${pieces.join("\n")}\n</div>\n${tail}`;
}

/**
 * ปัญหาโครงสร้างที่เจอในเนื้อหา — คืนเป็นข้อความไทยพร้อมแสดงให้เจ้าหน้าที่อ่าน
 * ว่าง = โครงสร้างปกติดี
 */
export function structureProblems(html: string): string[] {
  const problems: string[] = [];
  const { extraClose, missingClose } = divBalance(html);

  if (extraClose > 0) problems.push(`มี </div> เกินมา ${extraClose} ตัว`);
  if (missingClose > 0) problems.push(`มี <div> ที่ยังไม่ได้ปิด ${missingClose} ตัว`);

  // แท็บที่หลุดออกนอกกล่อง — ปุ่มสลับแท็บจะขึ้นไม่ครบ เนื้อหาที่เหลือกองอยู่ใต้หน้า
  const tabsOpen = /<div\b[^>]*\bclass="[^"]*\btabs\b[^"]*"[^>]*>/i.exec(html);
  if (tabsOpen) {
    const all = [...html.matchAll(/<div\b[^>]*\bclass="[^"]*\btab\b[^"]*"[^>]*>/gi)].filter(
      (m) => !/\btabs\b/i.test(m[0]),
    );

    // หาขอบเขตจริงของกล่องแท็บ แล้วดูว่ามีแท็บไหนอยู่นอกขอบเขตนั้นบ้าง
    let depth = 0;
    let end = html.length;
    const from = tabsOpen.index + tabsOpen[0].length;
    for (const match of html.slice(from).matchAll(DIV_TAG)) {
      const at = from + (match.index ?? 0);
      if (match[0].startsWith("</")) {
        if (depth === 0) {
          end = at;
          break;
        }
        depth -= 1;
      } else depth += 1;
    }

    const outside = all.filter((m) => (m.index ?? 0) > end).length;
    if (outside > 0) problems.push(`มีแท็บ ${outside} อันหลุดออกนอกกล่องแท็บ`);
  }

  return problems;
}

/** ซ่อมทุกอย่างที่ซ่อมได้ — จัดแท็บเข้ากล่องก่อน แล้วค่อยเก็บ </div> ที่ยังเกิน */
export function repairStructure(html: string): string {
  return fixDivBalance(fixTabsStructure(html));
}
