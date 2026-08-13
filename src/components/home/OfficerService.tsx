import Image, { type StaticImageData } from "next/image";
import {
  Building2, Hospital, Truck, ImageIcon, ArrowRight,
  type LucideIcon,
} from "lucide-react";
import Reveal from "@/components/ui/Reveal";
import SectionHeading from "@/components/ui/SectionHeading";
import officerBuilding from "@/data/asset/officer.png";
import type { Item } from "@/lib/homeItems";

const OFFICE_ICON: Record<string, LucideIcon> = {
  head: Building2,
  hospital: Hospital,
  van: Truck,
};

// รูปประจำสำนักงาน — มีเฉพาะสำนักงานใหญ่ ส่วนสาขา/รถตู้ยังไม่มี (แสดง placeholder)
const OFFICE_IMAGE: Record<string, StaticImageData | null> = {
  head: officerBuilding,
  hospital: null,
  van: null,
};

// สีธีมแยกตามสำนักงาน (ลูกเล่น)
const THEME: Record<string, { iconBg: string; link: string; bar: string }> = {
  head: { iconBg: "bg-brand-50 text-brand-600", link: "text-brand-600", bar: "bg-brand-500" },
  hospital: { iconBg: "bg-emerald-50 text-emerald-600", link: "text-emerald-600", bar: "bg-emerald-500" },
  van: { iconBg: "bg-orange-50 text-orange-600", link: "text-orange-600", bar: "bg-orange-500" },
};

export default function OfficerService({ items, bg = "bg-sky-soft" }: { items: Item[]; bg?: string }) {
  return (
    <section className={`${bg} py-12`}>
      <div className="mx-auto max-w-6xl px-4">
        <SectionHeading
          title="สำนักงานบริการสมาชิก"
          en="Member Service Office"
          subtitle="ให้บริการสมาชิก 3 จุด — สำนักงานใหญ่ · สาขา รพ.สงขลา · รถตู้โมบาย"
        />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((s, i) => {
            const kind = s.icon ?? "head";
            const t = THEME[kind] ?? THEME.head;
            const OfficeIcon = OFFICE_ICON[kind] ?? Building2;
            // รูปจากหลังบ้านมาก่อน ถ้าไม่มีค่อยใช้ภาพที่ติดมากับโค้ด
            const img: string | StaticImageData | null = s.imageUrl ?? OFFICE_IMAGE[kind] ?? null;
            return (
              <Reveal key={s.id} delay={i * 0.06}>
                <article className="group flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-black/5 transition duration-300 hover:-translate-y-1.5 hover:shadow-xl">
                  {/* ภาพห้องการเงิน — สาขา/รถตู้ยังเว้นว่างไว้ */}
                  <div className="relative aspect-[16/10] overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200">
                    {img ? (
                      <Image
                        src={img}
                        alt={s.title}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover transition duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center gap-2 text-gray-400 transition group-hover:text-gray-500">
                        <ImageIcon className="h-8 w-8" />
                        <span className="text-xs font-medium">ภาพห้องการเงิน</span>
                      </div>
                    )}
                  </div>

                  {/* เนื้อหา */}
                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex items-center gap-2.5">
                      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${t.iconBg}`}>
                        <OfficeIcon className="h-5 w-5" />
                      </span>
                      <h3 className="line-clamp-1 font-bold text-gray-800" title={s.title}>
                        {s.title}
                      </h3>
                    </div>
                    <p
                      title={s.subtitle ?? ""}
                      className="mt-3 line-clamp-3 min-h-[4.5rem] flex-1 text-sm leading-relaxed text-gray-500"
                    >
                      {s.subtitle}
                    </p>
                    <span className={`mt-4 inline-flex items-center gap-1 text-sm font-medium ${t.link}`}>
                      ดูรายละเอียด
                      <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                    </span>
                  </div>

                  {/* แถบสีลูกเล่น — ยืดเต็มความกว้างตอน hover */}
                  <div className={`h-1 w-0 transition-all duration-300 group-hover:w-full ${t.bar}`} />
                </article>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
