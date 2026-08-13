import Reveal from "@/components/ui/Reveal";
import SectionHeading from "@/components/ui/SectionHeading";
import Icon from "@/components/ui/Icon";
import MaybeLink from "@/components/ui/MaybeLink";
import type { Item } from "@/lib/homeItems";
import { SERVICE_CATEGORIES, categoryOf } from "@/lib/serviceCategories";

/**
 * บริการของเรา — แบ่งเป็นกลุ่มตามว่าเป็นเรื่องของใคร
 * (สมาชิก / คณะกรรมการ / เจ้าหน้าที่) จะได้หาเจอเร็วขึ้นเวลามีรายการเยอะ
 *
 * กลุ่มไหนไม่มีรายการก็ไม่ขึ้นหัวข้อเปล่า ๆ · รายการที่ยังไม่ได้จัดกลุ่มไปรวมท้ายสุด
 */
export default function Services({ items, bg = "bg-sky-soft" }: { items: Item[]; bg?: string }) {
  const groups = SERVICE_CATEGORIES.map((c) => ({
    label: c.label,
    items: items.filter((s) => categoryOf(s.category) === c.key),
  })).filter((g) => g.items.length > 0);

  // มีกลุ่มเดียว = ไม่ต้องขึ้นหัวข้อกลุ่มให้รก แสดงเป็นแถวเดียวเหมือนเดิม
  const showHeadings = groups.length > 1;

  return (
    <section className={`${bg} py-12`}>
      <div className="mx-auto max-w-6xl px-4">
        <SectionHeading title="บริการของเรา" en="Our Services" />

        <div className="space-y-7">
          {groups.map((group) => (
            <div key={group.label}>
              {showHeadings && (
                <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-brand-700">
                  <span className="h-4 w-1 rounded-full bg-brand-500" />
                  {group.label}
                  <span className="text-xs font-normal text-gray-400">
                    ({group.items.length})
                  </span>
                </p>
              )}

              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {group.items.map((s, i) => (
                  <Reveal key={s.id} delay={i * 0.05}>
                    <MaybeLink
                      href={s.href}
                      className="group flex h-full min-h-16 items-center gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5 transition hover:-translate-y-1 hover:shadow-md"
                    >
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-500 transition group-hover:bg-brand-500 group-hover:text-white">
                        <Icon name={s.icon ?? "LayoutGrid"} className="h-5 w-5" />
                      </span>
                      <span
                        title={s.title}
                        className="line-clamp-2 text-sm font-medium text-gray-700 group-hover:text-brand-700"
                      >
                        {s.title}
                      </span>
                    </MaybeLink>
                  </Reveal>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
