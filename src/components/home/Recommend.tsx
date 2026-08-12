import { ArrowRight } from "lucide-react";
import Reveal from "@/components/ui/Reveal";
import SectionHeading from "@/components/ui/SectionHeading";
import Icon from "@/components/ui/Icon";
import MaybeLink from "@/components/ui/MaybeLink";
import type { Item } from "@/lib/homeItems";

const THEME: Record<string, string> = {
  blue: "from-brand-600 to-brand-400",
  green: "from-accent-green to-accent-green-dark",
  orange: "from-accent-orange to-accent-orange-dark",
};

export default function Recommend({ cards, features }: { cards: Item[]; features: Item[] }) {
  return (
    <section className="bg-white py-12">
      <div className="mx-auto max-w-6xl px-4">
        <SectionHeading title={<span>✨ สำหรับสมาชิก</span>} />

        {/* แถวที่ 1: การ์ดหลัก 3 คอลัมน์ */}
        <div className="grid gap-5 md:grid-cols-3">
          {cards.map((r, i) => (
            <Reveal key={r.id} delay={i * 0.08}>
              <MaybeLink
                href={r.href}
                className={`group relative flex h-40 flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br ${THEME[r.theme ?? "blue"] ?? THEME.blue} p-6 text-white shadow-md transition hover:shadow-xl`}
              >
                <div className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/10 transition group-hover:scale-125" />
                <div className="relative">
                  <h3 className="text-2xl font-bold">{r.title}</h3>
                  <p className="mt-1 text-sm text-white/85">{r.subtitle}</p>
                </div>
                {r.href && r.href !== "#" && (
                  <span className="relative inline-flex items-center gap-1 text-sm font-medium">
                    ดูรายละเอียด <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                  </span>
                )}
              </MaybeLink>
            </Reveal>
          ))}
        </div>

        {/* แถวที่ 2: บริการย่อย 3 คอลัมน์ */}
        <div className="mt-5 grid gap-5 md:grid-cols-3">
          {features.map((f, i) => (
            <Reveal key={f.id} delay={i * 0.08}>
              <MaybeLink
                href={f.href}
                className="group flex h-full items-center gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-brand-100 transition hover:-translate-y-1 hover:shadow-md"
              >
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-500 transition group-hover:bg-brand-500 group-hover:text-white">
                  <Icon name={f.icon ?? "Users"} className="h-6 w-6" />
                </span>
                <div className="min-w-0">
                  <h3 className="font-semibold text-gray-800 group-hover:text-brand-700">{f.title}</h3>
                  <p className="text-sm text-gray-500">{f.subtitle}</p>
                </div>
                <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-brand-400 transition group-hover:translate-x-1" />
              </MaybeLink>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
