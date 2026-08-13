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

export default function Recommend({
  cards,
  features,
  bg = "bg-white",
}: {
  cards: Item[];
  features: Item[];
  bg?: string;
}) {
  return (
    <section className={`${bg} py-12`}>
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
                  <h3 className="line-clamp-1 text-2xl font-bold" title={r.title}>
                    {r.title}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-sm text-white/85" title={r.subtitle ?? ""}>
                    {r.subtitle}
                  </p>
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

        {/*
          แถวที่ 2: บริการย่อย 3 คอลัมน์
          ใบไหนแนบรูปคิวอาร์ไว้ (เพิ่มเพื่อนไลน์ / แฟนเพจ) จะกางเป็นการ์ดแนวตั้ง
          โชว์คิวอาร์ 200×200 ให้สแกนจากจอได้เลย ที่เหลือเป็นการ์ดแถวเดียวเหมือนเดิม
        */}
        <div
          className={`mt-5 grid gap-5 md:grid-cols-3 ${
            // ปกติยืดให้สูงเท่ากันทั้งแถวจะดูเป็นระเบียบกว่า
            // แต่พอมีใบที่มีคิวอาร์ ใบธรรมดาจะถูกยืดตามจนโล่งกลางการ์ด — ให้สูงตามเนื้อแทน
            features.some((f) => f.imageUrl) ? "items-start" : ""
          }`}
        >
          {features.map((f, i) => (
            <Reveal key={f.id} delay={i * 0.08}>
              <MaybeLink
                href={f.href}
                className={`group flex h-full gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-brand-100 transition hover:-translate-y-1 hover:shadow-md ${
                  f.imageUrl ? "flex-col items-center text-center" : "items-center"
                }`}
              >
                <span
                  className={`grid shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-500 transition group-hover:bg-brand-500 group-hover:text-white ${
                    f.imageUrl ? "h-11 w-11" : "h-12 w-12"
                  }`}
                >
                  <Icon name={f.icon ?? "Users"} className="h-6 w-6" />
                </span>

                <div className={f.imageUrl ? "w-full" : "min-w-0"}>
                  <h3
                    title={f.title}
                    className="line-clamp-1 font-semibold text-gray-800 group-hover:text-brand-700"
                  >
                    {f.title}
                  </h3>
                  <p className="line-clamp-2 text-sm text-gray-500" title={f.subtitle ?? ""}>
                    {f.subtitle}
                  </p>
                </div>

                {f.imageUrl ? (
                  <>
                    {/* ขนาดตายตัว 200×200 — คิวอาร์เล็กกว่านี้กล้องมือถือจับยาก */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={f.imageUrl}
                      alt={`คิวอาร์โค้ด ${f.title}`}
                      width={200}
                      height={200}
                      className="h-[200px] w-[200px] max-w-full rounded-xl bg-white object-contain p-1 ring-1 ring-gray-200"
                    />
                    {f.href && f.href !== "#" && (
                      <span className="inline-flex items-center gap-1 text-sm font-medium text-brand-600">
                        สแกน หรือกดที่การ์ด
                        <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                      </span>
                    )}
                  </>
                ) : (
                  <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-brand-400 transition group-hover:translate-x-1" />
                )}
              </MaybeLink>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
