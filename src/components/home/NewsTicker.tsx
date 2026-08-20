import { Megaphone } from "lucide-react";
import { getTickerEntries, type TickerEntry } from "@/lib/content";
import { KIND_BADGE_CLASS } from "@/lib/announcementKinds";
import { getTickerSettings } from "@/lib/settings";

/**
 * ข่าววิ่งใต้แบนเนอร์
 *
 * ปกติดึงประกาศล่าสุดมาเอง ไม่ต้องมาพิมพ์ซ้ำในหลังบ้าน — ตั้งค่าที่ /admin/home/ticker
 * ข้อความถูกทำซ้ำสองชุดเพื่อให้วิ่งวนต่อเนื่องไม่มีรอยต่อ ชุดที่สองซ่อนจาก screen reader
 * ไม่งั้นจะอ่านซ้ำสองรอบ
 */

function Item({ entry, blink }: { entry: TickerEntry; blink: boolean }) {
  const body = (
    <>
      {entry.badge ? (
        // สีป้ายบอกหมวด — แดง=ประกาศ · เหลือง=จดหมายข่าว · ส้ม=รายงานกิจการ
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase leading-none ${
            entry.kind ? KIND_BADGE_CLASS[entry.kind] : "bg-accent-red text-white"
          } ${blink ? "animate-blink" : ""}`}
        >
          {entry.badge}
        </span>
      ) : (
        <span className="text-accent-red">•</span>
      )}
      {entry.text}
    </>
  );

  // มีไฟล์ประกาศก็กดอ่านฉบับเต็มได้เลย ไม่มีก็เป็นข้อความเฉย ๆ ไม่ทำลิงก์ที่กดแล้วไม่ไปไหน
  return entry.href ? (
    <a
      href={entry.href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 transition hover:text-brand-700 hover:underline"
    >
      {body}
    </a>
  ) : (
    <span className="flex items-center gap-2">{body}</span>
  );
}

export default async function NewsTicker({ bg = "bg-white" }: { bg?: string }) {
  const [entries, settings] = await Promise.all([getTickerEntries(), getTickerSettings()]);
  if (entries.length === 0) return null; // ยังไม่มีข่าววิ่ง — ไม่ต้องมีแถบเปล่าคาหน้า

  return (
    <div className={`border-y border-brand-100 ${bg}`}>
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
        <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-accent-red px-3 py-1 text-xs font-semibold text-white">
          <Megaphone className="h-3.5 w-3.5" /> ประกาศล่าสุด
        </span>
        <div className="ticker-pause relative flex-1 overflow-hidden">
          {/* วิ่งครบรอบใน (จำนวนรายการ × วินาทีต่อรายการ) — ตั้งค่าได้ที่ /admin/home/ticker */}
          {/*
            สองครึ่งต้องกว้าง "เท่ากันเป๊ะ" เพราะภาพเคลื่อนไหวเลื่อนไป -50% พอดี
            ถ้าไม่เท่า พอวนกลับจะกระตุกทุกรอบ

            เดิมครึ่งแรกเป็นรายการลอย ๆ ครึ่งหลังห่ออยู่ใน span ช่องไฟจึงไม่เท่ากัน
            (ครึ่งแรกขาดช่องไฟท้ายไปหนึ่งช่อง) เลยเพี้ยนไปครึ่งช่องไฟทุกรอบ
            ตอนนี้ห่อทั้งสองครึ่งเหมือนกัน และใส่ช่องไฟท้ายด้วย pr-10 ให้ครบทั้งคู่
          */}
          <div
            style={{ animationDuration: `${entries.length * settings.secondsPerItem}s` }}
            className="animate-ticker flex w-max whitespace-nowrap text-sm text-gray-600"
          >
            <span className="flex w-max gap-10 pr-10">
              {entries.map((entry, i) => (
                <Item key={`a-${i}`} entry={entry} blink={settings.badgeBlink} />
              ))}
            </span>
            <span aria-hidden="true" className="flex w-max gap-10 pr-10">
              {entries.map((entry, i) => (
                <Item key={`b-${i}`} entry={entry} blink={settings.badgeBlink} />
              ))}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
