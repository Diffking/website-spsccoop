import { Megaphone } from "lucide-react";
import { getTickerItems } from "@/lib/content";

// ข้อความมาจากตาราง NewsTicker แก้ได้ที่ /admin/home
export default async function NewsTicker() {
  const texts = await getTickerItems();
  if (texts.length === 0) return null; // ยังไม่มีข่าววิ่ง — ไม่ต้องมีแถบเปล่าคาหน้า

  const items = [...texts, ...texts]; // ทำซ้ำเพื่อวิ่งต่อเนื่องไม่มีรอยต่อ
  return (
    <div className="border-y border-brand-100 bg-white">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
        <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-accent-red px-3 py-1 text-xs font-semibold text-white">
          <Megaphone className="h-3.5 w-3.5" /> ประกาศล่าสุด
        </span>
        <div className="ticker-pause relative flex-1 overflow-hidden">
          <div className="animate-ticker flex w-max gap-10 whitespace-nowrap text-sm text-gray-600">
            {items.map((t, i) => (
              <span key={i} className="flex items-center gap-2">
                <span className="text-accent-red">•</span>
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
