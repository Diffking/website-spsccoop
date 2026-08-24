import { Download, ScrollText } from "lucide-react";
import type { DocTable, PageDoc } from "@/lib/pageDocs";

/**
 * ลิงก์ระเบียบ/แบบฟอร์ม — ใช้ร่วมกันทั้งหน้าสวัสดิการ เงินให้กู้ และเงินรับฝาก
 *
 * สามหน้านี้เดิมมีตารางเอกสารยาว ๆ ท้ายหน้าที่ไม่ได้บอกว่าฉบับไหนของเรื่องไหน
 * ตอนนี้เอกสารไปเกาะการ์ดของเรื่องที่มันใช้ (ดู src/lib/pageDocs.ts)
 * หน้าตาจึงต้องเหมือนกันทั้งสามหน้า ไม่งั้นสมาชิกต้องเรียนรู้ใหม่ทุกหน้า
 */

/**
 * ไอคอนคนละตัวเพราะสองอย่างนี้ใช้ต่างกัน — ระเบียบไว้ "อ่านว่าตัวเองเข้าเกณฑ์ไหม"
 * แบบฟอร์มคือ "กระดาษที่ต้องกรอกแล้วเอามายื่น" ซึ่งเป็นสิ่งที่สมาชิกส่วนใหญ่มาหา
 * จึงให้แบบฟอร์มเป็นสีเขียวเหมือนไอคอนดาวน์โหลดที่ใช้อยู่เดิมทั้งเว็บ
 */
export function DocLink({ doc }: { doc: PageDoc }) {
  const reg = doc.kind === "reg";
  return (
    <a
      href={doc.href}
      title={doc.name}
      {...(doc.download ? { download: true } : { target: "_blank", rel: "noopener noreferrer" })}
      className="group flex items-start gap-2 text-sm text-gray-600 transition hover:text-brand-700"
    >
      {reg ? (
        <ScrollText className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
      ) : (
        <Download className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
      )}
      {/* min-w-0 ที่ทุกชั้น ไม่งั้นชื่อไทยยาว ๆ ดันการ์ดกว้างทะลุกริด (ดู AGENTS.md) */}
      <span className="min-w-0 flex-1">
        <span className={`font-semibold ${reg ? "text-brand-700" : "text-emerald-700"}`}>
          {reg ? "ระเบียบ" : "แบบฟอร์ม"}
        </span>{" "}
        <span className="underline decoration-gray-300 underline-offset-2 group-hover:decoration-brand-400">
          {doc.short}
        </span>
      </span>
    </a>
  );
}

/** แถบเอกสารที่ติดอยู่ท้ายการ์ดของเรื่องหนึ่ง — ไม่มีเอกสารก็ไม่ขึ้นแถบ ไม่ต้องเว้นที่ว่างคาไว้ */
export function CardDocs({ files }: { files: PageDoc[] }) {
  if (files.length === 0) return null;
  return (
    <div className="space-y-1.5 border-t border-dashed border-gray-200 px-5 py-3">
      {files.map((doc) => (
        <DocLink key={`${doc.kind}-${doc.href}`} doc={doc} />
      ))}
    </div>
  );
}

/**
 * รายการเต็มของตารางเอกสาร — พับเก็บไว้ ไม่ได้ทิ้ง
 *
 * เอกสารบางฉบับไม่ได้เป็นของเรื่องไหนโดยตรง (ระเบียบเงินกู้ฉุกเฉินในหน้าสวัสดิการ ·
 * ระเบียบรับฝากจากนิติบุคคลในหน้าเงินรับฝาก) ถ้าโชว์แต่บนการ์ดมันจะหายไปเฉย ๆ
 * · คนที่คุ้นกับหน้าเดิมและอยากไล่ดูทีละฉบับก็ยังเปิดดูได้ที่เดิมท้ายหน้า
 */
export function DocTables({ tables }: { tables: DocTable[] }) {
  return (
    <>
      {tables.map((table) => (
        <details
          key={table.title}
          className="group mt-4 overflow-hidden rounded-2xl bg-gray-50 ring-1 ring-gray-200"
        >
          <summary className="cursor-pointer list-none px-5 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-100 [&::-webkit-details-marker]:hidden">
            {/* ลูกศรหมุนลงตอนกาง — บอกสถานะโดยไม่ต้องมีตัวหนังสือว่า "ย่อ/ขยาย" */}
            <span className="mr-1.5 inline-block text-gray-400 transition-transform group-open:rotate-90">
              ▸
            </span>
            {table.title}
            <span className="ml-1.5 font-normal text-gray-500">
              ทั้งหมด {table.docs.length} ฉบับ
            </span>
          </summary>
          <ol className="grid grid-cols-1 gap-x-6 gap-y-2 border-t border-gray-200 px-5 py-4 md:grid-cols-2">
            {table.docs.map((doc, i) => (
              <li key={doc.href} className="flex min-w-0 items-start gap-2">
                <span className="mt-0.5 w-5 shrink-0 text-right text-xs text-gray-400 tabular-nums">
                  {i + 1}.
                </span>
                <span className="min-w-0 flex-1">
                  <DocLink doc={doc} />
                </span>
              </li>
            ))}
          </ol>
        </details>
      ))}
    </>
  );
}
