import Reveal from "@/components/ui/Reveal";
import Icon from "@/components/ui/Icon";
import MaybeLink from "@/components/ui/MaybeLink";
import type { Item } from "@/lib/homeItems";

export default function MemberCorner({ links, bg = "bg-white" }: { links: Item[]; bg?: string }) {
  return (
    <section className={`${bg} pb-12`}>
      <div className="mx-auto max-w-6xl px-4">
        <Reveal>
          {/*
            ไล่สีฟ้า → เขียว จากซ้ายไปขวา แวะฟ้าอมเขียว (teal) ตรงกลาง
            ถ้าไล่ฟ้าไปเขียวตรง ๆ ช่วงกลางจะออกเทาหม่น เพราะสองสีนี้อยู่คนละฝั่งของวงล้อสี
          */}
          <div className="grid items-center gap-6 rounded-2xl bg-gradient-to-r from-brand-600 via-teal-500 to-accent-green p-7 text-white shadow-lg md:grid-cols-[1fr_auto]">
            <div>
              <h3 className="text-2xl font-bold">แนะนำสมาชิก</h3>
              <p className="mt-1 max-w-md text-sm text-white/85">
                ความรู้สำหรับการเป็นสมาชิกสหกรณ์ การเข้าถึงบริการต่าง ๆ และสิทธิประโยชน์ที่คุณจะได้รับจากการเป็นสมาชิก
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {links.map((m) => (
                <MaybeLink
                  key={m.id}
                  href={m.href}
                  className="flex flex-col items-center gap-2 rounded-xl bg-white/15 px-4 py-3 text-center text-xs font-medium backdrop-blur transition hover:bg-white/25"
                >
                  {/* ปุ่มพวกนี้อยู่ฝั่งขวาซึ่งเป็นช่วงเขียว ใช้ฟ้าอมเขียวจะกลืนกับพื้นหลังกว่าฟ้าล้วน */}
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-teal-600">
                    <Icon name={m.icon ?? "BookOpen"} className="h-5 w-5" />
                  </span>
                  <span className="line-clamp-2" title={m.title}>
                    {m.title}
                  </span>
                </MaybeLink>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
