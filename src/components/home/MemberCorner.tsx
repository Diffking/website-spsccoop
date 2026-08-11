import Link from "next/link";
import Reveal from "@/components/ui/Reveal";
import Icon from "@/components/ui/Icon";
import { memberLinks } from "@/data/home";

export default function MemberCorner() {
  return (
    <section className="bg-white pb-12">
      <div className="mx-auto max-w-6xl px-4">
        <Reveal>
          <div className="grid items-center gap-6 rounded-2xl bg-gradient-to-r from-brand-600 to-brand-400 p-7 text-white shadow-lg md:grid-cols-[1fr_auto]">
            <div>
              <h3 className="text-2xl font-bold">แนะนำสมาชิก</h3>
              <p className="mt-1 max-w-md text-sm text-white/85">
                ความรู้สำหรับการเป็นสมาชิกสหกรณ์ การเข้าถึงบริการต่าง ๆ และสิทธิประโยชน์ที่คุณจะได้รับจากการเป็นสมาชิก
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {memberLinks.map((m) => (
                <Link
                  key={m.label}
                  href={m.href}
                  className="flex flex-col items-center gap-2 rounded-xl bg-white/15 px-4 py-3 text-center text-xs font-medium backdrop-blur transition hover:bg-white/25"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-brand-600">
                    <Icon name={m.icon} className="h-5 w-5" />
                  </span>
                  {m.label}
                </Link>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
