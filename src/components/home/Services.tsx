import Link from "next/link";
import Reveal from "@/components/ui/Reveal";
import SectionHeading from "@/components/ui/SectionHeading";
import Icon from "@/components/ui/Icon";
import { services } from "@/data/home";

export default function Services() {
  return (
    <section className="bg-sky-soft py-12">
      <div className="mx-auto max-w-6xl px-4">
        <SectionHeading title="บริการของเรา" en="Our Services" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {services.map((s, i) => (
            <Reveal key={s.label + i} delay={i * 0.05}>
              <Link
                href={s.href}
                className="group flex h-full items-center gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5 transition hover:-translate-y-1 hover:shadow-md"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-500 transition group-hover:bg-brand-500 group-hover:text-white">
                  <Icon name={s.icon} className="h-5 w-5" />
                </span>
                <span className="text-sm font-medium text-gray-700 group-hover:text-brand-700">
                  {s.label}
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
