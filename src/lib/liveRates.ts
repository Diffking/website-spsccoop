import type { InterestRates } from "@/lib/settings";

/**
 * ตารางอัตราดอกเบี้ยที่ "ดึงสด" มาวางในหน้าเนื้อหา
 *
 * ปัญหาที่แก้: หน้าเงินรับฝากต้องโชว์อัตราดอกเบี้ยเงินฝาก ซึ่งเป็นข้อมูลชุดเดียวกับ
 * ที่ขึ้นหน้าแรก · ถ้าให้เจ้าหน้าที่พิมพ์ซ้ำลงในหน้า พอปรับดอกเบี้ยทีจะต้องแก้สองที่
 * แล้ววันหนึ่งจะลืม — หน้าเว็บโกหกสมาชิกเรื่องดอกเบี้ยคือความผิดพลาดที่รับไม่ได้
 *
 * วิธีทำ: ในเนื้อหาหน้าใส่ `<div class="live-deposit-rates"></div>` ไว้เป็นหมุด
 * แล้วตอน render ฝั่งเซิร์ฟเวอร์ค่อยแทนที่ด้วยตารางจริงจากค่าที่ตั้งในหลังบ้าน
 * (ดู src/app/[...slug]/page.tsx) · แก้ดอกเบี้ยที่เดียว เปลี่ยนทั้งหน้าแรกและหน้านี้
 *
 * ⚠️ ใช้ **class** ไม่ใช่ `data-*` เพราะ `ALLOWED_ATTRS` ใน pageHtml.ts ยอมให้ `div`
 * มีแค่ `class` กับ `data-title` — ใส่ `data-live` ไว้จะโดนตัวกรองกินทันทีที่มีคนกดบันทึก
 * แล้วตารางจะหายไปเงียบ ๆ · และต้องเพิ่มชื่อคลาสนี้ใน `ALLOWED_CLASSES` ด้วย
 *
 * ⚠️ หมุดนี้ในหน้าแก้ไข (EditUI) จะกลายเป็นก้อน "โค้ด HTML" — ตั้งใจ
 * เจ้าหน้าที่ย้ายตำแหน่งหรือลบทิ้งได้ แต่ไม่ต้องไปพิมพ์ตัวเลขในนั้น
 */
export const LIVE_DEPOSIT_RATES = "live-deposit-rates";

/** `<div class="live-deposit-rates"></div>` — รับช่องว่างและลำดับแอตทริบิวต์ที่ต่างกันได้ */
const MARKER = /<div[^>]*class="[^"]*live-deposit-rates[^"]*"[^>]*>\s*<\/div>/g;

const escape = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * แทนที่หมุดด้วยตารางจริง — ไม่มีหมุดก็คืนค่าเดิมไปเลย ไม่ต้องเสียเวลาประกอบ
 *
 * ใช้แท็กตารางธรรมดาแบบเดียวกับที่แถบเครื่องมือในหลังบ้านสร้าง หน้าตาจึงกลมกลืน
 * กับตารางอื่นในหน้าเนื้อหาเอง ไม่ต้องมี CSS พิเศษ
 */
export function fillLiveRates(html: string, rates: InterestRates): string {
  if (!html.includes(LIVE_DEPOSIT_RATES)) return html;

  const rows = rates.deposit
    .map((r) => `<tr><td>${escape(r.label)}</td><td>${escape(String(r.rate))}</td></tr>`)
    .join("\n      ");

  const table = rates.deposit.length
    ? `<table>
    <thead>
      <tr><th>ประเภทเงินฝาก</th><th>อัตราดอกเบี้ย (ต่อปี)</th></tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
  <p class="small">* อัตราดอกเบี้ยอาจเปลี่ยนแปลงตามประกาศสหกรณ์</p>`
    : `<p>ยังไม่ได้ตั้งอัตราดอกเบี้ยเงินฝากในระบบ</p>`;

  return html.replace(MARKER, table);
}
